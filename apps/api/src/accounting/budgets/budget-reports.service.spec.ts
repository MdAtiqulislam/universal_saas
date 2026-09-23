import { Test, TestingModule } from '@nestjs/testing';
import { BudgetReportsService } from './budget-reports.service';
import { BudgetVsActualService } from './budget-vs-actual.service';

describe('BudgetReportsService', () => {
  let service: BudgetReportsService;
  let vsActualService: any;

  const orgId = 'org-budget-test';

  beforeEach(async () => {
    vsActualService = {
      getVsActual: jest.fn().mockResolvedValue({
        budgetId: 'b-1',
        budgetNumber: 'BD-000001',
        budgetName: 'FY2026 Budget',
        fiscalYear: 2026,
        currency: 'USD',
        summary: {
          totalBudget: '150000.0000',
          totalActual: '120000.0000',
          totalVariance: '30000.0000',
          variancePercent: 20,
          utilizationPercent: 80,
          remainingAmount: '30000.0000',
        },
        lines: [
          {
            lineId: 'l-1',
            accountId: 'acc-1',
            accountCode: '6010',
            accountName: 'Marketing',
            accountType: 'EXPENSE',
            category: 'MARKETING',
            period: '2026-01',
            budgetAmount: '50000.0000',
            actualAmount: '40000.0000',
            variance: '10000.0000',
            variancePercent: 20,
            utilizationPercent: 80,
            remainingAmount: '10000.0000',
          },
          {
            lineId: 'l-2',
            accountId: 'acc-2',
            accountCode: '6020',
            accountName: 'Software Licenses',
            accountType: 'EXPENSE',
            category: 'ADMINISTRATION',
            period: '2026-01',
            budgetAmount: '100000.0000',
            actualAmount: '80000.0000',
            variance: '20000.0000',
            variancePercent: 20,
            utilizationPercent: 80,
            remainingAmount: '20000.0000',
          },
        ],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetReportsService,
        { provide: BudgetVsActualService, useValue: vsActualService },
      ],
    }).compile();

    service = module.get<BudgetReportsService>(BudgetReportsService);
  });

  it('should generate budget summary report', async () => {
    const res = await service.getBudgetSummary(orgId, 'b-1');
    expect(res.budgetId).toBe('b-1');
    expect(res.summary.totalBudget).toBe('150000.0000');
    expect(res.summary.totalActual).toBe('120000.0000');
  });

  it('should generate account budget report', async () => {
    const res = await service.getAccountBudgetReport(orgId, 'b-1', {});
    expect(res.accounts.length).toBe(2);
    expect(res.accounts[0].accountCode).toBe('6010');
    expect(res.accounts[0].budget).toBe('50000.0000');
  });

  it('should generate category budget report', async () => {
    const res = await service.getCategoryBudgetReport(orgId, 'b-1', {});
    expect(res.categories.length).toBe(2);
    expect(res.categories[0].category).toBe('MARKETING');
    expect(res.categories[1].category).toBe('ADMINISTRATION');
  });

  it('should generate period budget report', async () => {
    const res = await service.getPeriodBudgetReport(orgId, 'b-1', {});
    expect(res.periods.length).toBe(1);
    expect(res.periods[0].period).toBe('2026-01');
    expect(res.periods[0].budget).toBe('150000.0000');
  });
});
