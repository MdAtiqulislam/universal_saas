import { Test, TestingModule } from '@nestjs/testing';
import { BudgetControlService } from './budget-control.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import {
  Prisma,
  AccountType,
  BudgetStatus,
  BudgetControlPolicy,
  BudgetControlResult,
} from '@prisma/client';

describe('BudgetControlService', () => {
  let service: BudgetControlService;
  let prisma: any;
  let eventBus: any;

  const orgId = 'org-budget-test';
  const userId = 'user-test';

  beforeEach(async () => {
    prisma = {
      budget: {
        findFirst: jest.fn(),
      },
      budgetLine: {
        findFirst: jest.fn(),
      },
      journalLine: {
        findMany: jest.fn(),
      },
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetControlService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get<BudgetControlService>(BudgetControlService);
  });

  it('should return ALLOWED when proposed expense is well within budget', async () => {
    // Budget: 10,000, Actual: 4,000, Proposed: 2,000 => Available: 6,000, Projected: 6,000 (60%)
    prisma.budget.findFirst.mockResolvedValue({
      id: 'b-1',
      organizationId: orgId,
      budgetNumber: 'BD-000001',
      status: BudgetStatus.ACTIVE,
      controlPolicy: BudgetControlPolicy.BLOCK,
      warnThresholdPercent: new Prisma.Decimal(90),
    });

    prisma.budgetLine.findFirst.mockResolvedValue({
      id: 'line-1',
      accountId: 'acc-exp',
      amount: new Prisma.Decimal(10000),
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-31'),
      period: '2026-08',
      account: { id: 'acc-exp', type: AccountType.EXPENSE },
    });

    prisma.journalLine.findMany.mockResolvedValue([
      { debit: new Prisma.Decimal(4000), credit: new Prisma.Decimal(0) },
    ]);

    const res = await service.checkBudgetAvailability(
      orgId,
      {
        accountId: 'acc-exp',
        amount: 2000,
        date: '2026-08-15',
      },
      userId,
    );

    expect(res.result).toBe(BudgetControlResult.ALLOWED);
    expect(res.availableRemaining).toBe('6000.0000');
    expect(res.projectedUtilizationPercentage).toBe(60);
  });

  it('should return WARNING when projected expense crosses warning threshold (>=90%)', async () => {
    // Budget: 10,000, Actual: 8,000, Proposed: 1,500 => Projected: 9,500 (95% >= 90%)
    prisma.budget.findFirst.mockResolvedValue({
      id: 'b-1',
      budgetNumber: 'BD-000001',
      status: BudgetStatus.ACTIVE,
      controlPolicy: BudgetControlPolicy.WARN,
      warnThresholdPercent: new Prisma.Decimal(90),
    });

    prisma.budgetLine.findFirst.mockResolvedValue({
      id: 'line-1',
      accountId: 'acc-exp',
      amount: new Prisma.Decimal(10000),
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-31'),
      period: '2026-08',
      account: { id: 'acc-exp', type: AccountType.EXPENSE },
    });

    prisma.journalLine.findMany.mockResolvedValue([
      { debit: new Prisma.Decimal(8000), credit: new Prisma.Decimal(0) },
    ]);

    const res = await service.checkBudgetAvailability(
      orgId,
      {
        accountId: 'acc-exp',
        amount: 1500,
        date: '2026-08-15',
      },
      userId,
    );

    expect(res.result).toBe(BudgetControlResult.WARNING);
    expect(res.projectedUtilizationPercentage).toBe(95);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'BUDGET_THRESHOLD_REACHED' }),
    );
  });

  it('should return EXCEEDED when proposed expense exceeds budget under BLOCK policy', async () => {
    // Budget: 10,000, Actual: 9,000, Proposed: 2,000 => Projected: 11,000 (110%)
    prisma.budget.findFirst.mockResolvedValue({
      id: 'b-1',
      budgetNumber: 'BD-000001',
      status: BudgetStatus.ACTIVE,
      controlPolicy: BudgetControlPolicy.BLOCK,
      warnThresholdPercent: new Prisma.Decimal(90),
    });

    prisma.budgetLine.findFirst.mockResolvedValue({
      id: 'line-1',
      accountId: 'acc-exp',
      amount: new Prisma.Decimal(10000),
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-31'),
      period: '2026-08',
      account: { id: 'acc-exp', type: AccountType.EXPENSE },
    });

    prisma.journalLine.findMany.mockResolvedValue([
      { debit: new Prisma.Decimal(9000), credit: new Prisma.Decimal(0) },
    ]);

    const res = await service.checkBudgetAvailability(
      orgId,
      {
        accountId: 'acc-exp',
        amount: 2000,
        date: '2026-08-15',
      },
      userId,
    );

    expect(res.result).toBe(BudgetControlResult.EXCEEDED);
    expect(res.availableRemaining).toBe('1000.0000');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'BUDGET_EXCEEDED' }),
    );
  });
});
