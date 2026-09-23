import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { DeliveryOrderStatus, Prisma } from '@prisma/client';

describe('ShipmentsService - Core Creation & Numbering', () => {
  let service: ShipmentsService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = 'user-shipment-admin';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      deliveryOrder: {
        findFirst: jest.fn(),
      },
      shipmentCarrier: {
        findFirst: jest.fn(),
      },
      shipmentVehicle: {
        findFirst: jest.fn(),
      },
      shipmentLine: {
        findMany: jest.fn(),
      },
      shipment: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      shipmentTrackingEvent: {
        create: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'SHP-000001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
      ],
    }).compile();

    service = module.get<ShipmentsService>(ShipmentsService);
  });

  describe('create', () => {
    it('should create a shipment with SHP-000001 numbering and exact total logistics cost', async () => {
      const mockDeliveryOrder = {
        id: 'do-1',
        deliveryNumber: 'DO-000001',
        organizationId: mockOrgId,
        salesOrderId: 'so-1',
        customerId: 'cust-1',
        status: DeliveryOrderStatus.READY,
        lines: [
          {
            id: 'doline-1',
            salesOrderLineId: 'soline-1',
            itemId: 'item-1',
            variantId: null,
            quantity: new Prisma.Decimal(10),
          },
        ],
        salesOrder: { id: 'so-1', orderNumber: 'SO-000001' },
        customer: { id: 'cust-1', name: 'Acme Corp' },
      };

      prismaMock.deliveryOrder.findFirst.mockResolvedValue(mockDeliveryOrder);
      prismaMock.shipmentLine.findMany.mockResolvedValue([]); // 0 existing shipments
      prismaMock.shipment.create.mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: 'shp-1',
          ...data,
          deliveryOrder: mockDeliveryOrder,
          salesOrder: mockDeliveryOrder.salesOrder,
          customer: mockDeliveryOrder.customer,
          carrier: null,
          vehicle: null,
          lines: [
            {
              id: 'shpline-1',
              itemId: 'item-1',
              quantity: new Prisma.Decimal(10),
            },
          ],
          packages: [],
          trackingEvents: [],
        });
      });

      const result = await service.create(
        mockOrgId,
        {
          deliveryOrderId: 'do-1',
          shippingCost: 50.5,
          insuranceCost: 10.25,
          otherCost: 5.25,
        },
        mockUserId,
      );

      expect(result.shipmentNumber).toBe('SHP-000001');
      expect(result.totalLogisticsCost.toNumber()).toBe(66.0);
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'SHIPMENT_CREATED',
          organizationId: mockOrgId,
        }),
      );
    });

    it('should reject creation if delivery order is cancelled', async () => {
      prismaMock.deliveryOrder.findFirst.mockResolvedValue({
        id: 'do-cancelled',
        organizationId: mockOrgId,
        status: DeliveryOrderStatus.CANCELLED,
        lines: [],
      });

      await expect(
        service.create(
          mockOrgId,
          { deliveryOrderId: 'do-cancelled' },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject creation if requested quantity exceeds eligible unshipped quantity', async () => {
      prismaMock.deliveryOrder.findFirst.mockResolvedValue({
        id: 'do-partial',
        deliveryNumber: 'DO-000002',
        organizationId: mockOrgId,
        salesOrderId: 'so-1',
        customerId: 'cust-1',
        status: DeliveryOrderStatus.READY,
        lines: [
          {
            id: 'doline-1',
            salesOrderLineId: 'soline-1',
            itemId: 'item-1',
            variantId: null,
            quantity: new Prisma.Decimal(10),
          },
        ],
      });

      // Already shipped 8 units
      prismaMock.shipmentLine.findMany.mockResolvedValue([
        {
          deliveryOrderLineId: 'doline-1',
          quantity: new Prisma.Decimal(8),
        },
      ]);

      // Requesting 5 units (available is 10 - 8 = 2)
      await expect(
        service.create(
          mockOrgId,
          {
            deliveryOrderId: 'do-partial',
            lines: [
              {
                deliveryOrderLineId: 'doline-1',
                quantity: 5,
              },
            ],
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject creation if requested quantity is zero or negative', async () => {
      prismaMock.deliveryOrder.findFirst.mockResolvedValue({
        id: 'do-zero',
        deliveryNumber: 'DO-000003',
        organizationId: mockOrgId,
        salesOrderId: 'so-1',
        customerId: 'cust-1',
        status: DeliveryOrderStatus.READY,
        lines: [
          {
            id: 'doline-1',
            salesOrderLineId: 'soline-1',
            itemId: 'item-1',
            variantId: null,
            quantity: new Prisma.Decimal(10),
          },
        ],
      });
      prismaMock.shipmentLine.findMany.mockResolvedValue([]);

      await expect(
        service.create(
          mockOrgId,
          {
            deliveryOrderId: 'do-zero',
            lines: [
              {
                deliveryOrderLineId: 'doline-1',
                quantity: 0,
              },
            ],
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
