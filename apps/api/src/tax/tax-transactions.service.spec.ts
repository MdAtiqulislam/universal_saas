import { Test, TestingModule } from '@nestjs/testing';
import { TaxTransactionsService } from './tax-transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { BadRequestException } from '@nestjs/common';
import { TaxPeriodStatus, TaxScope, Prisma } from '@prisma/client';

describe('TaxTransactionsService', () => {
  let service: TaxTransactionsService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let mappingMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prismaMock = {
      taxPeriod: { findFirst: jest.fn() },
      taxTransaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      fiscalPeriod: { findFirst: jest.fn() },
      journalEntry: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    eventBusMock = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'JE-TAX-001' }),
    };
    mappingMock = {
      resolveAccount: jest.fn((_orgId, key) => `${key.toLowerCase()}-acc-id`),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxTransactionsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        { provide: ApAccountMappingService, useValue: mappingMock },
      ],
    }).compile();

    service = module.get<TaxTransactionsService>(TaxTransactionsService);
  });

  it('1. should record an output tax transaction idempotently', async () => {
    prismaMock.taxPeriod.findFirst.mockResolvedValue(null);
    prismaMock.taxTransaction.findUnique.mockResolvedValue(null);
    prismaMock.taxTransaction.create.mockImplementation((args: any) => ({
      id: 'tx-1',
      ...args.data,
    }));

    const result = await service.record(mockOrgId, {
      taxCodeId: 'code-vat-20',
      transactionDate: '2026-08-28',
      taxScope: TaxScope.OUTPUT,
      sourceType: 'CUSTOMER_INVOICE',
      sourceId: 'inv-100',
      sourceNumber: 'INV-000100',
      taxableAmount: 1000,
      taxRate: 0.2,
      taxAmount: 200,
    });

    expect(result.id).toBe('tx-1');
    expect(result.taxScope).toBe(TaxScope.OUTPUT);
    expect(result.taxAmount.toString()).toBe('200');
  });

  it('2. should reject tax transactions when the corresponding tax period is LOCKED', async () => {
    prismaMock.taxPeriod.findFirst.mockResolvedValue({
      id: 'period-locked',
      name: '2026-07',
      status: TaxPeriodStatus.LOCKED,
    });

    await expect(
      service.record(mockOrgId, {
        taxCodeId: 'code-vat-20',
        transactionDate: '2026-07-15',
        taxScope: TaxScope.OUTPUT,
        sourceType: 'CUSTOMER_INVOICE',
        sourceId: 'inv-101',
        taxableAmount: 500,
        taxRate: 0.2,
        taxAmount: 100,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should return existing tax transaction when called multiple times (idempotency)', async () => {
    prismaMock.taxPeriod.findFirst.mockResolvedValue(null);
    prismaMock.taxTransaction.findUnique.mockResolvedValue({
      id: 'tx-existing',
      sourceType: 'CUSTOMER_INVOICE',
      sourceId: 'inv-100',
      taxAmount: new Prisma.Decimal('200.0000'),
    });

    const result = await service.record(mockOrgId, {
      taxCodeId: 'code-vat-20',
      transactionDate: '2026-08-28',
      taxScope: TaxScope.OUTPUT,
      sourceType: 'CUSTOMER_INVOICE',
      sourceId: 'inv-100',
      taxableAmount: 1000,
      taxRate: 0.2,
      taxAmount: 200,
    });

    expect(result.id).toBe('tx-existing');
    expect(prismaMock.taxTransaction.create).not.toHaveBeenCalled();
  });
});
