import { Test, TestingModule } from '@nestjs/testing';
import { ShipmentsService } from './shipments/shipments.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ShipmentStatus, DeliveryOrderStatus, Prisma } from '@prisma/client';

describe('Shipment & Logistics Concurrency (100 Parallel Workers)', () => {
  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = 'user-concurrency-worker';

  describe('1. 100 Parallel Shipment Creation Attempts', () => {
    it('should never allocate shipment quantity beyond eligible delivery order quantity', async () => {
      const existingLines: Array<{
        id: string;
        deliveryOrderLineId: string;
        quantity: Prisma.Decimal;
      }> = [];
      const deliveryQty = new Prisma.Decimal(50);

      let activeTx: Promise<any> = Promise.resolve();

      const mockPrisma: any = {
        $transaction: jest.fn((cb) => {
          const next = activeTx.then(() => cb(mockPrisma));
          activeTx = next.catch(() => {});
          return next;
        }),
        deliveryOrder: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              id: 'do-conc-1',
              deliveryNumber: 'DO-000001',
              organizationId: mockOrgId,
              salesOrderId: 'so-1',
              customerId: 'cust-1',
              status: DeliveryOrderStatus.READY,
              lines: [
                {
                  id: 'doline-conc-1',
                  salesOrderLineId: 'soline-1',
                  itemId: 'item-1',
                  variantId: null,
                  quantity: deliveryQty,
                },
              ],
              salesOrder: { id: 'so-1', orderNumber: 'SO-1' },
              customer: { id: 'cust-1', name: 'Acme' },
            }),
          ),
        },
        shipmentLine: {
          findMany: jest.fn(() => Promise.resolve([...existingLines])),
        },
        shipment: {
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn(({ data }: any) => {
            for (const l of data.lines.create) {
              existingLines.push({
                id: `line-${Math.random()}`,
                deliveryOrderLineId: l.deliveryOrderLineId,
                quantity: new Prisma.Decimal(l.quantity as number),
              });
            }
            return Promise.resolve({
              id: `shp-${Math.random()}`,
              ...data,
              deliveryOrder: { lines: [] },
              salesOrder: {},
              customer: {},
              carrier: null,
              vehicle: null,
              lines: [],
              packages: [],
              trackingEvents: [],
            });
          }),
          findFirst: jest.fn(),
        },
        shipmentTrackingEvent: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ShipmentsService,
          { provide: PrismaService, useValue: mockPrisma },
          {
            provide: EventBusService,
            useValue: { publish: jest.fn().mockResolvedValue(undefined) },
          },
          {
            provide: NumberingService,
            useValue: {
              nextNumber: jest.fn().mockResolvedValue({ formatted: 'SHP-1' }),
            },
          },
        ],
      }).compile();

      const service = module.get<ShipmentsService>(ShipmentsService);

      const workers = Array.from({ length: 100 }, () =>
        service.create(
          mockOrgId,
          {
            deliveryOrderId: 'do-conc-1',
            lines: [
              {
                deliveryOrderLineId: 'doline-conc-1',
                quantity: 10,
              },
            ],
          },
          mockUserId,
        ),
      );

      const results = await Promise.allSettled(workers);
      const successes = results.filter((r) => r.status === 'fulfilled');

      // Exactly 5 shipments of 10 units each can be created out of 50 available units
      expect(successes.length).toBe(5);
      const totalShipped = existingLines.reduce(
        (acc, l) => acc.plus(l.quantity),
        new Prisma.Decimal(0),
      );
      expect(totalShipped.toNumber()).toBe(50);
    });
  });

  describe('2. 100 Parallel Dispatch Attempts', () => {
    it('should allow exactly 1 dispatch and reject 99 concurrent attempts', async () => {
      let isDispatched = false;

      const mockShipmentObj = {
        id: 'shp-conc-disp',
        organizationId: mockOrgId,
        shipmentNumber: 'SHP-000002',
        status: ShipmentStatus.ASSIGNED,
        trackingNumber: 'TRK-1',
        shippingCost: new Prisma.Decimal(0),
        insuranceCost: new Prisma.Decimal(0),
        otherCost: new Prisma.Decimal(0),
        totalLogisticsCost: new Prisma.Decimal(0),
        lines: [{ id: 'l1', itemId: 'item-1' }],
        carrier: { id: 'c1', name: 'DHL' },
        vehicle: null,
        deliveryOrder: null,
        salesOrder: null,
        customer: null,
        packages: [],
        trackingEvents: [],
      };

      const mockPrisma: any = {
        $transaction: jest.fn((cb) => cb(mockPrisma)),
        shipment: {
          findFirst: jest.fn(() => {
            return Promise.resolve({
              ...mockShipmentObj,
              status: isDispatched
                ? ShipmentStatus.DISPATCHED
                : ShipmentStatus.ASSIGNED,
            });
          }),
          update: jest.fn(() => {
            if (isDispatched) {
              throw new Error('Concurrent modification: Already dispatched');
            }
            isDispatched = true;
            return Promise.resolve({
              ...mockShipmentObj,
              status: ShipmentStatus.DISPATCHED,
            });
          }),
        },
        shipmentTrackingEvent: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ShipmentsService,
          { provide: PrismaService, useValue: mockPrisma },
          {
            provide: EventBusService,
            useValue: { publish: jest.fn().mockResolvedValue(undefined) },
          },
          {
            provide: NumberingService,
            useValue: { nextNumber: jest.fn() },
          },
        ],
      }).compile();

      const service = module.get<ShipmentsService>(ShipmentsService);

      const workers = Array.from({ length: 100 }, () =>
        service.dispatch(mockOrgId, 'shp-conc-disp', {}, mockUserId),
      );

      const results = await Promise.allSettled(workers);
      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(99);
    });
  });

  describe('3. 100 Parallel Delivery Confirmation Attempts', () => {
    it('should confirm delivery exactly once and reject 99 concurrent duplicate confirmations', async () => {
      let isDelivered = false;

      const mockShipmentObj = {
        id: 'shp-conc-del',
        organizationId: mockOrgId,
        shipmentNumber: 'SHP-000003',
        status: ShipmentStatus.IN_TRANSIT,
        trackingNumber: 'TRK-1',
        shippingCost: new Prisma.Decimal(0),
        insuranceCost: new Prisma.Decimal(0),
        otherCost: new Prisma.Decimal(0),
        totalLogisticsCost: new Prisma.Decimal(0),
        lines: [],
        carrier: null,
        vehicle: null,
        deliveryOrder: null,
        salesOrder: null,
        customer: null,
        packages: [],
        trackingEvents: [],
      };

      const mockPrisma: any = {
        $transaction: jest.fn((cb) => cb(mockPrisma)),
        shipment: {
          findFirst: jest.fn(() => {
            return Promise.resolve({
              ...mockShipmentObj,
              status: isDelivered
                ? ShipmentStatus.DELIVERED
                : ShipmentStatus.IN_TRANSIT,
            });
          }),
          update: jest.fn(() => {
            if (isDelivered) {
              throw new Error('Concurrent modification: Already delivered');
            }
            isDelivered = true;
            return Promise.resolve({
              ...mockShipmentObj,
              status: ShipmentStatus.DELIVERED,
            });
          }),
        },
        shipmentTrackingEvent: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ShipmentsService,
          { provide: PrismaService, useValue: mockPrisma },
          {
            provide: EventBusService,
            useValue: { publish: jest.fn().mockResolvedValue(undefined) },
          },
          {
            provide: NumberingService,
            useValue: { nextNumber: jest.fn() },
          },
        ],
      }).compile();

      const service = module.get<ShipmentsService>(ShipmentsService);

      const workers = Array.from({ length: 100 }, () =>
        service.markDelivered(
          mockOrgId,
          'shp-conc-del',
          'Delivered ok',
          'Gate',
          mockUserId,
        ),
      );

      const results = await Promise.allSettled(workers);
      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(99);
    });
  });

  describe('4. 100 Parallel Return Attempts', () => {
    it('should process return exactly once and reject 99 concurrent duplicate returns', async () => {
      let isReturned = false;

      const mockShipmentObj = {
        id: 'shp-conc-ret',
        organizationId: mockOrgId,
        shipmentNumber: 'SHP-000004',
        status: ShipmentStatus.FAILED,
        trackingNumber: 'TRK-1',
        shippingCost: new Prisma.Decimal(0),
        insuranceCost: new Prisma.Decimal(0),
        otherCost: new Prisma.Decimal(0),
        totalLogisticsCost: new Prisma.Decimal(0),
        lines: [],
        carrier: null,
        vehicle: null,
        deliveryOrder: null,
        salesOrder: null,
        customer: null,
        packages: [],
        trackingEvents: [],
      };

      const mockPrisma: any = {
        $transaction: jest.fn((cb) => cb(mockPrisma)),
        shipment: {
          findFirst: jest.fn(() => {
            return Promise.resolve({
              ...mockShipmentObj,
              status: isReturned
                ? ShipmentStatus.RETURNED
                : ShipmentStatus.FAILED,
            });
          }),
          update: jest.fn(() => {
            if (isReturned) {
              throw new Error('Concurrent modification: Already returned');
            }
            isReturned = true;
            return Promise.resolve({
              ...mockShipmentObj,
              status: ShipmentStatus.RETURNED,
            });
          }),
        },
        shipmentTrackingEvent: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ShipmentsService,
          { provide: PrismaService, useValue: mockPrisma },
          {
            provide: EventBusService,
            useValue: { publish: jest.fn().mockResolvedValue(undefined) },
          },
          {
            provide: NumberingService,
            useValue: { nextNumber: jest.fn() },
          },
        ],
      }).compile();

      const service = module.get<ShipmentsService>(ShipmentsService);

      const workers = Array.from({ length: 100 }, () =>
        service.initiateReturn(
          mockOrgId,
          'shp-conc-ret',
          { returnReason: 'Refused' },
          mockUserId,
        ),
      );

      const results = await Promise.allSettled(workers);
      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(99);
    });
  });
});
