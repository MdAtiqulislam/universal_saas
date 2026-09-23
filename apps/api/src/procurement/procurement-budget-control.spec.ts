import { Test, TestingModule } from '@nestjs/testing';
import { ProcurementPurchaseOrdersService } from './purchase-orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BudgetControlService } from '../accounting/budgets/budget-control.service';
import { TaxCalculationService } from '../tax/tax-calculation.service';
import { BadRequestException } from '@nestjs/common';
import {
  PurchaseOrderStatus,
  BudgetControlPolicy,
  BudgetControlResult,
  Prisma,
} from '@prisma/client';

describe('Procurement Budget Control Policy Enforcement', () => {
  let service: ProcurementPurchaseOrdersService;
  let prisma: any;
  let eventBus: any;
  let budgetControlService: any;

  const mockOrgId = 'org-budget-policy';
  const mockUserId = 'user-approver';

  beforeEach(async () => {
    prisma = {
      purchaseOrder: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      account: {
        findFirst: jest.fn().mockResolvedValue({ id: 'acc-budget-1' }),
      },
    };

    eventBus = { publish: jest.fn() };
    budgetControlService = { checkBudgetAvailability: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcurementPurchaseOrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: { nextNumber: jest.fn() } },
        { provide: BudgetControlService, useValue: budgetControlService },
        {
          provide: TaxCalculationService,
          useValue: { calculateTax: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ProcurementPurchaseOrdersService>(
      ProcurementPurchaseOrdersService,
    );
  });

  it('1. CHECK_ONLY policy: should approve PO even if budget is exceeded', async () => {
    prisma.purchaseOrder.findFirst.mockResolvedValue({
      id: 'po-chk',
      poNumber: 'PO-CHK-01',
      status: PurchaseOrderStatus.SUBMITTED,
      orderDate: new Date('2026-09-01'),
      grandTotal: new Prisma.Decimal(10000),
    });

    budgetControlService.checkBudgetAvailability.mockResolvedValue({
      result: BudgetControlResult.ALLOWED,
      policy: BudgetControlPolicy.CHECK_ONLY,
    });

    prisma.purchaseOrder.update.mockResolvedValue({
      id: 'po-chk',
      status: PurchaseOrderStatus.APPROVED,
    });

    const res = await service.approve(mockOrgId, 'po-chk', mockUserId);
    expect(res.status).toBe(PurchaseOrderStatus.APPROVED);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'PURCHASE_ORDER_BUDGET_CHECKED' }),
    );
  });

  it('2. WARN policy: should approve PO and log warning when budget is exceeded', async () => {
    prisma.purchaseOrder.findFirst.mockResolvedValue({
      id: 'po-warn',
      poNumber: 'PO-WRN-01',
      status: PurchaseOrderStatus.SUBMITTED,
      orderDate: new Date('2026-09-01'),
      grandTotal: new Prisma.Decimal(15000),
    });

    budgetControlService.checkBudgetAvailability.mockResolvedValue({
      result: BudgetControlResult.EXCEEDED,
      policy: BudgetControlPolicy.WARN,
      proposedAmount: '15000.0000',
      remainingAmount: '5000.0000',
    });

    prisma.purchaseOrder.update.mockResolvedValue({
      id: 'po-warn',
      status: PurchaseOrderStatus.APPROVED,
    });

    const res = await service.approve(mockOrgId, 'po-warn', mockUserId);
    expect(res.status).toBe(PurchaseOrderStatus.APPROVED);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'PURCHASE_ORDER_BUDGET_EXCEEDED' }),
    );
  });

  it('3. BLOCK policy: should reject PO approval when budget is exceeded', async () => {
    prisma.purchaseOrder.findFirst.mockResolvedValue({
      id: 'po-blk',
      poNumber: 'PO-BLK-01',
      status: PurchaseOrderStatus.SUBMITTED,
      orderDate: new Date('2026-09-01'),
      grandTotal: new Prisma.Decimal(25000),
    });

    budgetControlService.checkBudgetAvailability.mockResolvedValue({
      result: BudgetControlResult.EXCEEDED,
      policy: BudgetControlPolicy.BLOCK,
      proposedAmount: '25000.0000',
      remainingAmount: '2000.0000',
    });

    await expect(
      service.approve(mockOrgId, 'po-blk', mockUserId),
    ).rejects.toThrow(BadRequestException);

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'PURCHASE_ORDER_BUDGET_EXCEEDED' }),
    );
  });
});
