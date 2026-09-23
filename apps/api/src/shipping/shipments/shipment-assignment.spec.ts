import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ShipmentStatus } from '@prisma/client';

describe('ShipmentCarrierAndVehicleAssignment', () => {
  let service: ShipmentsService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = 'user-assign-admin';

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
      shipmentVehicle: {
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

  describe('assignCarrier', () => {
    it('should assign active carrier and transition status to ASSIGNED', async () => {
      const readyShipment = {
        id: 'shp-1',
        organizationId: mockOrgId,
        shipmentNumber: 'SHP-000001',
        status: ShipmentStatus.READY,
        trackingNumber: null,
        serviceType: null,
        lines: [],
        carrier: null,
        vehicle: null,
        deliveryOrder: null,
        salesOrder: null,
        customer: null,
        packages: [],
        trackingEvents: [],
      };

      prismaMock.shipment.findFirst.mockResolvedValue(readyShipment);
      prismaMock.shipmentCarrier.findFirst.mockResolvedValue({
        id: 'carrier-1',
        organizationId: mockOrgId,
        code: 'DHL',
        name: 'DHL Express',
        isActive: true,
      });

      await service.assignCarrier(
        mockOrgId,
        'shp-1',
        {
          carrierId: 'carrier-1',
          trackingNumber: 'TRACK-123',
          serviceType: 'EXPRESS',
        },
        mockUserId,
      );

      expect(prismaMock.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shp-1' },
          data: expect.objectContaining({
            carrierId: 'carrier-1',
            trackingNumber: 'TRACK-123',
            serviceType: 'EXPRESS',
            status: ShipmentStatus.ASSIGNED,
          }),
        }),
      );
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'SHIPMENT_CARRIER_ASSIGNED' }),
      );
    });

    it('should reject assigning inactive carrier', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue({
        id: 'shp-1',
        status: ShipmentStatus.READY,
      });
      prismaMock.shipmentCarrier.findFirst.mockResolvedValue({
        id: 'carrier-inactive',
        isActive: false,
        name: 'Inactive Logistics',
      });

      await expect(
        service.assignCarrier(
          mockOrgId,
          'shp-1',
          { carrierId: 'carrier-inactive' },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject assigning non-existent or cross-tenant carrier', async () => {
      prismaMock.shipment.findFirst.mockResolvedValue({
        id: 'shp-1',
        status: ShipmentStatus.READY,
      });
      prismaMock.shipmentCarrier.findFirst.mockResolvedValue(null);

      await expect(
        service.assignCarrier(
          mockOrgId,
          'shp-1',
          { carrierId: 'carrier-cross-tenant' },
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignVehicle', () => {
    it('should assign active vehicle to shipment', async () => {
      const assignedShipment = {
        id: 'shp-1',
        organizationId: mockOrgId,
        shipmentNumber: 'SHP-000001',
        status: ShipmentStatus.ASSIGNED,
        lines: [],
        carrier: null,
        vehicle: null,
        deliveryOrder: null,
        salesOrder: null,
        customer: null,
        packages: [],
        trackingEvents: [],
      };

      prismaMock.shipment.findFirst.mockResolvedValue(assignedShipment);
      prismaMock.shipmentVehicle.findFirst.mockResolvedValue({
        id: 'veh-1',
        organizationId: mockOrgId,
        registrationNumber: 'TRUCK-999',
        isActive: true,
      });

      await service.assignVehicle(
        mockOrgId,
        'shp-1',
        { vehicleId: 'veh-1' },
        mockUserId,
      );

      expect(prismaMock.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shp-1' },
          data: expect.objectContaining({ vehicleId: 'veh-1' }),
        }),
      );
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'SHIPMENT_VEHICLE_ASSIGNED' }),
      );
    });
  });
});
