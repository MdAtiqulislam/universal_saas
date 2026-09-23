import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CustomerInvoicesService } from './invoices/customer-invoices.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import {
  CustomerInvoiceStatus,
  FiscalPeriodStatus,
  Prisma,
} from '@prisma/client';

describe('Accounts Receivable Concurrency & Race Condition Guards', () => {
  let invoiceService: CustomerInvoicesService;
  let numberingService: NumberingService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockInvoiceId = '22222222-2222-2222-2222-222222222222';
  const mockUserId = '33333333-3333-3333-3333-333333333333';

  // In-memory atomic state to simulate PostgreSQL atomic counter
  let atomicCounter = 1;
  const lock = {
    locked: false,
    async acquire<T>(fn: () => Promise<T>): Promise<T> {
      while (this.locked) {
        await new Promise((r) => setTimeout(r, 1));
      }
      this.locked = true;
      try {
        return await fn();
      } finally {
        this.locked = false;
      }
    },
  };

  beforeEach(async () => {
    atomicCounter = 1;

    prismaMock = {
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        return lock.acquire(async () => {
          const current = atomicCounter++;
          const txMock = {
            $queryRaw: jest.fn().mockResolvedValue([
              {
                allocated_number: current,
                prefix: 'CI-',
                padding: 6,
              },
            ]),
            customerInvoice: {
              findFirst: prismaMock.customerInvoice?.findFirst,
              update: prismaMock.customerInvoice?.update,
            },
            journalEntry: {
              create: jest
                .fn()
                .mockResolvedValue({ id: 'gl-1', entryNumber: 'JE-000001' }),
            },
            journalLine: {
              createMany: jest.fn().mockResolvedValue({ count: 2 }),
            },
          };
          return (await cb(txMock)) as unknown;
        });
      }),
      customerInvoice: {
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'period-1',
          status: FiscalPeriodStatus.OPEN,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
        }),
      },
      accountingAccountMapping: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve({
            id: 'm-1',
            organizationId: mockOrgId,
            key: where.organizationId_key.key,
            accountId: 'acc-1',
            account: {
              id: 'acc-1',
              code: '1000',
              isActive: true,
              deletedAt: null,
            },
          });
        }),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerInvoicesService,
        NumberingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        {
          provide: ApAccountMappingService,
          useValue: { resolveAccount: jest.fn().mockResolvedValue('acc-1') },
        },
      ],
    }).compile();

    invoiceService = module.get<CustomerInvoicesService>(
      CustomerInvoicesService,
    );
    numberingService = module.get<NumberingService>(NumberingService);
  });

  it('1. 100 parallel invoice number allocations should produce 100 unique sequential numbers without duplicates', async () => {
    const tasks = Array.from({ length: 100 }, () =>
      numberingService.nextNumber(mockOrgId, 'CUSTOMER_INVOICE', mockUserId),
    );

    const results = await Promise.all(tasks);
    const formattedNumbers = results.map((r) => r.formatted);
    const uniqueNumbers = new Set(formattedNumbers);

    expect(results.length).toBe(100);
    expect(uniqueNumbers.size).toBe(100);
    expect(formattedNumbers[0]).toBe('CI-000001');
    expect(formattedNumbers[99]).toBe('CI-000100');
  });

  it('2. 100 parallel attempts to issue the same invoice should result in exactly 1 success and 99 failures', async () => {
    let hasBeenIssued = false;

    const baseInvoice = {
      id: mockInvoiceId,
      organizationId: mockOrgId,
      invoiceNumber: 'CI-000001',
      invoiceDate: new Date('2026-08-01'),
      get status() {
        return hasBeenIssued
          ? CustomerInvoiceStatus.ISSUED
          : CustomerInvoiceStatus.DRAFT;
      },
      subtotal: new Prisma.Decimal('100.0000'),
      discountAmount: new Prisma.Decimal('0.0000'),
      taxAmount: new Prisma.Decimal('0.0000'),
      grandTotal: new Prisma.Decimal('100.0000'),
      amountPaid: new Prisma.Decimal('0.0000'),
      amountDue: new Prisma.Decimal('100.0000'),
      customer: { id: 'cust-1', name: 'Acme Client' },
      currency: { id: 'c-1', code: 'USD', symbol: '$' },
      lines: [],
    };

    prismaMock.customerInvoice.findFirst = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        ...baseInvoice,
        status: hasBeenIssued
          ? CustomerInvoiceStatus.ISSUED
          : CustomerInvoiceStatus.DRAFT,
      });
    });

    prismaMock.customerInvoice.update = jest.fn().mockImplementation(() => {
      if (hasBeenIssued) {
        throw new BadRequestException('Double issuing prevented');
      }
      hasBeenIssued = true;
      return Promise.resolve({
        ...baseInvoice,
        status: CustomerInvoiceStatus.ISSUED,
        issuedAt: new Date(),
        issuedByUserId: mockUserId,
      });
    });

    const attempts = Array.from({ length: 100 }, () =>
      invoiceService
        .issue(mockOrgId, mockInvoiceId, mockUserId)
        .then(() => ({ success: true, error: null as any }))
        .catch((err) => ({ success: false, error: err })),
    );

    const outcomes = await Promise.all(attempts);
    const successes = outcomes.filter((o) => o.success);
    const failures = outcomes.filter((o) => !o.success);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(99);
    failures.forEach((f) => {
      expect(f.error).toBeInstanceOf(BadRequestException);
    });
  });
});
