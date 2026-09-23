import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseRequisitionsService } from './purchase-requisitions.service';
import { ProcurementPurchaseOrdersService } from './purchase-orders.service';
import { ProcurementGoodsReceiptsService } from './goods-receipts.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BudgetControlService } from '../accounting/budgets/budget-control.service';
import { TaxCalculationService } from '../tax/tax-calculation.service';
import { CostingService } from '../inventory/costing/costing.service';
import {
  PlannedOrderStatus,
  PlannedOrderAction,
  PurchaseRequisitionStatus,
  PurchaseOrderStatus,
  GoodsReceiptStatus,
  TrackingType,
  BudgetControlResult,
  BudgetControlPolicy,
  Prisma,
} from '@prisma/client';

describe('MRP to Procurement End-to-End Integration', () => {
  let requisitionsService: PurchaseRequisitionsService;
  let ordersService: ProcurementPurchaseOrdersService;
  let receiptsService: ProcurementGoodsReceiptsService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;
  let budgetControlService: any;

  const mockOrgId = 'org-mrp-procurement';
  const mockUserId = 'user-procurement-lead';

  beforeEach(async () => {
    prisma = {
      plannedOrder: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      purchaseRequisition: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      purchaseOrder: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      purchaseOrderLine: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      goodsReceipt: {
        create: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      goodsReceiptLine: {
        create: jest.fn(),
      },
      stockMovement: {
        create: jest.fn(),
      },
      inventoryBalance: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inventoryCostLayer: {
        create: jest.fn(),
      },
      supplier: { findFirst: jest.fn() },
      location: { findFirst: jest.fn() },
      currency: { findFirst: jest.fn() },
      account: { findFirst: jest.fn() },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    eventBus = { publish: jest.fn() };
    numberingService = {
      nextNumber: jest.fn((org, type) => {
        if (type === 'PURCHASE_REQUISITION') return { formatted: 'PR-000001' };
        if (type === 'PURCHASE_ORDER') return { formatted: 'PO-000001' };
        if (type === 'GOODS_RECEIPT') return { formatted: 'GR-000001' };
        return { formatted: 'DOC-000001' };
      }),
    };
    budgetControlService = { checkBudgetAvailability: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseRequisitionsService,
        ProcurementPurchaseOrdersService,
        ProcurementGoodsReceiptsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: BudgetControlService, useValue: budgetControlService },
        {
          provide: TaxCalculationService,
          useValue: { calculateTax: jest.fn() },
        },
        { provide: CostingService, useValue: { recordReceipt: jest.fn() } },
      ],
    }).compile();

    requisitionsService = module.get<PurchaseRequisitionsService>(
      PurchaseRequisitionsService,
    );
    ordersService = module.get<ProcurementPurchaseOrdersService>(
      ProcurementPurchaseOrdersService,
    );
    receiptsService = module.get<ProcurementGoodsReceiptsService>(
      ProcurementGoodsReceiptsService,
    );
  });

  it('should execute full chain: MRP Planned Order -> PR -> PO -> Approve -> Acknowledge -> Goods Receipt', async () => {
    // 1. Convert M26 Planned Order -> PR
    prisma.plannedOrder.findFirst.mockResolvedValue({
      id: 'plan-101',
      orderNumber: 'PLN-000101',
      action: PlannedOrderAction.PURCHASE,
      status: PlannedOrderStatus.SUGGESTED,
      itemId: 'item-raw-1',
      quantity: new Prisma.Decimal(200),
      requiredDate: new Date('2026-09-15'),
      locationId: 'loc-main',
      supplierId: 'supp-apex',
      supplier: { id: 'supp-apex', currencyId: 'curr-usd' },
      planningRunId: 'run-mrp-1',
    });

    prisma.purchaseRequisition.findFirst.mockResolvedValueOnce(null); // no existing PR

    prisma.purchaseRequisition.create.mockResolvedValue({
      id: 'pr-101',
      requisitionNumber: 'PR-000001',
      status: PurchaseRequisitionStatus.DRAFT,
      sourcePlannedOrderId: 'plan-101',
      lines: [
        {
          id: 'prl-1',
          itemId: 'item-raw-1',
          quantity: new Prisma.Decimal(200),
        },
      ],
    });

    const pr = await requisitionsService.convertPlannedOrder(
      mockOrgId,
      'plan-101',
      mockUserId,
    );
    expect(pr.requisitionNumber).toBe('PR-000001');
    expect(prisma.plannedOrder.update).toHaveBeenCalledWith({
      where: { id: 'plan-101' },
      data: { status: PlannedOrderStatus.CONVERTED },
    });

    // 2. Approve PR
    prisma.purchaseRequisition.findFirst.mockResolvedValueOnce({
      id: 'pr-101',
      status: PurchaseRequisitionStatus.SUBMITTED,
    });
    prisma.purchaseRequisition.update.mockResolvedValueOnce({
      id: 'pr-101',
      status: PurchaseRequisitionStatus.APPROVED,
    });

    const approvedPr = await requisitionsService.approve(
      mockOrgId,
      'pr-101',
      mockUserId,
    );
    expect(approvedPr.status).toBe(PurchaseRequisitionStatus.APPROVED);

    // 3. Convert PR -> PO
    prisma.purchaseRequisition.findFirst.mockResolvedValueOnce({
      id: 'pr-101',
      organizationId: mockOrgId,
      requisitionNumber: 'PR-000001',
      status: PurchaseRequisitionStatus.APPROVED,
      supplierId: 'supp-apex',
      locationId: 'loc-main',
      currencyId: 'curr-usd',
      requiredDate: new Date('2026-09-15'),
      supplier: { id: 'supp-apex', currencyId: 'curr-usd' },
      lines: [
        {
          itemId: 'item-raw-1',
          quantity: new Prisma.Decimal(200),
          estimatedUnitPrice: new Prisma.Decimal(15),
          requiredDate: new Date('2026-09-15'),
        },
      ],
    });

    prisma.purchaseOrder.create.mockResolvedValue({
      id: 'po-101',
      poNumber: 'PO-000001',
      status: PurchaseOrderStatus.DRAFT,
      grandTotal: new Prisma.Decimal(3000),
      lines: [
        {
          id: 'pol-101',
          itemId: 'item-raw-1',
          quantity: new Prisma.Decimal(200),
          unitPrice: new Prisma.Decimal(15),
          remainingQuantity: new Prisma.Decimal(200),
        },
      ],
    });

    const po = await requisitionsService.convertToPO(
      mockOrgId,
      'pr-101',
      mockUserId,
    );
    expect(po.poNumber).toBe('PO-000001');

    // 4. Submit & Approve PO with Budget Control
    prisma.purchaseOrder.findFirst.mockResolvedValueOnce({
      id: 'po-101',
      poNumber: 'PO-000001',
      status: PurchaseOrderStatus.SUBMITTED,
      orderDate: new Date('2026-09-01'),
      grandTotal: new Prisma.Decimal(3000),
    });

    prisma.account.findFirst.mockResolvedValue({ id: 'acc-raw-materials' });
    budgetControlService.checkBudgetAvailability.mockResolvedValue({
      result: BudgetControlResult.ALLOWED,
      policy: BudgetControlPolicy.CHECK_ONLY,
    });

    prisma.purchaseOrder.update.mockResolvedValueOnce({
      id: 'po-101',
      status: PurchaseOrderStatus.APPROVED,
      approvedByUserId: mockUserId,
    });

    const approvedPo = await ordersService.approve(
      mockOrgId,
      'po-101',
      mockUserId,
    );
    expect(approvedPo.status).toBe(PurchaseOrderStatus.APPROVED);

    // 5. Acknowledge PO by Supplier
    prisma.purchaseOrder.findFirst.mockResolvedValueOnce({
      id: 'po-101',
      status: PurchaseOrderStatus.APPROVED,
    });

    prisma.purchaseOrder.update.mockResolvedValueOnce({
      id: 'po-101',
      status: PurchaseOrderStatus.ACKNOWLEDGED,
      confirmedDeliveryDate: new Date('2026-09-15'),
      confirmedQuantity: new Prisma.Decimal(200),
    });

    const ackPo = await ordersService.acknowledge(
      mockOrgId,
      'po-101',
      {
        supplierReference: 'CONF-APEX-9988',
        confirmedDeliveryDate: '2026-09-15',
        confirmedQuantity: 200,
      },
      mockUserId,
    );
    expect(ackPo.status).toBe(PurchaseOrderStatus.ACKNOWLEDGED);

    // 6. Receive Goods against PO
    prisma.purchaseOrder.findFirst.mockResolvedValueOnce({
      id: 'po-101',
      poNumber: 'PO-000001',
      supplierId: 'supp-apex',
      locationId: 'loc-main',
      status: PurchaseOrderStatus.ACKNOWLEDGED,
      lines: [
        {
          id: 'pol-101',
          itemId: 'item-raw-1',
          quantity: new Prisma.Decimal(200),
          receivedQuantity: new Prisma.Decimal(0),
          cancelledQuantity: new Prisma.Decimal(0),
          unitPrice: new Prisma.Decimal(15),
          item: { sku: 'RAW-001', trackingType: TrackingType.NONE },
        },
      ],
    });

    prisma.goodsReceipt.create.mockResolvedValue({
      id: 'gr-101',
      receiptNumber: 'GR-000001',
      status: GoodsReceiptStatus.POSTED,
    });

    prisma.stockMovement.create.mockResolvedValue({ id: 'mov-101' });
    prisma.inventoryCostLayer.create.mockResolvedValue({ id: 'layer-101' });
    prisma.inventoryBalance.findFirst.mockResolvedValue(null);

    prisma.purchaseOrderLine.findMany.mockResolvedValue([
      { id: 'pol-101', remainingQuantity: new Prisma.Decimal(0) },
    ]);

    prisma.goodsReceipt.findFirst.mockResolvedValue({
      id: 'gr-101',
      receiptNumber: 'GR-000001',
      status: GoodsReceiptStatus.POSTED,
      lines: [{ quantity: new Prisma.Decimal(200) }],
    });

    const receipt = await receiptsService.receivePurchaseOrder(
      mockOrgId,
      'po-101',
      {
        lines: [{ purchaseOrderLineId: 'pol-101', quantity: 200 }],
      },
      mockUserId,
    );

    expect(receipt?.receiptNumber).toBe('GR-000001');
    expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: PurchaseOrderStatus.RECEIVED },
      }),
    );
  });
});
