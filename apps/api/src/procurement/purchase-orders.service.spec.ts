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

describe('ProcurementPurchaseOrdersService', () => {
  let service: ProcurementPurchaseOrdersService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;
  let budgetControlService: any;
  let taxCalculationService: any;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';

  beforeEach(async () => {
    prisma = {
      supplier: { findFirst: jest.fn() },
      location: { findFirst: jest.fn() },
      account: { findFirst: jest.fn() },
      purchaseOrder: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      purchaseOrderLine: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    eventBus = { publish: jest.fn() };
    numberingService = { nextNumber: jest.fn() };
    budgetControlService = { checkBudgetAvailability: jest.fn() };
    taxCalculationService = { calculateTax: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcurementPurchaseOrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: BudgetControlService, useValue: budgetControlService },
        { provide: TaxCalculationService, useValue: taxCalculationService },
      ],
    }).compile();

    service = module.get<ProcurementPurchaseOrdersService>(
      ProcurementPurchaseOrdersService,
    );
  });

  describe('create', () => {
    it('should create a Purchase Order with exact Decimal calculations', async () => {
      numberingService.nextNumber.mockResolvedValue({ formatted: 'PO-000001' });
      prisma.supplier.findFirst.mockResolvedValue({
        id: 'supp-1',
        paymentTermsDays: 30,
      });
      prisma.location.findFirst.mockResolvedValue({ id: 'loc-1' });

      prisma.purchaseOrder.create.mockResolvedValue({
        id: 'po-1',
        poNumber: 'PO-000001',
        status: PurchaseOrderStatus.DRAFT,
        subtotal: new Prisma.Decimal(1000),
        taxTotal: new Prisma.Decimal(100),
        discountTotal: new Prisma.Decimal(50),
        shippingTotal: new Prisma.Decimal(20),
        grandTotal: new Prisma.Decimal(1070),
        lines: [{ id: 'pol-1' }],
      });

      const res = await service.create(
        mockOrgId,
        {
          supplierId: 'supp-1',
          locationId: 'loc-1',
          currencyId: 'curr-1',
          shippingTotal: 20,
          lines: [
            {
              itemId: 'item-1',
              quantity: 10,
              unitPrice: 100,
              discountAmount: 50,
              taxRate: 10,
            },
          ],
        },
        mockUserId,
      );

      expect(res.poNumber).toBe('PO-000001');
      expect(res.grandTotal.toNumber()).toBe(1070);
    });
  });

  describe('approve with Budget Control', () => {
    it('should approve PO when budget is available', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        poNumber: 'PO-000001',
        status: PurchaseOrderStatus.SUBMITTED,
        orderDate: new Date('2026-09-01'),
        grandTotal: new Prisma.Decimal(500),
      });

      prisma.account.findFirst.mockResolvedValue({ id: 'acc-expense' });

      budgetControlService.checkBudgetAvailability.mockResolvedValue({
        result: BudgetControlResult.ALLOWED,
        policy: BudgetControlPolicy.CHECK_ONLY,
      });

      prisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: PurchaseOrderStatus.APPROVED,
        approvedByUserId: mockUserId,
      });

      const res = await service.approve(mockOrgId, 'po-1', mockUserId);
      expect(res.status).toBe(PurchaseOrderStatus.APPROVED);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'PURCHASE_ORDER_APPROVED' }),
      );
    });

    it('should block PO approval when budget is exceeded and policy is BLOCK', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        poNumber: 'PO-000001',
        status: PurchaseOrderStatus.SUBMITTED,
        orderDate: new Date('2026-09-01'),
        grandTotal: new Prisma.Decimal(50000),
      });

      prisma.account.findFirst.mockResolvedValue({ id: 'acc-expense' });

      budgetControlService.checkBudgetAvailability.mockResolvedValue({
        result: BudgetControlResult.EXCEEDED,
        policy: BudgetControlPolicy.BLOCK,
        remainingAmount: '1000.0000',
        proposedAmount: '50000.0000',
      });

      await expect(
        service.approve(mockOrgId, 'po-1', mockUserId),
      ).rejects.toThrow(BadRequestException);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'PURCHASE_ORDER_BUDGET_EXCEEDED',
        }),
      );
    });
  });

  describe('acknowledgement and lifecycle', () => {
    it('should record supplier acknowledgement and transition to ACKNOWLEDGED', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        status: PurchaseOrderStatus.SENT,
      });

      prisma.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: PurchaseOrderStatus.ACKNOWLEDGED,
        supplierReference: 'SUPP-REF-99',
      });

      const res = await service.acknowledge(
        mockOrgId,
        'po-1',
        {
          supplierReference: 'SUPP-REF-99',
          confirmedDeliveryDate: '2026-09-15',
          confirmedQuantity: 100,
        },
        mockUserId,
      );

      expect(res.status).toBe(PurchaseOrderStatus.ACKNOWLEDGED);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'PURCHASE_ORDER_ACKNOWLEDGED' }),
      );
    });
  });
});
