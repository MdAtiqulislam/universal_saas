import { Test, TestingModule } from '@nestjs/testing';
import { PeriodCloseEngineService } from './period-close-engine.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FiscalPeriodStatus,
  JournalEntryStatus,
  PeriodCloseCheckStatus,
  PeriodCloseRunStatus,
} from '@prisma/client';
import { Prisma } from '@prisma/client';

describe('PeriodCloseEngineService', () => {
  let service: PeriodCloseEngineService;
  let prismaMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockPeriodId = '22222222-2222-2222-2222-222222222222';
  const mockUserId = '33333333-3333-3333-3333-333333333333';

  const mockPeriod: any = {
    id: mockPeriodId,
    organizationId: mockOrgId,
    name: 'FY2026-Q1',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-03-31'),
    status: FiscalPeriodStatus.OPEN,
  };

  beforeEach(async () => {
    prismaMock = {
      periodCloseRun: {
        create: jest.fn().mockResolvedValue({ id: 'run-1' }),
        update: jest.fn().mockResolvedValue({ id: 'run-1' }),
      },
      periodCloseCheck: {
        createMany: jest.fn().mockResolvedValue({ count: 11 }),
      },
      journalLine: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      journalEntry: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      supplierInvoice: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      customerInvoice: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      goodsReceipt: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      deliveryOrder: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      payment: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      taxTransaction: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      payrollRun: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      fixedAsset: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      assetDepreciationEntry: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      costOfGoodsSoldRecord: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      inventoryCostLayer: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      inventoryTransaction: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeriodCloseEngineService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<PeriodCloseEngineService>(PeriodCloseEngineService);
  });

  it('1. should evaluate all 11 close checks and return PASSED when healthy', async () => {
    const result = await service.evaluateAllChecks(
      mockOrgId,
      mockPeriod,
      mockUserId,
    );

    expect(result.status).toBe(PeriodCloseRunStatus.PASSED);
    expect(result.canClose).toBe(true);
    expect(result.checks.length).toBe(11);
    expect(
      result.checks.every((c) => c.status === PeriodCloseCheckStatus.PASSED),
    ).toBe(true);
  });

  it('2. should fail Trial Balance check when Debits != Credits', async () => {
    prismaMock.journalLine.findMany.mockResolvedValueOnce([
      { debit: new Prisma.Decimal(1000), credit: new Prisma.Decimal(0) },
      { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(800) }, // 200 diff
    ]);

    const result = await service.evaluateAllChecks(
      mockOrgId,
      mockPeriod,
      mockUserId,
    );

    expect(result.status).toBe(PeriodCloseRunStatus.FAILED);
    expect(result.canClose).toBe(false);
    const tbCheck = result.checks.find((c) => c.checkType === 'TRIAL_BALANCE');
    expect(tbCheck?.status).toBe(PeriodCloseCheckStatus.FAILED);
  });

  it('3. should fail Unbalanced Draft Journals check when unposted draft exists', async () => {
    prismaMock.journalEntry.findMany.mockResolvedValueOnce([
      {
        id: 'draft-1',
        entryNumber: 'JE-0001',
        status: JournalEntryStatus.DRAFT,
        lines: [
          { debit: new Prisma.Decimal(100), credit: new Prisma.Decimal(0) },
          { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(50) },
        ],
      },
    ]);

    const result = await service.evaluateAllChecks(
      mockOrgId,
      mockPeriod,
      mockUserId,
    );

    expect(result.status).toBe(PeriodCloseRunStatus.FAILED);
    expect(result.canClose).toBe(false);
    const draftCheck = result.checks.find(
      (c) => c.checkType === 'UNBALANCED_JOURNALS',
    );
    expect(draftCheck?.status).toBe(PeriodCloseCheckStatus.FAILED);
    expect(draftCheck?.affectedCount).toBe(1);
  });

  it('4. should flag Unposted Transactions when unposted goods receipts exist', async () => {
    prismaMock.journalEntry.count.mockResolvedValue(2); // 2 draft journals

    const result = await service.evaluateAllChecks(
      mockOrgId,
      mockPeriod,
      mockUserId,
    );

    expect(result.status).toBe(PeriodCloseRunStatus.FAILED);
    expect(result.canClose).toBe(false);
    const unpostedCheck = result.checks.find(
      (c) => c.checkType === 'UNPOSTED_TRANSACTIONS',
    );
    expect(unpostedCheck?.status).toBe(PeriodCloseCheckStatus.FAILED);
  });
});
