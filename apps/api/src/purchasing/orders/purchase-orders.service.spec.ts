import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { PurchaseOrderStatus, Prisma, TrackingType } from '@prisma/client';

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockSupplierId = '22222222-2222-2222-2222-222222222222';
  const mockLocationId = '33333333-3333-3333-3333-333333333333';
  const mockCurrencyId = '44444444-4444-4444-4444-444444444444';
  const mockItemId = '55555555-5555-5555-5555-555555555555';
  const mockOrderId = '66666666-6666-6666-6666-666666666666';
  const mockUserId = '77777777-7777-7777-7777-777777777777';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      purchaseOrder: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      purchaseOrderLine: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      supplier: {
        findFirst: jest.fn(),
      },
      location: {
        findFirst: jest.fn(),
      },
      currency: {
        findFirst: jest.fn(),
      },
      item: {
        findFirst: jest.fn(),
      },
      itemVariant: {
        findFirst: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({
        sequenceKey: 'PURCHASE_ORDER',
        number: 1,
        formatted: 'PO-000001',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
  });

  it('1. should create draft purchase order with exact decimal calculations and poNumber', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({
      id: mockSupplierId,
      paymentTermsDays: 15,
    });
    prismaMock.location.findFirst.mockResolvedValue({ id: mockLocationId });
    prismaMock.currency.findFirst.mockResolvedValue({ id: mockCurrencyId });
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      sku: 'ITEM-A',
      trackingType: TrackingType.NONE,
    });

    prismaMock.purchaseOrder.create.mockResolvedValue({
      id: mockOrderId,
      poNumber: 'PO-000001',
    });

    prismaMock.purchaseOrder.findUniqueOrThrow.mockResolvedValue({
      id: mockOrderId,
      poNumber: 'PO-000001',
      subtotal: new Prisma.Decimal('100.0000'),
      discountTotal: new Prisma.Decimal('10.0000'),
      taxTotal: new Prisma.Decimal('4.5000'),
      shippingTotal: new Prisma.Decimal('15.0000'),
      grandTotal: new Prisma.Decimal('109.5000'),
      status: PurchaseOrderStatus.DRAFT,
    });

    const result = await service.create(
      mockOrgId,
      {
        supplierId: mockSupplierId,
        locationId: mockLocationId,
        currencyId: mockCurrencyId,
        shippingTotal: 15,
        lines: [
          {
            itemId: mockItemId,
            quantity: 10,
            unitPrice: 10,
            discountAmount: 10,
            taxRate: 0.05,
          },
        ],
      },
      mockUserId,
    );

    expect(result.poNumber).toBe('PO-000001');
    expect(result.grandTotal.toString()).toBe('109.5');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'PURCHASE_ORDER_CREATED',
      }),
    );
  });

  it('2. should reject line item with non-positive quantity', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: mockSupplierId });
    prismaMock.location.findFirst.mockResolvedValue({ id: mockLocationId });
    prismaMock.currency.findFirst.mockResolvedValue({ id: mockCurrencyId });

    await expect(
      service.create(
        mockOrgId,
        {
          supplierId: mockSupplierId,
          locationId: mockLocationId,
          currencyId: mockCurrencyId,
          lines: [
            {
              itemId: mockItemId,
              quantity: 0,
              unitPrice: 10,
            },
          ],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should reject variant if it does not belong to specified item', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: mockSupplierId });
    prismaMock.location.findFirst.mockResolvedValue({ id: mockLocationId });
    prismaMock.currency.findFirst.mockResolvedValue({ id: mockCurrencyId });
    prismaMock.item.findFirst.mockResolvedValue({ id: mockItemId });
    prismaMock.itemVariant.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        mockOrgId,
        {
          supplierId: mockSupplierId,
          locationId: mockLocationId,
          currencyId: mockCurrencyId,
          lines: [
            {
              itemId: mockItemId,
              variantId: 'wrong-variant',
              quantity: 5,
              unitPrice: 10,
            },
          ],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('4. should submit draft purchase order (DRAFT -> SUBMITTED)', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue({
      id: mockOrderId,
      status: PurchaseOrderStatus.DRAFT,
      poNumber: 'PO-000001',
    });
    prismaMock.purchaseOrder.update.mockResolvedValue({
      id: mockOrderId,
      status: PurchaseOrderStatus.SUBMITTED,
      poNumber: 'PO-000001',
    });

    const result = await service.submit(mockOrgId, mockOrderId, mockUserId);
    expect(result.status).toBe(PurchaseOrderStatus.SUBMITTED);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'PURCHASE_ORDER_SUBMITTED',
      }),
    );
  });

  it('5. should approve submitted purchase order (SUBMITTED -> APPROVED)', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue({
      id: mockOrderId,
      status: PurchaseOrderStatus.SUBMITTED,
      poNumber: 'PO-000001',
    });
    prismaMock.purchaseOrder.update.mockResolvedValue({
      id: mockOrderId,
      status: PurchaseOrderStatus.APPROVED,
      poNumber: 'PO-000001',
      approvedByUserId: mockUserId,
    });

    const result = await service.approve(mockOrgId, mockOrderId, mockUserId);
    expect(result.status).toBe(PurchaseOrderStatus.APPROVED);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'PURCHASE_ORDER_APPROVED',
      }),
    );
  });

  it('6. should reject approving a DRAFT purchase order directly', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue({
      id: mockOrderId,
      status: PurchaseOrderStatus.DRAFT,
    });

    await expect(
      service.approve(mockOrgId, mockOrderId, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });

  it('7. should cancel an approved purchase order', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue({
      id: mockOrderId,
      status: PurchaseOrderStatus.APPROVED,
      poNumber: 'PO-000001',
    });
    prismaMock.purchaseOrder.update.mockResolvedValue({
      id: mockOrderId,
      status: PurchaseOrderStatus.CANCELLED,
      poNumber: 'PO-000001',
    });

    const result = await service.cancel(
      mockOrgId,
      mockOrderId,
      'Supplier out of stock',
      mockUserId,
    );
    expect(result.status).toBe(PurchaseOrderStatus.CANCELLED);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'PURCHASE_ORDER_CANCELLED',
      }),
    );
  });

  it('8. should close fully received purchase order (RECEIVED -> CLOSED)', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue({
      id: mockOrderId,
      status: PurchaseOrderStatus.RECEIVED,
      poNumber: 'PO-000001',
    });
    prismaMock.purchaseOrder.update.mockResolvedValue({
      id: mockOrderId,
      status: PurchaseOrderStatus.CLOSED,
      poNumber: 'PO-000001',
    });

    const result = await service.close(mockOrgId, mockOrderId, mockUserId);
    expect(result.status).toBe(PurchaseOrderStatus.CLOSED);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'PURCHASE_ORDER_CLOSED',
      }),
    );
  });

  it('9. should reject closing unreceived purchase order', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue({
      id: mockOrderId,
      status: PurchaseOrderStatus.APPROVED,
    });

    await expect(
      service.close(mockOrgId, mockOrderId, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });

  it('10. should reject modifying a non-draft purchase order', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue({
      id: mockOrderId,
      status: PurchaseOrderStatus.APPROVED,
    });

    await expect(
      service.update(mockOrgId, mockOrderId, { notes: 'New note' }, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });
});
