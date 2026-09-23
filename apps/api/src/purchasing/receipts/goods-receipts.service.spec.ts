import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GoodsReceiptsService } from './goods-receipts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BalancesService } from '../../inventory/balances/balances.service';
import {
  GoodsReceiptStatus,
  PurchaseOrderStatus,
  StockMovementType,
  TrackingType,
  Prisma,
} from '@prisma/client';

describe('GoodsReceiptsService', () => {
  let service: GoodsReceiptsService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let balancesMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockLocationId = '22222222-2222-2222-2222-222222222222';
  const mockOrderId = '33333333-3333-3333-3333-333333333333';
  const mockPoLineId = '44444444-4444-4444-4444-444444444444';
  const mockItemId = '55555555-5555-5555-5555-555555555555';
  const mockReceiptId = '66666666-6666-6666-6666-666666666666';
  const mockUserId = '77777777-7777-7777-7777-777777777777';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      goodsReceipt: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      goodsReceiptLine: {
        createMany: jest.fn(),
      },
      purchaseOrder: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      purchaseOrderLine: {
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      location: {
        findFirst: jest.fn(),
      },
      inventoryBatch: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      inventorySerial: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({
        sequenceKey: 'GOODS_RECEIPT',
        number: 1,
        formatted: 'GR-000001',
      }),
    };

    balancesMock = {
      applyStockMovement: jest.fn().mockResolvedValue({
        movementId: 'mov-1',
        quantityOnHand: '50',
        quantityAvailable: '50',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoodsReceiptsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        { provide: BalancesService, useValue: balancesMock },
      ],
    }).compile();

    service = module.get<GoodsReceiptsService>(GoodsReceiptsService);
  });

  it('1. should create draft goods receipt with valid remaining quantities', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue({
      id: mockOrderId,
      poNumber: 'PO-000001',
      status: PurchaseOrderStatus.APPROVED,
      locationId: mockLocationId,
      lines: [
        {
          id: mockPoLineId,
          itemId: mockItemId,
          variantId: null,
          quantity: new Prisma.Decimal('10.0000'),
          receivedQuantity: new Prisma.Decimal('0.0000'),
          unitPrice: new Prisma.Decimal('15.0000'),
          item: { sku: 'ITEM-A', trackingType: TrackingType.NONE },
        },
      ],
    });
    prismaMock.location.findFirst.mockResolvedValue({ id: mockLocationId });
    prismaMock.goodsReceipt.create.mockResolvedValue({
      id: mockReceiptId,
      receiptNumber: 'GR-000001',
    });
    prismaMock.goodsReceipt.findUniqueOrThrow.mockResolvedValue({
      id: mockReceiptId,
      receiptNumber: 'GR-000001',
      status: GoodsReceiptStatus.DRAFT,
    });

    const result = await service.createDraft(
      mockOrgId,
      {
        purchaseOrderId: mockOrderId,
        lines: [
          {
            purchaseOrderLineId: mockPoLineId,
            quantity: 5,
          },
        ],
      },
      mockUserId,
    );

    expect(result.receiptNumber).toBe('GR-000001');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'GOODS_RECEIPT_CREATED',
      }),
    );
  });

  it('2. should reject draft creation if receipt quantity exceeds remaining PO quantity', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue({
      id: mockOrderId,
      poNumber: 'PO-000001',
      status: PurchaseOrderStatus.APPROVED,
      locationId: mockLocationId,
      lines: [
        {
          id: mockPoLineId,
          itemId: mockItemId,
          quantity: new Prisma.Decimal('10.0000'),
          receivedQuantity: new Prisma.Decimal('8.0000'),
          item: { sku: 'ITEM-A', trackingType: TrackingType.NONE },
        },
      ],
    });
    prismaMock.location.findFirst.mockResolvedValue({ id: mockLocationId });

    await expect(
      service.createDraft(
        mockOrgId,
        {
          purchaseOrderId: mockOrderId,
          lines: [
            {
              purchaseOrderLineId: mockPoLineId,
              quantity: 5, // exceeds remaining 2
            },
          ],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should post goods receipt, apply stock movement, and update PO to PARTIALLY_RECEIVED', async () => {
    prismaMock.goodsReceipt.findFirst.mockResolvedValue({
      id: mockReceiptId,
      organizationId: mockOrgId,
      receiptNumber: 'GR-000001',
      locationId: mockLocationId,
      status: GoodsReceiptStatus.DRAFT,
      purchaseOrder: {
        id: mockOrderId,
        poNumber: 'PO-000001',
        status: PurchaseOrderStatus.APPROVED,
      },
      lines: [
        {
          id: 'r-line-1',
          purchaseOrderLineId: mockPoLineId,
          itemId: mockItemId,
          variantId: null,
          quantity: new Prisma.Decimal('5.0000'),
          batchId: null,
          serialId: null,
        },
      ],
    });

    prismaMock.purchaseOrderLine.findUniqueOrThrow.mockResolvedValue({
      id: mockPoLineId,
      quantity: new Prisma.Decimal('10.0000'),
      receivedQuantity: new Prisma.Decimal('0.0000'),
    });

    prismaMock.purchaseOrderLine.findMany.mockResolvedValue([
      {
        id: mockPoLineId,
        quantity: new Prisma.Decimal('10.0000'),
        receivedQuantity: new Prisma.Decimal('5.0000'),
      },
    ]);

    prismaMock.goodsReceipt.findUniqueOrThrow.mockResolvedValue({
      id: mockReceiptId,
      receiptNumber: 'GR-000001',
      status: GoodsReceiptStatus.POSTED,
    });

    const result = await service.postReceipt(
      mockOrgId,
      mockReceiptId,
      mockUserId,
    );

    expect(result.status).toBe(GoodsReceiptStatus.POSTED);
    expect(balancesMock.applyStockMovement).toHaveBeenCalledWith(
      mockOrgId,
      expect.objectContaining({
        locationId: mockLocationId,
        itemId: mockItemId,
        movementType: StockMovementType.RECEIPT,
        quantity: 5,
        referenceType: 'GOODS_RECEIPT',
        referenceId: 'GR-000001',
      }),
      mockUserId,
      expect.anything(),
    );
    expect(prismaMock.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: PurchaseOrderStatus.PARTIALLY_RECEIVED },
      }),
    );
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'GOODS_RECEIPT_POSTED',
      }),
    );
  });

  it('4. should post goods receipt and update PO to RECEIVED when fully fulfilled', async () => {
    prismaMock.goodsReceipt.findFirst.mockResolvedValue({
      id: mockReceiptId,
      organizationId: mockOrgId,
      receiptNumber: 'GR-000001',
      locationId: mockLocationId,
      status: GoodsReceiptStatus.DRAFT,
      purchaseOrder: {
        id: mockOrderId,
        poNumber: 'PO-000001',
        status: PurchaseOrderStatus.PARTIALLY_RECEIVED,
      },
      lines: [
        {
          id: 'r-line-1',
          purchaseOrderLineId: mockPoLineId,
          itemId: mockItemId,
          variantId: null,
          quantity: new Prisma.Decimal('5.0000'),
          batchId: null,
          serialId: null,
        },
      ],
    });

    prismaMock.purchaseOrderLine.findUniqueOrThrow.mockResolvedValue({
      id: mockPoLineId,
      quantity: new Prisma.Decimal('10.0000'),
      receivedQuantity: new Prisma.Decimal('5.0000'),
    });

    prismaMock.purchaseOrderLine.findMany.mockResolvedValue([
      {
        id: mockPoLineId,
        quantity: new Prisma.Decimal('10.0000'),
        receivedQuantity: new Prisma.Decimal('10.0000'),
      },
    ]);

    prismaMock.goodsReceipt.findUniqueOrThrow.mockResolvedValue({
      id: mockReceiptId,
      receiptNumber: 'GR-000001',
      status: GoodsReceiptStatus.POSTED,
    });

    const result = await service.postReceipt(
      mockOrgId,
      mockReceiptId,
      mockUserId,
    );

    expect(result.status).toBe(GoodsReceiptStatus.POSTED);
    expect(prismaMock.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: PurchaseOrderStatus.RECEIVED },
      }),
    );
  });

  it('5. should reject posting already POSTED goods receipt (idempotency)', async () => {
    prismaMock.goodsReceipt.findFirst.mockResolvedValue({
      id: mockReceiptId,
      status: GoodsReceiptStatus.POSTED,
    });

    await expect(
      service.postReceipt(mockOrgId, mockReceiptId, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });

  it('6. should cancel draft goods receipt', async () => {
    prismaMock.goodsReceipt.findFirst.mockResolvedValue({
      id: mockReceiptId,
      status: GoodsReceiptStatus.DRAFT,
      receiptNumber: 'GR-000001',
    });
    prismaMock.goodsReceipt.update.mockResolvedValue({
      id: mockReceiptId,
      status: GoodsReceiptStatus.CANCELLED,
      receiptNumber: 'GR-000001',
    });

    const result = await service.cancel(mockOrgId, mockReceiptId, mockUserId);
    expect(result.status).toBe(GoodsReceiptStatus.CANCELLED);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'GOODS_RECEIPT_CANCELLED',
      }),
    );
  });
});
