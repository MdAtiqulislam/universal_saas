import { Test, TestingModule } from '@nestjs/testing';
import { PayrollBudgetService } from './payroll-budget.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { BudgetControlService } from '../accounting/budgets/budget-control.service';
import { PayrollConfigService } from './payroll-config.service';
import { Prisma, BudgetControlResult } from '@prisma/client';

describe('PayrollBudgetService', () => {
  let service: PayrollBudgetService;
  let prisma: {
    payrollPeriod: { findFirst: jest.Mock };
    account: { findFirst: jest.Mock };
  };
  let eventBus: { publish: jest.Mock };
  let budgetControlService: { checkBudgetAvailability: jest.Mock };
  let configService: { getOrCreate: jest.Mock };

  const orgId = 'org-101';
  const userId = 'user-101';
  const periodId = 'period-101';

  beforeEach(async () => {
    prisma = {
      payrollPeriod: { findFirst: jest.fn() },
      account: { findFirst: jest.fn() },
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    budgetControlService = { checkBudgetAvailability: jest.fn() };
    configService = {
      getOrCreate: jest.fn().mockResolvedValue({
        payrollExpenseAccountId: 'acc-exp-1',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollBudgetService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: BudgetControlService, useValue: budgetControlService },
        { provide: PayrollConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<PayrollBudgetService>(PayrollBudgetService);
  });

  it('should check budget availability and emit warning if threshold reached', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue({
      id: periodId,
      organizationId: orgId,
      periodNumber: 'PR-000001',
      paymentDate: new Date('2026-01-31'),
      payrollRuns: [{ employerCost: new Prisma.Decimal(6400) }],
    });

    budgetControlService.checkBudgetAvailability.mockResolvedValue({
      hasBudget: true,
      result: BudgetControlResult.WARNING,
      policy: 'WARN',
      allocatedBudget: 10000,
      actualSpent: 3000,
      committedSpent: 0,
      requestedAmount: 6400,
      projectedTotal: 9400,
      availableRemaining: 600,
      utilizationPercentage: 94,
      thresholdPercentage: 80,
    });

    const res = await service.checkBudgetAvailability(
      orgId,
      { payrollPeriodId: periodId },
      userId,
    );

    expect(res.result).toBe(BudgetControlResult.WARNING);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'PAYROLL_BUDGET_WARNING' }),
    );
  });
});
