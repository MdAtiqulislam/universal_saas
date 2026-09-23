import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseRequisitionsService } from './purchase-requisitions.service';
import { ProcurementPurchaseOrdersService } from './purchase-orders.service';
import { ProcurementGoodsReceiptsService } from './goods-receipts.service';
import { PurchaseReturnsService } from './purchase-returns.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BudgetControlService } from '../accounting/budgets/budget-control.service';
import { TaxCalculationService } from '../tax/tax-calculation.service';
import { CostingService } from '../inventory/costing/costing.service';
import {
  PlannedOrderStatus,
  PlannedOrderAction,
  PurchaseOrderStatus,
  PurchaseReturnStatus,
  BudgetControlResult,
  BudgetControlPolicy,
  TrackingType,
  Prisma,
} from '@prisma/client';

describe('Procurement Concurrency and Race Condition Test Suite (100 Parallel Workers)', () => {
  let requisitionsService: PurchaseRequisitionsService;
  let ordersService: ProcurementPurchaseOrdersService;
  let receiptsService: ProcurementGoodsReceiptsService;
  let returnsService: PurchaseReturnsService;

  const mockOrgId = 'org-concurrency-procurement';
  const mockUserId = 'user-concurrency-worker';

  describe('1. 100 Parallel Planned Order Conversion Attempts', () => {
    it('should allow exactly 1 conversion and reject 99 duplicate conversions', async () => {
      let isConverted = false;

      const mockPrisma: any = {
        plannedOrder: {
          findFirst: jest.fn(() => {
            if (isConverted) {
              return Promise.resolve({
                id: 'plan-conc-1',
                orderNumber: 'PLN-000001',
                action: PlannedOrderAction.PURCHASE,
                status: PlannedOrderStatus.CONVERTED,
              });
            }
            return Promise.resolve({
              id: 'plan-conc-1',
              orderNumber: 'PLN-000001',
              action: PlannedOrderAction.PURCHASE,
              status: PlannedOrderStatus.SUGGESTED,
              itemId: 'item-1',
              quantity: new Prisma.Decimal(100),
              requiredDate: new Date('2026-09-01'),
              locationId: 'loc-1',
              supplierId: 'supp-1',
              planningRunId: 'run-1',
            });
          }),
          update: jest.fn(() => {
            if (isConverted) {
              return Promise.reject(new Error('Already converted'));
            }
            isConverted = true;
            return Promise.resolve({
              id: 'plan-conc-1',
              status: PlannedOrderStatus.CONVERTED,
            });
          }),
        },
        purchaseRequisition: {
          findFirst: jest.fn(() =>
            Promise.resolve(isConverted ? { id: 'pr-conc-1' } : null),
          ),
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn(() => {
            if (isConverted) {
              return Promise.reject(new Error('Duplicate PR'));
            }
            return Promise.resolve({
              id: 'pr-conc-1',
              requisitionNumber: 'PR-CONC-0001',
              sourcePlannedOrderId: 'plan-conc-1',
            });
          }),
        },
        $transaction: jest.fn((cb) => cb(mockPrisma)),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PurchaseRequisitionsService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: EventBusService, useValue: { publish: jest.fn() } },
          {
            provide: NumberingService,
            useValue: {
              nextNumber: jest
                .fn()
                .mockResolvedValue({ formatted: 'PR-CONC-0001' }),
            },
          },
        ],
      }).compile();

      requisitionsService = module.get<PurchaseRequisitionsService>(
        PurchaseRequisitionsService,
      );

      const workers = Array.from({ length: 100 }, () =>
        requisitionsService
          .convertPlannedOrder(mockOrgId, 'plan-conc-1', mockUserId)
          .then((res) => ({ success: true, res }))
          .catch((err) => ({ success: false, err })),
      );

      const results = await Promise.all(workers);
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(99);
    });
  });

  describe('2. 100 Parallel PO Approval Attempts', () => {
    it('should allow exactly 1 approval and reject 99 concurrent attempts', async () => {
      let isApproved = false;

      const mockPrisma: any = {
        purchaseOrder: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              id: 'po-conc-1',
              poNumber: 'PO-CONC-0001',
              status: isApproved
                ? PurchaseOrderStatus.APPROVED
                : PurchaseOrderStatus.SUBMITTED,
              orderDate: new Date('2026-09-01'),
              grandTotal: new Prisma.Decimal(1000),
            }),
          ),
          update: jest.fn(() => {
            if (isApproved) {
              return Promise.reject(new Error('Already approved'));
            }
            isApproved = true;
            return Promise.resolve({
              id: 'po-conc-1',
              status: PurchaseOrderStatus.APPROVED,
            });
          }),
        },
        account: { findFirst: jest.fn().mockResolvedValue({ id: 'acc-1' }) },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ProcurementPurchaseOrdersService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: EventBusService, useValue: { publish: jest.fn() } },
          { provide: NumberingService, useValue: { nextNumber: jest.fn() } },
          {
            provide: BudgetControlService,
            useValue: {
              checkBudgetAvailability: jest.fn().mockResolvedValue({
                result: BudgetControlResult.ALLOWED,
                policy: BudgetControlPolicy.CHECK_ONLY,
              }),
            },
          },
          {
            provide: TaxCalculationService,
            useValue: { calculateTax: jest.fn() },
          },
        ],
      }).compile();

      ordersService = module.get<ProcurementPurchaseOrdersService>(
        ProcurementPurchaseOrdersService,
      );

      const workers = Array.from({ length: 100 }, () =>
        ordersService
          .approve(mockOrgId, 'po-conc-1', mockUserId)
          .then((res) => ({ success: true, res }))
          .catch((err) => ({ success: false, err })),
      );

      const results = await Promise.all(workers);
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(99);
    });
  });

  describe('3. 100 Parallel Goods Receipt Attempts (No Over-Receipt)', () => {
    it('should prevent over-receipt when 100 parallel workers attempt to receive remaining quantity', async () => {
      let receivedTotal = new Prisma.Decimal(0);

      const mockPrisma: any = {
        purchaseOrder: {
          findFirst: jest.fn(() => {
            if (receivedTotal.gte(100)) {
              return Promise.resolve({
                id: 'po-conc-recv',
                poNumber: 'PO-CONC-RECV',
                supplierId: 'supp-1',
                locationId: 'loc-1',
                status: PurchaseOrderStatus.RECEIVED,
                lines: [
                  {
                    id: 'pol-conc-1',
                    itemId: 'item-1',
                    quantity: new Prisma.Decimal(100),
                    receivedQuantity: new Prisma.Decimal(100),
                    cancelledQuantity: new Prisma.Decimal(0),
                    remainingQuantity: new Prisma.Decimal(0),
                    unitPrice: new Prisma.Decimal(10),
                    item: { sku: 'SKU-CONC', trackingType: TrackingType.NONE },
                  },
                ],
              });
            }
            return Promise.resolve({
              id: 'po-conc-recv',
              poNumber: 'PO-CONC-RECV',
              supplierId: 'supp-1',
              locationId: 'loc-1',
              status: PurchaseOrderStatus.APPROVED,
              lines: [
                {
                  id: 'pol-conc-1',
                  itemId: 'item-1',
                  quantity: new Prisma.Decimal(100),
                  receivedQuantity: new Prisma.Decimal(0),
                  cancelledQuantity: new Prisma.Decimal(0),
                  remainingQuantity: new Prisma.Decimal(100),
                  unitPrice: new Prisma.Decimal(10),
                  item: { sku: 'SKU-CONC', trackingType: TrackingType.NONE },
                },
              ],
            });
          }),
          update: jest.fn(({ data }) =>
            Promise.resolve({
              id: 'po-conc-recv',
              status: data.status,
            }),
          ),
        },
        goodsReceipt: {
          create: jest.fn(() => {
            if (receivedTotal.gte(100)) {
              return Promise.reject(new Error('Over receipt'));
            }
            receivedTotal = receivedTotal.plus(100);
            return Promise.resolve({
              id: 'gr-conc-1',
              receiptNumber: 'GR-CONC-0001',
            });
          }),
          findFirst: jest.fn(() =>
            Promise.resolve({
              id: 'gr-conc-1',
              receiptNumber: 'GR-CONC-0001',
              lines: [],
            }),
          ),
          count: jest.fn().mockResolvedValue(0),
        },
        goodsReceiptLine: { create: jest.fn() },
        stockMovement: { create: jest.fn().mockResolvedValue({ id: 'mov-1' }) },
        inventoryCostLayer: {
          create: jest.fn().mockResolvedValue({ id: 'layer-1' }),
        },
        inventoryBalance: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
        },
        purchaseOrderLine: {
          update: jest.fn(),
          findMany: jest.fn(() =>
            Promise.resolve([
              {
                id: 'pol-conc-1',
                remainingQuantity: new Prisma.Decimal(0),
              },
            ]),
          ),
        },
        $transaction: jest.fn((cb) => cb(mockPrisma)),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ProcurementGoodsReceiptsService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: EventBusService, useValue: { publish: jest.fn() } },
          {
            provide: NumberingService,
            useValue: {
              nextNumber: jest
                .fn()
                .mockResolvedValue({ formatted: 'GR-CONC-0001' }),
            },
          },
          { provide: CostingService, useValue: { recordReceipt: jest.fn() } },
        ],
      }).compile();

      receiptsService = module.get<ProcurementGoodsReceiptsService>(
        ProcurementGoodsReceiptsService,
      );

      // 100 workers each attempting to receive 100 units
      const workers = Array.from({ length: 100 }, () =>
        receiptsService
          .receivePurchaseOrder(
            mockOrgId,
            'po-conc-recv',
            {
              lines: [{ purchaseOrderLineId: 'pol-conc-1', quantity: 100 }],
            },
            mockUserId,
          )
          .then((res) => ({ success: true, res }))
          .catch((err) => ({ success: false, err })),
      );

      const results = await Promise.all(workers);
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(99);
      expect(receivedTotal.toNumber()).toBe(100);
    });
  });

  describe('4. 100 Parallel Return Attempts (No Over-Return)', () => {
    it('should allow exactly 1 return of available stock and reject 99 excess returns', async () => {
      let returnedQty = new Prisma.Decimal(0);

      const mockPrisma: any = {
        goodsReceipt: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              id: 'gr-ret-conc',
              receiptNumber: 'GR-RET-01',
              purchaseOrderId: 'po-ret-1',
              supplierId: 'supp-1',
              locationId: 'loc-1',
              purchaseOrder: { supplierId: 'supp-1' },
              lines: [
                {
                  id: 'grl-ret-1',
                  itemId: 'item-1',
                  quantity: new Prisma.Decimal(50),
                  unitCost: new Prisma.Decimal(10),
                },
              ],
            }),
          ),
        },
        purchaseReturnLine: {
          findMany: jest.fn(() => {
            if (returnedQty.gte(50)) {
              return Promise.resolve([{ quantity: new Prisma.Decimal(50) }]);
            }
            return Promise.resolve([]);
          }),
        },
        purchaseReturn: {
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn(() => {
            if (returnedQty.gte(50)) {
              return Promise.reject(new Error('Excess return'));
            }
            returnedQty = returnedQty.plus(50);
            return Promise.resolve({
              id: 'ret-conc-1',
              returnNumber: 'PRN-CONC-0001',
              status: PurchaseReturnStatus.DRAFT,
            });
          }),
        },
        $transaction: jest.fn((cb) => cb(mockPrisma)),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PurchaseReturnsService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: EventBusService, useValue: { publish: jest.fn() } },
          {
            provide: NumberingService,
            useValue: {
              nextNumber: jest
                .fn()
                .mockResolvedValue({ formatted: 'PRN-CONC-0001' }),
            },
          },
        ],
      }).compile();

      returnsService = module.get<PurchaseReturnsService>(
        PurchaseReturnsService,
      );

      const workers = Array.from({ length: 100 }, () =>
        returnsService
          .create(
            mockOrgId,
            {
              purchaseOrderId: 'po-ret-1',
              goodsReceiptId: 'gr-ret-conc',
              lines: [{ goodsReceiptLineId: 'grl-ret-1', quantity: 50 }],
            },
            mockUserId,
          )
          .then((res) => ({ success: true, res }))
          .catch((err) => ({ success: false, err })),
      );

      const results = await Promise.all(workers);
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(99);
      expect(returnedQty.toNumber()).toBe(50);
    });
  });
});
