import { Test, TestingModule } from '@nestjs/testing';
import { ProcurementGoodsReceiptsService } from './goods-receipts.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { CostingService } from '../inventory/costing/costing.service';
import { BadRequestException } from '@nestjs/common';
import {
  PurchaseOrderStatus,
  GoodsReceiptStatus,
  TrackingType,
  Prisma,
} from '@prisma/client';

describe('ProcurementGoodsReceiptsService', () => {
  let service: ProcurementGoodsReceiptsService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;
  let costingService: any;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';

  beforeEach(async () => {
    prisma = {
      purchaseOrder: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      purchaseOrderLine: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      goodsReceipt: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
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
      inventoryBatch: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inventorySerial: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    eventBus = { publish: jest.fn() };
    numberingService = { nextNumber: jest.fn() };
    costingService = { recordReceipt: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcurementGoodsReceiptsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: CostingService, useValue: costingService },
      ],
    }).compile();

    service = module.get<ProcurementGoodsReceiptsService>(
      ProcurementGoodsReceiptsService,
    );
  });

  describe('receivePurchaseOrder', () => {
    it('should receive partial PO quantity, update balance, movement, cost layer, and set status to PARTIALLY_RECEIVED', async () => {
      numberingService.nextNumber.mockResolvedValue({ formatted: 'GR-000001' });

      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        poNumber: 'PO-000001',
        supplierId: 'supp-1',
        locationId: 'loc-1',
        status: PurchaseOrderStatus.APPROVED,
        lines: [
          {
            id: 'pol-1',
            itemId: 'item-1',
            quantity: new Prisma.Decimal(100),
            receivedQuantity: new Prisma.Decimal(0),
            cancelledQuantity: new Prisma.Decimal(0),
            unitPrice: new Prisma.Decimal(25),
            item: { sku: 'SKU-1', trackingType: TrackingType.NONE },
          },
        ],
      });

      prisma.goodsReceipt.create.mockResolvedValue({
        id: 'gr-1',
        receiptNumber: 'GR-000001',
        status: GoodsReceiptStatus.POSTED,
      });

      prisma.stockMovement.create.mockResolvedValue({ id: 'mov-1' });
      prisma.inventoryCostLayer.create.mockResolvedValue({ id: 'layer-1' });
      prisma.inventoryBalance.findFirst.mockResolvedValue(null);

      prisma.purchaseOrderLine.findMany.mockResolvedValue([
        { id: 'pol-1', remainingQuantity: new Prisma.Decimal(60) },
      ]);

      prisma.goodsReceipt.findFirst.mockResolvedValue({
        id: 'gr-1',
        receiptNumber: 'GR-000001',
        status: GoodsReceiptStatus.POSTED,
        lines: [{ quantity: new Prisma.Decimal(40) }],
      });

      const res = await service.receivePurchaseOrder(
        mockOrgId,
        'po-1',
        {
          lines: [{ purchaseOrderLineId: 'pol-1', quantity: 40 }],
        },
        mockUserId,
      );

      expect(res?.receiptNumber).toBe('GR-000001');
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: PurchaseOrderStatus.PARTIALLY_RECEIVED },
        }),
      );
      expect(prisma.stockMovement.create).toHaveBeenCalled();
      expect(prisma.inventoryCostLayer.create).toHaveBeenCalled();
    });

    it('should complete PO fulfillment and set status to RECEIVED on full receipt', async () => {
      numberingService.nextNumber.mockResolvedValue({ formatted: 'GR-000002' });

      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        poNumber: 'PO-000001',
        supplierId: 'supp-1',
        locationId: 'loc-1',
        status: PurchaseOrderStatus.PARTIALLY_RECEIVED,
        lines: [
          {
            id: 'pol-1',
            itemId: 'item-1',
            quantity: new Prisma.Decimal(100),
            receivedQuantity: new Prisma.Decimal(40),
            cancelledQuantity: new Prisma.Decimal(0),
            unitPrice: new Prisma.Decimal(25),
            item: { sku: 'SKU-1', trackingType: TrackingType.NONE },
          },
        ],
      });

      prisma.goodsReceipt.create.mockResolvedValue({
        id: 'gr-2',
        receiptNumber: 'GR-000002',
        status: GoodsReceiptStatus.POSTED,
      });

      prisma.stockMovement.create.mockResolvedValue({ id: 'mov-2' });
      prisma.inventoryCostLayer.create.mockResolvedValue({ id: 'layer-2' });
      prisma.inventoryBalance.findFirst.mockResolvedValue({
        id: 'bal-1',
        quantityOnHand: new Prisma.Decimal(40),
      });

      prisma.purchaseOrderLine.findMany.mockResolvedValue([
        { id: 'pol-1', remainingQuantity: new Prisma.Decimal(0) },
      ]);

      prisma.goodsReceipt.findFirst.mockResolvedValue({
        id: 'gr-2',
        receiptNumber: 'GR-000002',
        status: GoodsReceiptStatus.POSTED,
        lines: [{ quantity: new Prisma.Decimal(60) }],
      });

      const res = await service.receivePurchaseOrder(
        mockOrgId,
        'po-1',
        {
          lines: [{ purchaseOrderLineId: 'pol-1', quantity: 60 }],
        },
        mockUserId,
      );

      expect(res?.receiptNumber).toBe('GR-000002');
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: PurchaseOrderStatus.RECEIVED },
        }),
      );
    });

    it('should reject over-receipt beyond remaining quantity', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({
        id: 'po-1',
        poNumber: 'PO-000001',
        status: PurchaseOrderStatus.APPROVED,
        lines: [
          {
            id: 'pol-1',
            itemId: 'item-1',
            quantity: new Prisma.Decimal(50),
            receivedQuantity: new Prisma.Decimal(0),
            cancelledQuantity: new Prisma.Decimal(0),
            unitPrice: new Prisma.Decimal(10),
            item: { sku: 'SKU-1', trackingType: TrackingType.NONE },
          },
        ],
      });

      await expect(
        service.receivePurchaseOrder(
          mockOrgId,
          'po-1',
          {
            lines: [{ purchaseOrderLineId: 'pol-1', quantity: 60 }],
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
