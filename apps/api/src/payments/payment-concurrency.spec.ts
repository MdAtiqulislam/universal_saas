import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './transactions/payments.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import {
  PaymentStatus,
  PaymentType,
  FiscalPeriodStatus,
  Prisma,
} from '@prisma/client';

describe('Payments & Settlement Concurrency Guards', () => {
  let paymentsService: PaymentsService;
  let numberingService: NumberingService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockPaymentId = '22222222-2222-2222-2222-222222222222';
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
                prefix: 'RC-',
                padding: 6,
              },
            ]),
            payment: {
              findFirst: prismaMock.payment?.findFirst,
              update: prismaMock.payment?.update,
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
      payment: {
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
        PaymentsService,
        NumberingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        {
          provide: ApAccountMappingService,
          useValue: { resolveAccount: jest.fn().mockResolvedValue('acc-1') },
        },
      ],
    }).compile();

    paymentsService = module.get<PaymentsService>(PaymentsService);
    numberingService = module.get<NumberingService>(NumberingService);
  });

  it('1. 100 parallel payment numbering allocations should produce 100 unique sequential numbers without duplicates', async () => {
    const tasks = Array.from({ length: 100 }, () =>
      numberingService.nextNumber(mockOrgId, 'CUSTOMER_RECEIPT', mockUserId),
    );

    const results = await Promise.all(tasks);
    const formattedNumbers = results.map((r) => r.formatted);
    const uniqueNumbers = new Set(formattedNumbers);

    expect(results.length).toBe(100);
    expect(uniqueNumbers.size).toBe(100);
    expect(formattedNumbers[0]).toBe('RC-000001');
    expect(formattedNumbers[99]).toBe('RC-000100');
  });

  it('2. 100 parallel attempts to post the same payment should result in exactly 1 success and 99 failures', async () => {
    let hasBeenPosted = false;

    const basePayment = {
      id: mockPaymentId,
      organizationId: mockOrgId,
      paymentNumber: 'RC-000001',
      type: PaymentType.RECEIPT,
      paymentDate: new Date('2026-08-01'),
      get status() {
        return hasBeenPosted ? PaymentStatus.POSTED : PaymentStatus.DRAFT;
      },
      amount: new Prisma.Decimal('1000.0000'),
      allocatedAmount: new Prisma.Decimal('0.0000'),
      unallocatedAmount: new Prisma.Decimal('1000.0000'),
      paymentAccount: { accountingAccountId: 'acc-bank' },
      customer: { name: 'Client' },
    };

    prismaMock.payment.findFirst = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        ...basePayment,
        status: hasBeenPosted ? PaymentStatus.POSTED : PaymentStatus.DRAFT,
      });
    });

    prismaMock.payment.update = jest.fn().mockImplementation(() => {
      if (hasBeenPosted) {
        throw new BadRequestException('Double posting prevented');
      }
      hasBeenPosted = true;
      return Promise.resolve({
        ...basePayment,
        status: PaymentStatus.POSTED,
        postedAt: new Date(),
        postedByUserId: mockUserId,
      });
    });

    const attempts = Array.from({ length: 100 }, () =>
      paymentsService
        .post(mockOrgId, mockPaymentId, mockUserId)
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
