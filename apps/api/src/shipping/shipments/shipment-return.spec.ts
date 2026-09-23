import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ShipmentStatus, ShipmentTrackingEventType } from '@prisma/client';

describe('ShipmentReturnWorkflow', () => {
  let service: ShipmentsService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = 'user-return-admin';

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

  describe('markFailed', () => {
    it('should record delivery failure with reason and create tracking event', async () => {
      const inTransitShipment = {
        id: 'shp-1',
        organizationId: mockOrgId,
        shipmentNumber: 'SHP-000001',
        status: ShipmentStatus.IN_TRANSIT,
        lines: [],
        carrier: null,
        vehicle: null,
        deliveryOrder: null,
        salesOrder: null,
        customer: null,
        packages: [],
        trackingEvents: [],
      };

      prismaMock.shipment.findFirst.mockResolvedValue(inTransitShipment);
      prismaMock.shipment.update.mockResolvedValue({
        ...inTransitShipment,
        status: ShipmentStatus.FAILED,
        failureReason: 'Business closed / gate locked',
      });

      await service.markFailed(
        mockOrgId,
        'shp-1',
        {
          failureReason: 'Business closed / gate locked',
          location: 'Customer Gate',
        },
        mockUserId,
      );

      expect(prismaMock.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shp-1' },
          data: expect.objectContaining({
            status: ShipmentStatus.FAILED,
            failureReason: 'Business closed / gate locked',
          }),
        }),
      );

      expect(prismaMock.shipmentTrackingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ShipmentStatus.FAILED,
            eventType: ShipmentTrackingEventType.DELIVERY_ATTEMPT_FAILED,
          }),
        }),
      );

      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'SHIPMENT_FAILED' }),
      );
    });
  });

  describe('initiateReturn', () => {
    it('should initiate return for failed shipment and record return reason', async () => {
      const failedShipment = {
        id: 'shp-2',
        organizationId: mockOrgId,
        shipmentNumber: 'SHP-000002',
        status: ShipmentStatus.FAILED,
        lines: [],
        carrier: null,
        vehicle: null,
        deliveryOrder: null,
        salesOrder: null,
        customer: null,
        packages: [],
        trackingEvents: [],
      };

      prismaMock.shipment.findFirst.mockResolvedValue(failedShipment);
      prismaMock.shipment.update.mockResolvedValue({
        ...failedShipment,
        status: ShipmentStatus.RETURNED,
        returnReason: 'Customer refused delivery package',
      });

      await service.initiateReturn(
        mockOrgId,
        'shp-2',
        { returnReason: 'Customer refused delivery package' },
        mockUserId,
      );

      expect(prismaMock.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shp-2' },
          data: expect.objectContaining({
            status: ShipmentStatus.RETURNED,
            returnReason: 'Customer refused delivery package',
          }),
        }),
      );

      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'SHIPMENT_RETURNED' }),
      );
    });

    it('should reject return if shipment has already been processed as RETURNED', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue({
        id: 'shp-returned',
        status: ShipmentStatus.RETURNED,
      });

      await expect(
        service.initiateReturn(
          mockOrgId,
          'shp-returned',
          { returnReason: 'Duplicate return' },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
