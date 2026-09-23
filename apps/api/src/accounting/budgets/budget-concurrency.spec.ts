import { Test, TestingModule } from '@nestjs/testing';
import { BudgetsService } from './budgets.service';
import { BudgetControlService } from './budget-control.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import {
  Prisma,
  BudgetStatus,
  BudgetControlPolicy,
  AccountType,
} from '@prisma/client';

describe('Budget Concurrency (M23)', () => {
  let budgetsService: BudgetsService;
  let controlService: BudgetControlService;
  let prisma: any;

  const orgId = 'org-concurrency-test';
  const userId = 'user-worker';

  beforeEach(async () => {
    let budgetStatus: BudgetStatus = BudgetStatus.SUBMITTED;

    prisma = {
      budget: {
        findFirst: jest.fn().mockImplementation(() => ({
          id: 'b-conc-1',
          organizationId: orgId,
          budgetNumber: 'BD-CONC-001',
          name: 'Concurrent Budget',
          fiscalYear: 2026,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: budgetStatus,
          controlPolicy: BudgetControlPolicy.BLOCK,
          warnThresholdPercent: new Prisma.Decimal(90),
          lines: [{ id: 'line-1' }],
        })),
        update: jest.fn().mockImplementation(({ data }) => {
          if (data.status) {
            budgetStatus = data.status;
          }
          return {
            id: 'b-conc-1',
            status: budgetStatus,
            lines: [],
          };
        }),
        updateMany: jest.fn(),
      },
      budgetLine: {
        findFirst: jest.fn().mockImplementation(() => ({
          id: 'line-1',
          organizationId: orgId,
          budgetId: 'b-conc-1',
          accountId: 'acc-exp',
          amount: new Prisma.Decimal(100000),
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          period: '2026',
          account: { id: 'acc-exp', type: AccountType.EXPENSE },
        })),
      },
      journalLine: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { debit: new Prisma.Decimal(20000), credit: new Prisma.Decimal(0) },
          ]),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'BD-001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        BudgetControlService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
      ],
    }).compile();

    budgetsService = module.get<BudgetsService>(BudgetsService);
    controlService = module.get<BudgetControlService>(BudgetControlService);
  });

  it('1. should handle 100 concurrent approval attempts with exactly 1 success', async () => {
    let approvalDone = false;
    prisma.budget.findFirst.mockImplementation(() => {
      if (approvalDone) {
        return {
          id: 'b-conc-1',
          organizationId: orgId,
          budgetNumber: 'BD-CONC-001',
          status: BudgetStatus.APPROVED,
          lines: [{ id: 'line-1' }],
        };
      }
      approvalDone = true;
      return {
        id: 'b-conc-1',
        organizationId: orgId,
        budgetNumber: 'BD-CONC-001',
        status: BudgetStatus.SUBMITTED,
        lines: [{ id: 'line-1' }],
      };
    });

    const attempts = Array.from({ length: 100 }, () =>
      budgetsService
        .approve(orgId, 'b-conc-1', userId)
        .then(() => ({ status: 'fulfilled' }))
        .catch((err) => ({ status: 'rejected', reason: err.message })),
    );

    const results = await Promise.all(attempts);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(99);
  });

  it('2. should handle 100 concurrent activation attempts with exactly 1 success', async () => {
    let activationDone = false;
    prisma.budget.findFirst.mockImplementation(() => {
      if (activationDone) {
        return {
          id: 'b-conc-1',
          organizationId: orgId,
          budgetNumber: 'BD-CONC-001',
          fiscalYear: 2026,
          status: BudgetStatus.ACTIVE,
          lines: [{ id: 'line-1' }],
        };
      }
      activationDone = true;
      return {
        id: 'b-conc-1',
        organizationId: orgId,
        budgetNumber: 'BD-CONC-001',
        fiscalYear: 2026,
        status: BudgetStatus.APPROVED,
        lines: [{ id: 'line-1' }],
      };
    });

    const attempts = Array.from({ length: 100 }, () =>
      budgetsService
        .activate(orgId, 'b-conc-1', userId)
        .then(() => ({ status: 'fulfilled' }))
        .catch((err) => ({ status: 'rejected', reason: err.message })),
    );

    const results = await Promise.all(attempts);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(99);
  });

  it('3. should handle 100 concurrent close attempts with exactly 1 success', async () => {
    let closeDone = false;
    prisma.budget.findFirst.mockImplementation(() => {
      if (closeDone) {
        return {
          id: 'b-conc-1',
          organizationId: orgId,
          status: BudgetStatus.CLOSED,
          lines: [],
        };
      }
      closeDone = true;
      return {
        id: 'b-conc-1',
        organizationId: orgId,
        status: BudgetStatus.ACTIVE,
        lines: [],
      };
    });

    const attempts = Array.from({ length: 100 }, () =>
      budgetsService
        .close(orgId, 'b-conc-1', userId)
        .then(() => ({ status: 'fulfilled' }))
        .catch((err) => ({ status: 'rejected', reason: err.message })),
    );

    const results = await Promise.all(attempts);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(99);
  });

  it('4. should handle 100 concurrent budget control checks consistently', async () => {
    const attempts = Array.from({ length: 100 }, () =>
      controlService.checkBudgetAvailability(
        orgId,
        {
          accountId: 'acc-exp',
          amount: 5000,
          date: '2026-06-15',
        },
        userId,
      ),
    );

    const results = await Promise.all(attempts);
    expect(results.length).toBe(100);
    for (const r of results) {
      expect(r.result).toBe('ALLOWED');
      expect(r.availableRemaining).toBe('80000.0000');
    }
  });
});
