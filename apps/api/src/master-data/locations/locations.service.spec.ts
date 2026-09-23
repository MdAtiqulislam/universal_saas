import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { LocationsService } from './locations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';

describe('LocationsService', () => {
  let service: LocationsService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = 'org-1111-1111';
  const mockLocationId = 'loc-2222-2222';

  const mockLocation = {
    id: mockLocationId,
    organizationId: mockOrgId,
    name: 'Main Warehouse',
    code: 'WH-01',
    type: 'WAREHOUSE',
    parentId: null,
    addressLine1: '123 Industrial Ave',
    city: 'Dhaka',
    countryCode: 'BD',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    prismaMock = {
      location: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
  });

  describe('create', () => {
    it('1. should create location successfully', async () => {
      prismaMock.location.findFirst.mockResolvedValue(null);
      prismaMock.location.create.mockResolvedValue(mockLocation);

      const result = await service.create(
        mockOrgId,
        {
          name: 'Main Warehouse',
          code: 'wh-01',
          type: 'WAREHOUSE',
          city: 'Dhaka',
        },
        'user-1',
      );

      expect(result.code).toBe('WH-01');
      expect(prismaMock.location.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: mockOrgId,
          code: 'WH-01',
          name: 'Main Warehouse',
          type: 'WAREHOUSE',
        }),
      });
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'LOCATION_CREATED',
          organizationId: mockOrgId,
        }),
      );
    });

    it('2. should reject duplicate code within the same organization', async () => {
      prismaMock.location.findFirst.mockResolvedValue(mockLocation);

      await expect(
        service.create(mockOrgId, { name: 'WH 2', code: 'WH-01' }),
      ).rejects.toThrow(ConflictException);
    });

    it('3. should reject invalid parent location ID', async () => {
      prismaMock.location.findFirst
        .mockResolvedValueOnce(null) // code check
        .mockResolvedValueOnce(null); // parent check (not found)

      await expect(
        service.create(mockOrgId, {
          name: 'Section A',
          code: 'SEC-A',
          parentId: 'invalid-parent-id',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne & findAll', () => {
    it('4. should return location scoped to organization', async () => {
      prismaMock.location.findFirst.mockResolvedValue(mockLocation);

      const result = await service.findOne(mockOrgId, mockLocationId);
      expect(result.id).toBe(mockLocationId);
      expect(prismaMock.location.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockLocationId,
          organizationId: mockOrgId,
          deletedAt: null,
        },
        include: expect.any(Object),
      });
    });

    it('5. should throw NotFoundException when location belongs to another org (IDOR protection)', async () => {
      prismaMock.location.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('other-org-id', mockLocationId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('6. should reject self-parenting on update', async () => {
      prismaMock.location.findFirst.mockResolvedValue(mockLocation);

      await expect(
        service.update(mockOrgId, mockLocationId, {
          parentId: mockLocationId,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('7. should update location details and publish event', async () => {
      prismaMock.location.findFirst.mockResolvedValue(mockLocation);
      prismaMock.location.update.mockResolvedValue({
        ...mockLocation,
        name: 'Central Logistics Hub',
      });

      const result = await service.update(
        mockOrgId,
        mockLocationId,
        { name: 'Central Logistics Hub' },
        'user-1',
      );

      expect(result.name).toBe('Central Logistics Hub');
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'LOCATION_UPDATED',
          organizationId: mockOrgId,
        }),
      );
    });
  });

  describe('softDelete', () => {
    it('8. should prevent deleting location with active children', async () => {
      prismaMock.location.findFirst.mockResolvedValue(mockLocation);
      prismaMock.location.count.mockResolvedValue(2); // 2 active child locations

      await expect(
        service.softDelete(mockOrgId, mockLocationId),
      ).rejects.toThrow(ConflictException);
    });

    it('9. should soft-delete location when no active children exist', async () => {
      prismaMock.location.findFirst.mockResolvedValue(mockLocation);
      prismaMock.location.count.mockResolvedValue(0);
      prismaMock.location.update.mockResolvedValue({
        ...mockLocation,
        isActive: false,
        deletedAt: new Date(),
      });

      const result = await service.softDelete(
        mockOrgId,
        mockLocationId,
        'user-1',
      );

      expect(result.success).toBe(true);
      expect(prismaMock.location.update).toHaveBeenCalledWith({
        where: { id: mockLocationId },
        data: {
          isActive: false,
          deletedAt: expect.any(Date),
        },
      });
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'LOCATION_ARCHIVED',
          organizationId: mockOrgId,
        }),
      );
    });
  });
});
