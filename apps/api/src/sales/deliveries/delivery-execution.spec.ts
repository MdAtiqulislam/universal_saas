import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DeliveryOrdersService } from './delivery-orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BalancesService } from '../../inventory/balances/balances.service';
import { CogsService } from '../../inventory/costing/cogs.service';
import {
  DeliveryOrderStatus,
  SalesOrderStatus,
  StockMovementType,
  ReservationStatus,
  Prisma,
} from '@prisma/client';

describe('DeliveryExecutionWorkflow', () => {
  let service: DeliveryOrdersService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let balancesMock: any;
  let cogsMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockLocationId = '33333333-3333-3333-3333-333333333333';
  const mockOrderId = '44444444-4444-4444-4444-444444444444';
  const mockSoLineId = '55555555-5555-5555-5555-555555555555';
  const mockItemId = '66666666-6666-6666-6666-666666666666';
  const mockDeliveryId = '77777777-7777-7777-7777-777777777777';
  const mockUserId = '88888888-8888-8888-8888-888888888888';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      deliveryOrder: {
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      salesOrder: {
        update: jest.fn(),
      },
      salesOrderLine: {
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      inventoryReservation: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      inventoryBalance: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingMock = {
      nextNumber: jest.fn(),
    };

    balancesMock = {
      applyStockMovement: jest.fn().mockResolvedValue({
        balance: { id: 'bal-1' },
        movement: { id: 'mov-1' },
      }),
    };

    cogsMock = {
      recordAndPostCogs: jest
        .fn()
        .mockResolvedValue({ totalCost: new Prisma.Decimal(500) }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryOrdersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        { provide: BalancesService, useValue: balancesMock },
        { provide: CogsService, useValue: cogsMock },
      ],
    }).compile();

    service = module.get<DeliveryOrdersService>(DeliveryOrdersService);
  });

  it('1. should atomically execute delivery with M09 stock issue, reservation fulfillment, and M19 COGS posting', async () => {
    prismaMock.deliveryOrder.findFirst.mockResolvedValue({
      id: mockDeliveryId,
      deliveryNumber: 'DO-000001',
      salesOrderId: mockOrderId,
      locationId: mockLocationId,
      status: DeliveryOrderStatus.DISPATCHED,
      salesOrder: { orderNumber: 'SO-000001' },
      lines: [
        {
          id: 'do-line-1',
          salesOrderLineId: mockSoLineId,
          itemId: mockItemId,
          variantId: null,
          quantity: new Prisma.Decimal(30),
          batchId: null,
          serialId: null,
        },
      ],
    });

    // SO line: 50 ordered, 0 delivered -> 50 remaining to deliver
    prismaMock.salesOrderLine.findUniqueOrThrow.mockResolvedValue({
      id: mockSoLineId,
      quantity: new Prisma.Decimal(50),
      quantityDelivered: new Prisma.Decimal(0),
    });

    // Active reservation of 30 exists
    prismaMock.inventoryReservation.findFirst.mockResolvedValue({
      id: 'res-1',
      quantity: new Prisma.Decimal(30),
    });

    prismaMock.inventoryBalance.findFirst.mockResolvedValue({
      id: 'bal-1',
      quantityReserved: new Prisma.Decimal(30),
    });

    // Recalculate SO status: remaining 20 units -> PARTIALLY_FULFILLED
    prismaMock.salesOrderLine.findMany.mockResolvedValue([
      {
        id: mockSoLineId,
        quantity: new Prisma.Decimal(50),
        quantityDelivered: new Prisma.Decimal(30),
      },
    ]);

    prismaMock.deliveryOrder.findUniqueOrThrow.mockResolvedValue({
      id: mockDeliveryId,
      deliveryNumber: 'DO-000001',
      salesOrderId: mockOrderId,
      status: DeliveryOrderStatus.DELIVERED,
      salesOrder: { orderNumber: 'SO-000001' },
    });

    const result = await service.executeDelivery(
      mockOrgId,
      mockDeliveryId,
      mockUserId,
    );

    expect(result.status).toBe(DeliveryOrderStatus.DELIVERED);

    // 1. Verify M09 Stock Movement ISSUE
    expect(balancesMock.applyStockMovement).toHaveBeenCalledWith(
      mockOrgId,
      expect.objectContaining({
        locationId: mockLocationId,
        itemId: mockItemId,
        movementType: StockMovementType.ISSUE,
        quantity: 30,
      }),
      mockUserId,
      expect.anything(),
    );

    // 2. Verify M19 COGS posting
    expect(cogsMock.recordAndPostCogs).toHaveBeenCalledWith(
      mockOrgId,
      expect.objectContaining({
        itemId: mockItemId,
        locationId: mockLocationId,
        quantity: new Prisma.Decimal(30),
        sourceDocument: 'DELIVERY_ORDER',
      }),
      mockUserId,
      expect.anything(),
    );

    // 3. Verify reservation fulfilled
    expect(prismaMock.inventoryReservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'res-1' },
        data: expect.objectContaining({ status: ReservationStatus.FULFILLED }),
      }),
    );

    // 4. Verify SO line delivered quantity incremented
    expect(prismaMock.salesOrderLine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockSoLineId },
        data: { quantityDelivered: { increment: new Prisma.Decimal(30) } },
      }),
    );

    // 5. Verify Sales Order updated to PARTIALLY_FULFILLED
    expect(prismaMock.salesOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockOrderId },
        data: { status: SalesOrderStatus.PARTIALLY_FULFILLED },
      }),
    );
  });

  it('2. should transition Sales Order to FULFILLED on full delivery completion', async () => {
    prismaMock.deliveryOrder.findFirst.mockResolvedValue({
      id: mockDeliveryId,
      deliveryNumber: 'DO-000002',
      salesOrderId: mockOrderId,
      locationId: mockLocationId,
      status: DeliveryOrderStatus.READY,
      salesOrder: { orderNumber: 'SO-000001' },
      lines: [
        {
          id: 'do-line-1',
          salesOrderLineId: mockSoLineId,
          itemId: mockItemId,
          variantId: null,
          quantity: new Prisma.Decimal(20),
          batchId: null,
          serialId: null,
        },
      ],
    });

    prismaMock.salesOrderLine.findUniqueOrThrow.mockResolvedValue({
      id: mockSoLineId,
      quantity: new Prisma.Decimal(50),
      quantityDelivered: new Prisma.Decimal(30), // 20 remaining
    });

    prismaMock.inventoryReservation.findFirst.mockResolvedValue(null);

    // All lines now fully delivered
    prismaMock.salesOrderLine.findMany.mockResolvedValue([
      {
        id: mockSoLineId,
        quantity: new Prisma.Decimal(50),
        quantityDelivered: new Prisma.Decimal(50),
      },
    ]);

    prismaMock.deliveryOrder.findUniqueOrThrow.mockResolvedValue({
      id: mockDeliveryId,
      deliveryNumber: 'DO-000002',
      salesOrderId: mockOrderId,
      status: DeliveryOrderStatus.DELIVERED,
      salesOrder: { orderNumber: 'SO-000001' },
    });

    const result = await service.executeDelivery(
      mockOrgId,
      mockDeliveryId,
      mockUserId,
    );

    expect(result.status).toBe(DeliveryOrderStatus.DELIVERED);
    expect(prismaMock.salesOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockOrderId },
        data: { status: SalesOrderStatus.FULFILLED },
      }),
    );
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'SALES_FULFILLMENT_COMPLETED' }),
    );
  });

  it('3. should reject delivery if order is already delivered (Idempotency)', async () => {
    prismaMock.deliveryOrder.findFirst.mockResolvedValue({
      id: mockDeliveryId,
      status: DeliveryOrderStatus.DELIVERED,
    });

    await expect(
      service.executeDelivery(mockOrgId, mockDeliveryId, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });
});
