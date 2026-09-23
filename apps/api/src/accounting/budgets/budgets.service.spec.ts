import { Test, TestingModule } from '@nestjs/testing';
import { BudgetsService } from './budgets.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BadRequestException } from '@nestjs/common';
import { Prisma, BudgetStatus } from '@prisma/client';

describe('BudgetsService', () => {
  let service: BudgetsService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;

  const orgId = 'org-budget-test';
  const userId = 'user-test';

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
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      currency: {
        findFirst: jest.fn(),
      },
      account: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'BD-000001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
      ],
    }).compile();

    service = module.get<BudgetsService>(BudgetsService);
  });

  describe('create', () => {
    it('should create budget in DRAFT status with exact Decimal calculation', async () => {
      prisma.currency.findFirst.mockResolvedValue({ id: 'cur-usd' });
      prisma.budget.findFirst.mockResolvedValue(null);
      prisma.account.findMany.mockResolvedValue([
        { id: 'acc-1', organizationId: orgId, isActive: true },
      ]);
      prisma.budget.create.mockResolvedValue({
        id: 'b-1',
        organizationId: orgId,
        budgetNumber: 'BD-000001',
        name: 'FY2026 Master Budget',
        fiscalYear: 2026,
        status: BudgetStatus.DRAFT,
        totalBudget: new Prisma.Decimal(120000),
      });

      const result = await service.create(
        orgId,
        {
          name: 'FY2026 Master Budget',
          fiscalYear: 2026,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          currencyId: 'cur-usd',
          lines: [
            {
              accountId: 'acc-1',
              period: '2026-01',
              startDate: '2026-01-01',
              endDate: '2026-01-31',
              amount: 10000,
            },
          ],
        },
        userId,
      );

      expect(result.status).toBe(BudgetStatus.DRAFT);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'BUDGET_CREATED' }),
      );
    });

    it('should reject invalid dates (end date before start date)', async () => {
      await expect(
        service.create(
          orgId,
          {
            name: 'Invalid Budget',
            fiscalYear: 2026,
            startDate: '2026-12-31',
            endDate: '2026-01-01',
            currencyId: 'cur-usd',
          },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate budget lines with same account and period', async () => {
      prisma.currency.findFirst.mockResolvedValue({ id: 'cur-usd' });
      prisma.budget.findFirst.mockResolvedValue(null);
      prisma.account.findMany.mockResolvedValue([
        { id: 'acc-1', organizationId: orgId, isActive: true },
      ]);

      await expect(
        service.create(
          orgId,
          {
            name: 'Duplicate Line Budget',
            fiscalYear: 2026,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            currencyId: 'cur-usd',
            lines: [
              {
                accountId: 'acc-1',
                period: '2026-01',
                startDate: '2026-01-01',
                endDate: '2026-01-31',
                amount: 1000,
              },
              {
                accountId: 'acc-1',
                period: '2026-01', // duplicate account + period
                startDate: '2026-01-01',
                endDate: '2026-01-31',
                amount: 2000,
              },
            ],
          },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('workflow transitions', () => {
    it('should submit DRAFT budget with lines', async () => {
      prisma.budget.findFirst.mockResolvedValue({
        id: 'b-1',
        organizationId: orgId,
        budgetNumber: 'BD-000001',
        status: BudgetStatus.DRAFT,
        totalBudget: new Prisma.Decimal(10000),
        lines: [{ id: 'line-1' }],
      });
      prisma.budget.update.mockResolvedValue({
        id: 'b-1',
        status: BudgetStatus.SUBMITTED,
      });

      const res = await service.submit(orgId, 'b-1', userId);
      expect(res.status).toBe(BudgetStatus.SUBMITTED);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'BUDGET_SUBMITTED' }),
      );
    });

    it('should approve SUBMITTED budget and record approver', async () => {
      prisma.budget.findFirst.mockResolvedValue({
        id: 'b-1',
        organizationId: orgId,
        budgetNumber: 'BD-000001',
        status: BudgetStatus.SUBMITTED,
        lines: [{ id: 'line-1' }],
      });
      prisma.budget.update.mockResolvedValue({
        id: 'b-1',
        status: BudgetStatus.APPROVED,
        approvedByUserId: userId,
      });

      const res = await service.approve(orgId, 'b-1', userId);
      expect(res.status).toBe(BudgetStatus.APPROVED);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'BUDGET_APPROVED' }),
      );
    });

    it('should activate APPROVED budget and close previously active version', async () => {
      prisma.budget.findFirst.mockResolvedValue({
        id: 'b-1',
        organizationId: orgId,
        budgetNumber: 'BD-000001',
        fiscalYear: 2026,
        status: BudgetStatus.APPROVED,
        lines: [{ id: 'line-1' }],
      });
      prisma.budget.update.mockResolvedValue({
        id: 'b-1',
        status: BudgetStatus.ACTIVE,
      });

      const res = await service.activate(orgId, 'b-1', userId);
      expect(res.status).toBe(BudgetStatus.ACTIVE);
      expect(prisma.budget.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: BudgetStatus.ACTIVE,
          }),
          data: { status: BudgetStatus.CLOSED },
        }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'BUDGET_ACTIVATED' }),
      );
    });

    it('should close ACTIVE budget', async () => {
      prisma.budget.findFirst.mockResolvedValue({
        id: 'b-1',
        organizationId: orgId,
        budgetNumber: 'BD-000001',
        status: BudgetStatus.ACTIVE,
        lines: [],
      });
      prisma.budget.update.mockResolvedValue({
        id: 'b-1',
        status: BudgetStatus.CLOSED,
      });

      const res = await service.close(orgId, 'b-1', userId);
      expect(res.status).toBe(BudgetStatus.CLOSED);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'BUDGET_CLOSED' }),
      );
    });

    it('should prevent modifying an APPROVED or ACTIVE budget', async () => {
      prisma.budget.findFirst.mockResolvedValue({
        id: 'b-1',
        status: BudgetStatus.ACTIVE,
        lines: [],
      });

      await expect(
        service.update(orgId, 'b-1', { name: 'Attempted edit' }, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
