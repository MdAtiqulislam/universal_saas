import { Test, TestingModule } from '@nestjs/testing';
import { ItemsService } from './items.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ItemType, TrackingType } from '@prisma/client';

describe('ItemsService', () => {
  let service: ItemsService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';
  const mockUnitId = '33333333-3333-3333-3333-333333333333';
  const mockCategoryId = '44444444-4444-4444-4444-444444444444';

  beforeEach(async () => {
    prismaMock = {
      item: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      itemVariant: {
        updateMany: jest.fn(),
      },
      unitOfMeasure: {
        findFirst: jest.fn(),
      },
      category: {
        findFirst: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation((promises) => Promise.all(promises)),
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItemsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<ItemsService>(ItemsService);
  });

  it('1. should create a valid item and emit ITEM_CREATED', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null);
    prismaMock.unitOfMeasure.findFirst.mockResolvedValue({
      id: mockUnitId,
      organizationId: mockOrgId,
      code: 'PCS',
      isActive: true,
    });
    prismaMock.category.findFirst.mockResolvedValue({
      id: mockCategoryId,
      organizationId: mockOrgId,
      code: 'ELECTRONICS',
      isActive: true,
    });
    prismaMock.item.create.mockResolvedValue({
      id: 'item-1',
      organizationId: mockOrgId,
      sku: 'LAPTOP-001',
      name: 'Pro Laptop 15',
      unitId: mockUnitId,
      categoryId: mockCategoryId,
      itemType: ItemType.PRODUCT,
      trackingType: TrackingType.SERIAL,
      isActive: true,
    });

    const result = await service.create(
      mockOrgId,
      {
        sku: 'laptop-001',
        name: 'Pro Laptop 15',
        unitId: mockUnitId,
        categoryId: mockCategoryId,
        itemType: ItemType.PRODUCT,
        trackingType: TrackingType.SERIAL,
      },
      mockUserId,
    );

    expect(result.sku).toBe('LAPTOP-001');
    expect(prismaMock.item.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: mockOrgId,
        sku: 'LAPTOP-001',
        name: 'Pro Laptop 15',
        itemType: ItemType.PRODUCT,
      }),
      include: expect.any(Object),
    });
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'ITEM_CREATED',
        organizationId: mockOrgId,
      }),
    );
  });

  it('2. should reject duplicate SKU in same organization', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: 'item-1',
      organizationId: mockOrgId,
      sku: 'LAPTOP-001',
    });

    await expect(
      service.create(
        mockOrgId,
        {
          sku: 'LAPTOP-001',
          name: 'Duplicate Laptop',
          unitId: mockUnitId,
        },
        mockUserId,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('3. should reject item creation with non-existent unitId', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null);
    prismaMock.unitOfMeasure.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        mockOrgId,
        {
          sku: 'SKU-TEST',
          name: 'Test Item',
          unitId: 'non-existent-unit',
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('4. should reject item creation with inactive unitId', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null);
    prismaMock.unitOfMeasure.findFirst.mockResolvedValue({
      id: mockUnitId,
      code: 'PCS',
      isActive: false,
    });

    await expect(
      service.create(
        mockOrgId,
        {
          sku: 'SKU-TEST',
          name: 'Test Item',
          unitId: mockUnitId,
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('5. should reject item creation with non-existent or inactive category', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null);
    prismaMock.unitOfMeasure.findFirst.mockResolvedValue({
      id: mockUnitId,
      code: 'PCS',
      isActive: true,
    });
    prismaMock.category.findFirst.mockResolvedValue({
      id: mockCategoryId,
      code: 'DISCONTINUED',
      isActive: false,
    });

    await expect(
      service.create(
        mockOrgId,
        {
          sku: 'SKU-TEST',
          name: 'Test Item',
          unitId: mockUnitId,
          categoryId: mockCategoryId,
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('6. should paginate and filter items in findAll', async () => {
    prismaMock.item.count.mockResolvedValue(1);
    prismaMock.item.findMany.mockResolvedValue([
      {
        id: 'item-1',
        organizationId: mockOrgId,
        sku: 'ITEM-1',
        name: 'Item 1',
      },
    ]);

    const result = await service.findAll(mockOrgId, { page: 1, limit: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it('7. should find single item by ID', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: 'item-1',
      organizationId: mockOrgId,
      sku: 'ITEM-1',
      name: 'Item 1',
    });

    const result = await service.findOne(mockOrgId, 'item-1');
    expect(result.id).toBe('item-1');
  });

  it('8. should throw NotFoundException when finding non-existent item', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null);

    await expect(service.findOne(mockOrgId, 'item-999')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('9. should soft delete item and its variants in transaction and emit ITEM_ARCHIVED', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: 'item-1',
      organizationId: mockOrgId,
      sku: 'ITEM-1',
      name: 'Item 1',
    });

    const result = await service.softDelete(mockOrgId, 'item-1', mockUserId);
    expect(result.success).toBe(true);
    expect(prismaMock.item.update).toHaveBeenCalled();
    expect(prismaMock.itemVariant.updateMany).toHaveBeenCalled();
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'ITEM_ARCHIVED',
      }),
    );
  });
});
