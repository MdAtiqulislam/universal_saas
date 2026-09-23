import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ShipmentStatus, ShipmentTrackingEventType } from '@prisma/client';

describe('ShipmentDispatchWorkflow', () => {
  let service: ShipmentsService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = 'user-dispatch-admin';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((cb) => cb(prismaMock)),
      shipment: {
        findFirst: jest.fn(),
        update: jest.fn(),
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
        ShipmentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: { nextNumber: jest.fn() } },
      ],
    }).compile();

    service = module.get<ShipmentsService>(ShipmentsService);
  });

  describe('dispatch', () => {
    it('should dispatch assigned shipment and create DISPATCHED tracking event', async () => {
      const assignedShipment = {
        id: 'shp-1',
        organizationId: mockOrgId,
        shipmentNumber: 'SHP-000001',
        status: ShipmentStatus.ASSIGNED,
        trackingNumber: 'TRK-999',
        lines: [{ id: 'l1', itemId: 'item-1' }],
        carrier: { id: 'c1', name: 'DHL' },
        vehicle: null,
        deliveryOrder: null,
        salesOrder: null,
        customer: null,
        packages: [],
        trackingEvents: [],
      };

      prismaMock.shipment.findFirst.mockResolvedValue(assignedShipment);
      prismaMock.shipment.update.mockResolvedValue({
        ...assignedShipment,
        status: ShipmentStatus.DISPATCHED,
        actualShipDate: new Date(),
        dispatchedByUserId: mockUserId,
      });

      await service.dispatch(
        mockOrgId,
        'shp-1',
        {
          actualShipDate: '2026-08-30T10:00:00Z',
          notes: 'Departed main warehouse',
        },
        mockUserId,
      );

      expect(prismaMock.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shp-1' },
          data: expect.objectContaining({
            status: ShipmentStatus.DISPATCHED,
            dispatchedByUserId: mockUserId,
          }),
        }),
      );

      expect(prismaMock.shipmentTrackingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ShipmentStatus.DISPATCHED,
            eventType: ShipmentTrackingEventType.DISPATCHED,
            description: 'Departed main warehouse',
          }),
        }),
      );

      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'SHIPMENT_DISPATCHED' }),
      );
    });

    it('should reject dispatch if shipment is already DISPATCHED', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue({
        id: 'shp-disp',
        status: ShipmentStatus.DISPATCHED,
        lines: [{ id: 'l1' }],
      });

      await expect(
        service.dispatch(mockOrgId, 'shp-disp', {}, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject dispatch if shipment has no line items', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue({
        id: 'shp-nolines',
        status: ShipmentStatus.READY,
        lines: [],
      });

      await expect(
        service.dispatch(mockOrgId, 'shp-nolines', {}, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
