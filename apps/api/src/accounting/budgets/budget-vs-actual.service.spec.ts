import { Test, TestingModule } from '@nestjs/testing';
import { BudgetVsActualService } from './budget-vs-actual.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, AccountType } from '@prisma/client';

describe('BudgetVsActualService', () => {
  let service: BudgetVsActualService;
  let prisma: any;

  const orgId = 'org-budget-test';

  beforeEach(async () => {
    prisma = {
      budget: {
        findFirst: jest.fn(),
      },
      journalLine: {
        findMany: jest.fn(),
      },
      account: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetVsActualService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<BudgetVsActualService>(BudgetVsActualService);
  });

  it('should calculate Budget vs Actual accurately from posted General Ledger entries', async () => {
    // Budget: 100,000 for Marketing Expense. Actual: Debit 80,000 - Credit 5,000 = 75,000.
    // Variance = 100,000 - 75,000 = 25,000 (Positive: under budget). Utilization = 75%.
    prisma.budget.findFirst.mockResolvedValue({
      id: 'b-1',
      organizationId: orgId,
      budgetNumber: 'BD-000001',
      name: 'FY2026 Budget',
      fiscalYear: 2026,
      currency: { code: 'USD' },
      lines: [
        {
          id: 'line-1',
          accountId: 'acc-marketing',
          category: 'MARKETING',
          period: '2026-01',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
          amount: new Prisma.Decimal(100000),
          account: {
            id: 'acc-marketing',
            code: '6010',
            name: 'Marketing Expense',
            type: AccountType.EXPENSE,
          },
        },
      ],
    });

    prisma.journalLine.findMany.mockResolvedValue([
      {
        debit: new Prisma.Decimal(80000),
        credit: new Prisma.Decimal(0),
      },
      {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(5000),
      },
    ]);

    const res = await service.getVsActual(orgId, 'b-1', {});

    expect(res.summary.totalBudget).toBe('100000.0000');
    expect(res.summary.totalActual).toBe('75000.0000');
    expect(res.summary.totalVariance).toBe('25000.0000');
    expect(res.summary.variancePercent).toBe(25);
    expect(res.summary.utilizationPercent).toBe(75);
    expect(res.summary.remainingAmount).toBe('25000.0000');
  });

  it('should calculate revenue accounts properly (Credit - Debit)', async () => {
    // Budget: 500,000 for Sales Revenue. Actual: Credit 550,000.
    // Variance = 500,000 - 550,000 = -50,000.
    prisma.budget.findFirst.mockResolvedValue({
      id: 'b-rev',
      organizationId: orgId,
      budgetNumber: 'BD-000002',
      name: 'Revenue Budget',
      fiscalYear: 2026,
      currency: { code: 'USD' },
      lines: [
        {
          id: 'line-rev',
          accountId: 'acc-sales',
          category: 'SALES',
          period: '2026-01',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
          amount: new Prisma.Decimal(500000),
          account: {
            id: 'acc-sales',
            code: '4010',
            name: 'Sales Revenue',
            type: AccountType.REVENUE,
          },
        },
      ],
    });

    prisma.journalLine.findMany.mockResolvedValue([
      {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(550000),
      },
    ]);

    const res = await service.getVsActual(orgId, 'b-rev', {});

    expect(res.lines[0].actualAmount).toBe('550000.0000');
    expect(res.lines[0].variance).toBe('-50000.0000');
    expect(res.lines[0].utilizationPercent).toBe(110);
  });

  it('should provide journal transaction drill-down for an account', async () => {
    prisma.budget.findFirst.mockResolvedValue({
      id: 'b-1',
      budgetNumber: 'BD-000001',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      lines: [
        {
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
        },
      ],
    });

    prisma.account.findFirst.mockResolvedValue({
      id: 'acc-marketing',
      code: '6010',
      name: 'Marketing Expense',
      type: AccountType.EXPENSE,
    });

    prisma.journalLine.findMany.mockResolvedValue([
      {
        journalEntryId: 'je-1',
        description: 'Facebook Ads',
        debit: new Prisma.Decimal(5000),
        credit: new Prisma.Decimal(0),
        journalEntry: {
          entryNumber: 'JE-0001',
          entryDate: new Date('2026-01-10'),
          description: 'January Ads',
          sourceType: 'SUPPLIER_INVOICE',
          sourceId: 'inv-1',
        },
      },
    ]);

    const res = await service.getDrillDown(
      orgId,
      'b-1',
      'acc-marketing',
      '2026-01',
    );

    expect(res.transactions.length).toBe(1);
    expect(res.totalActual).toBe('5000.0000');
    expect(res.transactions[0].entryNumber).toBe('JE-0001');
  });
});
