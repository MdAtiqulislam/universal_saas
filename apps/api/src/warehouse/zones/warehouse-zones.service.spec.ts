import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseZonesService } from './warehouse-zones.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('WarehouseZonesService', () => {
  let service: WarehouseZonesService;
  let prisma: any;
  let eventBus: any;

  const mockOrgId = 'org-111';
  const mockLocationId = 'loc-111';

  beforeEach(async () => {
    prisma = {
      location: {
        findFirst: jest.fn(),
      },
      warehouseZone: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseZonesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get<WarehouseZonesService>(WarehouseZonesService);
  });

  it('should create a warehouse zone successfully and emit event', async () => {
    prisma.location.findFirst.mockResolvedValue({
      id: mockLocationId,
      organizationId: mockOrgId,
      name: 'Main Warehouse',
    });
    prisma.warehouseZone.findUnique.mockResolvedValue(null);
    prisma.warehouseZone.create.mockResolvedValue({
      id: 'zone-1',
      organizationId: mockOrgId,
      locationId: mockLocationId,
      code: 'ZONE-A',
      name: 'Storage Zone A',
      zoneType: 'STORAGE',
      isActive: true,
      location: { id: mockLocationId, code: 'WH1', name: 'Main Warehouse' },
    });

    const result = await service.create(
      mockOrgId,
      {
        locationId: mockLocationId,
        code: 'ZONE-A',
        name: 'Storage Zone A',
      },
      'user-1',
    );

    expect(result.code).toBe('ZONE-A');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'WAREHOUSE_ZONE_CREATED',
        organizationId: mockOrgId,
      }),
    );
  });

  it('should throw ConflictException if zone code already exists in location', async () => {
    prisma.location.findFirst.mockResolvedValue({
      id: mockLocationId,
      organizationId: mockOrgId,
      name: 'Main Warehouse',
    });
    prisma.warehouseZone.findUnique.mockResolvedValue({ id: 'existing-zone' });

    await expect(
      service.create(mockOrgId, {
        locationId: mockLocationId,
        code: 'ZONE-A',
        name: 'Zone A duplicate',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException if location does not belong to tenant', async () => {
    prisma.location.findFirst.mockResolvedValue(null);

    await expect(
      service.create(mockOrgId, {
        locationId: 'foreign-loc',
        code: 'ZONE-X',
        name: 'Zone X',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
