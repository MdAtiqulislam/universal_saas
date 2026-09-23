import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ShipmentStatus } from '@prisma/client';

describe('ShipmentLifecycleWorkflow', () => {
  let service: ShipmentsService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = 'user-lifecycle-admin';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((cb) => cb(prismaMock)),
      shipment: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      shipmentCarrier: {
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
        ShipmentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: { nextNumber: jest.fn() } },
      ],
    }).compile();

    service = module.get<ShipmentsService>(ShipmentsService);
  });

  describe('prepare (DRAFT -> READY)', () => {
    it('should mark draft shipment as ready', async () => {
      const draftShipment = {
        id: 'shp-1',
        organizationId: mockOrgId,
        shipmentNumber: 'SHP-000001',
        status: ShipmentStatus.DRAFT,
        lines: [{ id: 'line-1' }],
        carrier: null,
        vehicle: null,
        deliveryOrder: null,
        salesOrder: null,
        customer: null,
        packages: [],
        trackingEvents: [],
      };

      prismaMock.shipment.findFirst
        .mockResolvedValueOnce(draftShipment)
        .mockResolvedValueOnce({
          ...draftShipment,
          status: ShipmentStatus.READY,
        });
      prismaMock.shipment.update.mockResolvedValue({
        ...draftShipment,
        status: ShipmentStatus.READY,
      });

      const result = await service.prepare(mockOrgId, 'shp-1', mockUserId);
      expect(result.status).toBe(ShipmentStatus.READY);
      expect(prismaMock.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shp-1' },
          data: expect.objectContaining({ status: ShipmentStatus.READY }),
        }),
      );
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'SHIPMENT_READY' }),
      );
    });

    it('should reject prepare if shipment is not in DRAFT status', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue({
        id: 'shp-ready',
        status: ShipmentStatus.READY,
        lines: [{ id: 'l1' }],
      });

      await expect(
        service.prepare(mockOrgId, 'shp-ready', mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('markInTransit (DISPATCHED -> IN_TRANSIT)', () => {
    it('should transition dispatched shipment to IN_TRANSIT with tracking event', async () => {
      const dispatchedShipment = {
        id: 'shp-disp',
        organizationId: mockOrgId,
        shipmentNumber: 'SHP-000002',
        status: ShipmentStatus.DISPATCHED,
        lines: [{ id: 'l1' }],
        carrier: null,
        vehicle: null,
        deliveryOrder: null,
        salesOrder: null,
        customer: null,
        packages: [],
        trackingEvents: [],
      };

      prismaMock.shipment.findFirst
        .mockResolvedValueOnce(dispatchedShipment)
        .mockResolvedValueOnce({
          ...dispatchedShipment,
          status: ShipmentStatus.IN_TRANSIT,
        });
      prismaMock.shipment.update.mockResolvedValue({
        ...dispatchedShipment,
        status: ShipmentStatus.IN_TRANSIT,
      });

      const result = await service.markInTransit(
        mockOrgId,
        'shp-disp',
        'Departed hub',
        'Chicago Hub',
        mockUserId,
      );

      expect(result.status).toBe(ShipmentStatus.IN_TRANSIT);
      expect(prismaMock.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shp-disp' },
          data: expect.objectContaining({ status: ShipmentStatus.IN_TRANSIT }),
        }),
      );
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'SHIPMENT_IN_TRANSIT' }),
      );
    });

    it('should reject markInTransit if shipment is in DRAFT status', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue({
        id: 'shp-draft',
        status: ShipmentStatus.DRAFT,
      });

      await expect(
        service.markInTransit(
          mockOrgId,
          'shp-draft',
          undefined,
          undefined,
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('markDelivered (IN_TRANSIT -> DELIVERED)', () => {
    it('should mark in-transit shipment as delivered and record delivery timestamp', async () => {
      const inTransitShipment = {
        id: 'shp-transit',
        organizationId: mockOrgId,
        shipmentNumber: 'SHP-000003',
        status: ShipmentStatus.IN_TRANSIT,
        lines: [{ id: 'l1' }],
        carrier: null,
        vehicle: null,
        deliveryOrder: null,
        salesOrder: null,
        customer: null,
        packages: [],
        trackingEvents: [],
      };

      prismaMock.shipment.findFirst
        .mockResolvedValueOnce(inTransitShipment)
        .mockResolvedValueOnce({
          ...inTransitShipment,
          status: ShipmentStatus.DELIVERED,
        });
      prismaMock.shipment.update.mockResolvedValue({
        ...inTransitShipment,
        status: ShipmentStatus.DELIVERED,
      });

      const result = await service.markDelivered(
        mockOrgId,
        'shp-transit',
        'Signed by receiver',
        'Customer Facility',
        mockUserId,
      );

      expect(result.status).toBe(ShipmentStatus.DELIVERED);
      expect(prismaMock.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shp-transit' },
          data: expect.objectContaining({
            status: ShipmentStatus.DELIVERED,
            deliveredByUserId: mockUserId,
          }),
        }),
      );
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'SHIPMENT_DELIVERED' }),
      );
    });
  });

  describe('close & cancel', () => {
    it('should close delivered shipment', async () => {
      const deliveredShipment = {
        id: 'shp-del',
        organizationId: mockOrgId,
        shipmentNumber: 'SHP-000004',
        status: ShipmentStatus.DELIVERED,
        lines: [{ id: 'l1' }],
        carrier: null,
        vehicle: null,
        deliveryOrder: null,
        salesOrder: null,
        customer: null,
        packages: [],
        trackingEvents: [],
      };

      prismaMock.shipment.findFirst
        .mockResolvedValueOnce(deliveredShipment)
        .mockResolvedValueOnce({
          ...deliveredShipment,
          status: ShipmentStatus.CLOSED,
        });
      prismaMock.shipment.update.mockResolvedValue({
        ...deliveredShipment,
        status: ShipmentStatus.CLOSED,
      });

      const result = await service.close(mockOrgId, 'shp-del', mockUserId);
      expect(result.status).toBe(ShipmentStatus.CLOSED);
      expect(prismaMock.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shp-del' },
          data: expect.objectContaining({ status: ShipmentStatus.CLOSED }),
        }),
      );
    });

    it('should cancel ready shipment and record cancellation reason', async () => {
      const readyShipment = {
        id: 'shp-cancel',
        organizationId: mockOrgId,
        shipmentNumber: 'SHP-000005',
        status: ShipmentStatus.READY,
        lines: [{ id: 'l1' }],
        carrier: null,
        vehicle: null,
        deliveryOrder: null,
        salesOrder: null,
        customer: null,
        packages: [],
        trackingEvents: [],
      };

      prismaMock.shipment.findFirst
        .mockResolvedValueOnce(readyShipment)
        .mockResolvedValueOnce({
          ...readyShipment,
          status: ShipmentStatus.CANCELLED,
        });
      prismaMock.shipment.update.mockResolvedValue({
        ...readyShipment,
        status: ShipmentStatus.CANCELLED,
      });

      const result = await service.cancel(
        mockOrgId,
        'shp-cancel',
        { cancellationReason: 'Customer requested cancellation' },
        mockUserId,
      );

      expect(result.status).toBe(ShipmentStatus.CANCELLED);
      expect(prismaMock.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shp-cancel' },
          data: expect.objectContaining({
            status: ShipmentStatus.CANCELLED,
            cancellationReason: 'Customer requested cancellation',
          }),
        }),
      );
    });

    it('should reject cancellation of dispatched or delivered shipment', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue({
        id: 'shp-disp',
        status: ShipmentStatus.DISPATCHED,
        lines: [{ id: 'l1' }],
      });

      await expect(
        service.cancel(
          mockOrgId,
          'shp-disp',
          { cancellationReason: 'Too late' },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
