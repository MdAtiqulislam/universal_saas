import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ShipmentCarriersService } from './shipment-carriers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CarrierType } from '@prisma/client';

describe('ShipmentCarriersService', () => {
  let service: ShipmentCarriersService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = 'user-carrier-admin';

  beforeEach(async () => {
    prismaMock = {
      shipmentCarrier: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      shipment: {
        count: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentCarriersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<ShipmentCarriersService>(ShipmentCarriersService);
  });

  describe('create', () => {
    it('should create a carrier with normalized uppercase code', async () => {
      prismaMock.shipmentCarrier.findFirst.mockResolvedValue(null);
      prismaMock.shipmentCarrier.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'carrier-1', ...data }),
      );

      const result = await service.create(
        mockOrgId,
        {
          code: 'dhl',
          name: 'DHL Express',
          carrierType: CarrierType.COURIER,
          phone: '+123456789',
        },
        mockUserId,
      );

      expect(result.code).toBe('DHL');
      expect(result.name).toBe('DHL Express');
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'CARRIER_CREATED',
          organizationId: mockOrgId,
        }),
      );
    });

    it('should reject duplicate carrier code within the same organization', async () => {
      prismaMock.shipmentCarrier.findFirst.mockResolvedValue({
        id: 'existing',
      });

      await expect(
        service.create(
          mockOrgId,
          {
            code: 'DHL',
            name: 'DHL Duplicate',
          },
          mockUserId,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated list of carriers for tenant', async () => {
      prismaMock.shipmentCarrier.findMany.mockResolvedValue([
        { id: 'c1', code: 'DHL', name: 'DHL Express' },
        { id: 'c2', code: 'FEDEX', name: 'Federal Express' },
      ]);
      prismaMock.shipmentCarrier.count.mockResolvedValue(2);

      const result = await service.findAll(mockOrgId, { page: 1, limit: 10 });
      expect(result.carriers).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return carrier by ID', async () => {
      prismaMock.shipmentCarrier.findFirst.mockResolvedValue({
        id: 'c1',
        organizationId: mockOrgId,
        code: 'DHL',
      });

      const result = await service.findOne(mockOrgId, 'c1');
      expect(result.id).toBe('c1');
      expect(result.code).toBe('DHL');
    });

    it('should throw NotFoundException if carrier does not exist', async () => {
      prismaMock.shipmentCarrier.findFirst.mockResolvedValue(null);
      await expect(service.findOne(mockOrgId, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('activation and deactivation', () => {
    it('should activate an inactive carrier', async () => {
      prismaMock.shipmentCarrier.findFirst.mockResolvedValue({
        id: 'c1',
        organizationId: mockOrgId,
        code: 'DHL',
        isActive: false,
      });
      prismaMock.shipmentCarrier.update.mockResolvedValue({
        id: 'c1',
        code: 'DHL',
        isActive: true,
      });

      const result = await service.activate(mockOrgId, 'c1', mockUserId);
      expect(result.isActive).toBe(true);
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'CARRIER_ACTIVATED' }),
      );
    });

    it('should deactivate an active carrier', async () => {
      prismaMock.shipmentCarrier.findFirst.mockResolvedValue({
        id: 'c1',
        organizationId: mockOrgId,
        code: 'DHL',
        isActive: true,
      });
      prismaMock.shipmentCarrier.update.mockResolvedValue({
        id: 'c1',
        code: 'DHL',
        isActive: false,
      });

      const result = await service.deactivate(mockOrgId, 'c1', mockUserId);
      expect(result.isActive).toBe(false);
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'CARRIER_DEACTIVATED' }),
      );
    });
  });

  describe('delete', () => {
    it('should delete carrier if unreferenced by shipments', async () => {
      prismaMock.shipmentCarrier.findFirst.mockResolvedValue({
        id: 'c1',
        organizationId: mockOrgId,
      });
      prismaMock.shipment.count.mockResolvedValue(0);
      prismaMock.shipmentCarrier.delete.mockResolvedValue({});

      const result = await service.delete(mockOrgId, 'c1', mockUserId);
      expect(result.success).toBe(true);
    });

    it('should reject deletion if carrier is referenced by shipments', async () => {
      prismaMock.shipmentCarrier.findFirst.mockResolvedValue({
        id: 'c1',
        organizationId: mockOrgId,
      });
      prismaMock.shipment.count.mockResolvedValue(3);

      await expect(service.delete(mockOrgId, 'c1', mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
