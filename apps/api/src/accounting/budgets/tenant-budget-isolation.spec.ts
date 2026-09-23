import { Test, TestingModule } from '@nestjs/testing';
import { BudgetsService } from './budgets.service';
import { BudgetVsActualService } from './budget-vs-actual.service';
import { BudgetControlService } from './budget-control.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { NotFoundException } from '@nestjs/common';

describe('Tenant Isolation — Budgeting & Financial Planning (M23)', () => {
  let budgetsService: BudgetsService;
  let vsActualService: BudgetVsActualService;
  let controlService: BudgetControlService;
  let prisma: any;

  const orgA = 'org-tenant-a';
  const orgB = 'org-tenant-b';
  const userA = 'user-a';

  beforeEach(async () => {
    prisma = {
      budget: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      budgetLine: {
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      account: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      currency: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cur-usd' }),
      },
      journalLine: {
        findMany: jest.fn().mockResolvedValue([]),
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
        BudgetVsActualService,
        BudgetControlService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
      ],
    }).compile();

    budgetsService = module.get<BudgetsService>(BudgetsService);
    vsActualService = module.get<BudgetVsActualService>(BudgetVsActualService);
    controlService = module.get<BudgetControlService>(BudgetControlService);
  });

  it('1. Org A cannot read Org B budgets', async () => {
    prisma.budget.findFirst.mockResolvedValue(null);
    await expect(budgetsService.findOne(orgA, `b-${orgB}`)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('2. Org A cannot update Org B budgets', async () => {
    prisma.budget.findFirst.mockResolvedValue(null);
    await expect(
      budgetsService.update(orgA, `b-${orgB}`, { name: 'Hacked' }, userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('3. Org A cannot delete Org B budgets', async () => {
    prisma.budget.findFirst.mockResolvedValue(null);
    await expect(budgetsService.delete(orgA, `b-${orgB}`)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('4. Org A cannot submit Org B budgets', async () => {
    prisma.budget.findFirst.mockResolvedValue(null);
    await expect(
      budgetsService.submit(orgA, `b-${orgB}`, userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('5. Org A cannot approve Org B budgets', async () => {
    prisma.budget.findFirst.mockResolvedValue(null);
    await expect(
      budgetsService.approve(orgA, `b-${orgB}`, userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('6. Org A cannot activate Org B budgets', async () => {
    prisma.budget.findFirst.mockResolvedValue(null);
    await expect(
      budgetsService.activate(orgA, `b-${orgB}`, userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('7. Org A cannot close Org B budgets', async () => {
    prisma.budget.findFirst.mockResolvedValue(null);
    await expect(
      budgetsService.close(orgA, `b-${orgB}`, userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('8. Org A cannot cancel Org B budgets', async () => {
    prisma.budget.findFirst.mockResolvedValue(null);
    await expect(
      budgetsService.cancel(orgA, `b-${orgB}`, userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('9. Org A cannot create budget referencing Org B accounts', async () => {
    prisma.account.findMany.mockResolvedValue([]); // Account not found in Org A
    await expect(
      budgetsService.create(
        orgA,
        {
          name: 'Cross Tenant Budget',
          fiscalYear: 2026,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          currencyId: 'cur-usd',
          lines: [
            {
              accountId: `acc-${orgB}`,
              period: '2026-01',
              startDate: '2026-01-01',
              endDate: '2026-01-31',
              amount: 5000,
            },
          ],
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('10. Org A cannot run budget-control checks against Org B budgets', async () => {
    prisma.budget.findFirst.mockResolvedValue(null);
    await expect(
      controlService.checkBudgetAvailability(
        orgA,
        {
          budgetId: `b-${orgB}`,
          accountId: 'acc-1',
          amount: 500,
          date: '2026-08-15',
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('11. Org A cannot query budget vs actual for Org B budgets', async () => {
    prisma.budget.findFirst.mockResolvedValue(null);
    await expect(
      vsActualService.getVsActual(orgA, `b-${orgB}`, {}),
    ).rejects.toThrow(NotFoundException);
  });
});
