import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ShipmentTrackingService } from './shipment-tracking.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { ShipmentStatus, ShipmentTrackingEventType } from '@prisma/client';

describe('ShipmentTrackingService', () => {
  let service: ShipmentTrackingService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = 'user-tracking-admin';

  beforeEach(async () => {
    prismaMock = {
      shipment: {
        findFirst: jest.fn(),
      },
      shipmentTrackingEvent: {
        create: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentTrackingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<ShipmentTrackingService>(ShipmentTrackingService);
  });

  describe('addTrackingEvent', () => {
    it('should append tracking event to shipment and publish domain audit event', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue({
        id: 'shp-1',
        organizationId: mockOrgId,
        shipmentNumber: 'SHP-000001',
        status: ShipmentStatus.IN_TRANSIT,
      });

      prismaMock.shipmentTrackingEvent.create.mockImplementation(
        ({ data }: any) => Promise.resolve({ id: 'ev-1', ...data }),
      );

      const result = await service.addTrackingEvent(
        mockOrgId,
        'shp-1',
        {
          status: ShipmentStatus.IN_TRANSIT,
          eventType: ShipmentTrackingEventType.IN_TRANSIT,
          location: 'Sorting Facility Alpha',
          description: 'Package scanned at sorting hub',
        },
        mockUserId,
      );

      expect(result.eventType).toBe(ShipmentTrackingEventType.IN_TRANSIT);
      expect(result.location).toBe('Sorting Facility Alpha');
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'SHIPMENT_TRACKING_EVENT_ADDED',
          organizationId: mockOrgId,
        }),
      );
    });

    it('should throw NotFoundException if shipment does not exist in organization', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue(null);

      await expect(
        service.addTrackingEvent(
          mockOrgId,
          'non-existent',
          {
            status: ShipmentStatus.IN_TRANSIT,
            eventType: ShipmentTrackingEventType.IN_TRANSIT,
          },
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTrackingHistory', () => {
    it('should return chronological tracking history for shipment', async () => {
      const now = new Date();
      const events = [
        {
          id: 'ev-1',
          eventType: ShipmentTrackingEventType.CREATED,
          eventTime: new Date(now.getTime() - 100000),
          description: 'Shipment created',
        },
        {
          id: 'ev-2',
          eventType: ShipmentTrackingEventType.DISPATCHED,
          eventTime: new Date(now.getTime() - 50000),
          description: 'Dispatched for transit',
        },
        {
          id: 'ev-3',
          eventType: ShipmentTrackingEventType.DELIVERED,
          eventTime: now,
          description: 'Delivered',
        },
      ];

      prismaMock.shipment.findFirst.mockResolvedValue({
        id: 'shp-1',
        shipmentNumber: 'SHP-000001',
        status: ShipmentStatus.DELIVERED,
        trackingNumber: 'TRK-100',
        carrier: { name: 'DHL Express' },
        trackingEvents: events,
      });

      const history = await service.getTrackingHistory(mockOrgId, 'shp-1');
      expect(history.shipmentNumber).toBe('SHP-000001');
      expect(history.carrierName).toBe('DHL Express');
      expect(history.events).toHaveLength(3);
      expect(history.events[0].eventType).toBe(
        ShipmentTrackingEventType.CREATED,
      );
      expect(history.events[2].eventType).toBe(
        ShipmentTrackingEventType.DELIVERED,
      );
    });
  });
});
