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
  TrackingType,
  Prisma,
} from '@prisma/client';

describe('DeliveryOrdersService', () => {
  let service: DeliveryOrdersService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let balancesMock: any;
  let cogsMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockCustomerId = '22222222-2222-2222-2222-222222222222';
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
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      deliveryOrderLine: {
        createMany: jest.fn(),
      },
      salesOrder: {
        findFirst: jest.fn(),
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
      inventoryBatch: {
        findFirst: jest.fn(),
      },
      inventorySerial: {
        findFirst: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({
        sequenceKey: 'DELIVERY_ORDER',
        number: 1,
        formatted: 'DO-000001',
      }),
    };

    balancesMock = {
      applyStockMovement: jest.fn().mockResolvedValue({
        balance: { id: 'bal-1' },
        movement: { id: 'mov-1' },
      }),
    };

    cogsMock = {
      recordAndPostCogs: jest.fn().mockResolvedValue({}),
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

  it('1. should create draft delivery order linked to active sales order', async () => {
    prismaMock.salesOrder.findFirst.mockResolvedValue({
      id: mockOrderId,
      orderNumber: 'SO-000001',
      status: SalesOrderStatus.APPROVED,
      customerId: mockCustomerId,
      locationId: mockLocationId,
      lines: [
        {
          id: mockSoLineId,
          itemId: mockItemId,
          quantity: new Prisma.Decimal(50),
          quantityDelivered: new Prisma.Decimal(0),
          item: { sku: 'PROD-1', trackingType: TrackingType.NONE },
        },
      ],
    });

    prismaMock.deliveryOrder.create.mockResolvedValue({
      id: mockDeliveryId,
      deliveryNumber: 'DO-000001',
      status: DeliveryOrderStatus.DRAFT,
    });

    const result = await service.create(
      mockOrgId,
      {
        salesOrderId: mockOrderId,
        lines: [{ salesOrderLineId: mockSoLineId, quantity: 20 }],
      },
      mockUserId,
    );

    expect(result.deliveryNumber).toBe('DO-000001');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'DELIVERY_ORDER_CREATED' }),
    );
  });

  it('2. should reject delivery order if quantity exceeds remaining to deliver', async () => {
    prismaMock.salesOrder.findFirst.mockResolvedValue({
      id: mockOrderId,
      orderNumber: 'SO-000001',
      status: SalesOrderStatus.APPROVED,
      lines: [
        {
          id: mockSoLineId,
          itemId: mockItemId,
          quantity: new Prisma.Decimal(50),
          quantityDelivered: new Prisma.Decimal(40), // 10 remaining
          item: { sku: 'PROD-1', trackingType: TrackingType.NONE },
        },
      ],
    });

    await expect(
      service.create(
        mockOrgId,
        {
          salesOrderId: mockOrderId,
          lines: [{ salesOrderLineId: mockSoLineId, quantity: 20 }], // Requests 20 > 10
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should transition status: DRAFT -> READY', async () => {
    prismaMock.deliveryOrder.findFirst.mockResolvedValue({
      id: mockDeliveryId,
      status: DeliveryOrderStatus.DRAFT,
      deliveryNumber: 'DO-000001',
    });
    prismaMock.deliveryOrder.update.mockResolvedValue({
      id: mockDeliveryId,
      status: DeliveryOrderStatus.READY,
      deliveryNumber: 'DO-000001',
    });

    const result = await service.ready(mockOrgId, mockDeliveryId, mockUserId);
    expect(result.status).toBe(DeliveryOrderStatus.READY);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'DELIVERY_ORDER_READY' }),
    );
  });

  it('4. should transition status: READY -> PICKED', async () => {
    prismaMock.deliveryOrder.findFirst.mockResolvedValue({
      id: mockDeliveryId,
      status: DeliveryOrderStatus.READY,
      deliveryNumber: 'DO-000001',
    });
    prismaMock.deliveryOrder.update.mockResolvedValue({
      id: mockDeliveryId,
      status: DeliveryOrderStatus.PICKED,
      deliveryNumber: 'DO-000001',
    });

    const result = await service.pick(mockOrgId, mockDeliveryId, mockUserId);
    expect(result.status).toBe(DeliveryOrderStatus.PICKED);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'DELIVERY_ORDER_PICKED' }),
    );
  });

  it('5. should transition status: PICKED -> DISPATCHED', async () => {
    prismaMock.deliveryOrder.findFirst.mockResolvedValue({
      id: mockDeliveryId,
      status: DeliveryOrderStatus.PICKED,
      deliveryNumber: 'DO-000001',
    });
    prismaMock.deliveryOrder.update.mockResolvedValue({
      id: mockDeliveryId,
      status: DeliveryOrderStatus.DISPATCHED,
      deliveryNumber: 'DO-000001',
    });

    const result = await service.dispatch(
      mockOrgId,
      mockDeliveryId,
      mockUserId,
    );
    expect(result.status).toBe(DeliveryOrderStatus.DISPATCHED);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'DELIVERY_ORDER_DISPATCHED' }),
    );
  });

  it('6. should cancel draft delivery order', async () => {
    prismaMock.deliveryOrder.findFirst.mockResolvedValue({
      id: mockDeliveryId,
      status: DeliveryOrderStatus.DRAFT,
      deliveryNumber: 'DO-000001',
    });
    prismaMock.deliveryOrder.update.mockResolvedValue({
      id: mockDeliveryId,
      status: DeliveryOrderStatus.CANCELLED,
      deliveryNumber: 'DO-000001',
    });

    const result = await service.cancel(
      mockOrgId,
      mockDeliveryId,
      'Customer cancellation',
      mockUserId,
    );
    expect(result.status).toBe(DeliveryOrderStatus.CANCELLED);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'DELIVERY_ORDER_CANCELLED',
      }),
    );
  });
});
