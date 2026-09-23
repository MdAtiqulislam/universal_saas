import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    prismaMock = {
      category: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('1. should create a valid category and publish CATEGORY_CREATED event', async () => {
    prismaMock.category.findFirst.mockResolvedValue(null);
    prismaMock.category.create.mockResolvedValue({
      id: 'cat-1',
      organizationId: mockOrgId,
      code: 'ELECTRONICS',
      name: 'Consumer Electronics',
      description: 'Devices and gadgets',
      parentId: null,
      isActive: true,
    });

    const result = await service.create(
      mockOrgId,
      {
        code: 'electronics',
        name: 'Consumer Electronics',
        description: 'Devices and gadgets',
      },
      mockUserId,
    );

    expect(result.code).toBe('ELECTRONICS');
    expect(prismaMock.category.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: mockOrgId,
        code: 'ELECTRONICS',
        name: 'Consumer Electronics',
        isActive: true,
      }),
    });
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CATEGORY_CREATED',
        organizationId: mockOrgId,
        actorUserId: mockUserId,
      }),
    );
  });

  it('2. should reject duplicate category code in the same organization', async () => {
    prismaMock.category.findFirst.mockResolvedValue({
      id: 'cat-1',
      organizationId: mockOrgId,
      code: 'ELECTRONICS',
    });

    await expect(
      service.create(
        mockOrgId,
        { code: 'ELECTRONICS', name: 'Electronics 2' },
        mockUserId,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('3. should reject category creation when parent category does not exist in tenant', async () => {
    prismaMock.category.findFirst
      .mockResolvedValueOnce(null) // code check
      .mockResolvedValueOnce(null); // parent check

    await expect(
      service.create(
        mockOrgId,
        {
          code: 'SMARTPHONES',
          name: 'Smartphones',
          parentId: 'non-existent-parent',
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('4. should reject self-parenting during update', async () => {
    const catId = 'cat-1';
    prismaMock.category.findFirst.mockResolvedValue({
      id: catId,
      organizationId: mockOrgId,
      code: 'ELECTRONICS',
    });

    await expect(
      service.update(mockOrgId, catId, { parentId: catId }, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });

  it('5. should find single category by ID with parent and children', async () => {
    const mockCategory = {
      id: 'cat-1',
      organizationId: mockOrgId,
      code: 'ELECTRONICS',
      name: 'Electronics',
      parent: null,
      children: [{ id: 'cat-2', code: 'PHONES', name: 'Phones' }],
    };
    prismaMock.category.findFirst.mockResolvedValue(mockCategory);

    const result = await service.findOne(mockOrgId, 'cat-1');
    expect(result.id).toBe('cat-1');
    expect((result as any).children).toHaveLength(1);
  });

  it('6. should throw NotFoundException when finding non-existent category', async () => {
    prismaMock.category.findFirst.mockResolvedValue(null);

    await expect(service.findOne(mockOrgId, 'cat-999')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('7. should soft-delete category and publish CATEGORY_ARCHIVED event', async () => {
    prismaMock.category.findFirst.mockResolvedValue({
      id: 'cat-1',
      organizationId: mockOrgId,
      code: 'ELECTRONICS',
      name: 'Electronics',
    });
    prismaMock.category.update.mockResolvedValue({
      id: 'cat-1',
      isActive: false,
      deletedAt: new Date(),
    });

    const result = await service.softDelete(mockOrgId, 'cat-1', mockUserId);
    expect(result.success).toBe(true);
    expect(prismaMock.category.update).toHaveBeenCalledWith({
      where: { id: 'cat-1' },
      data: expect.objectContaining({ isActive: false }),
    });
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CATEGORY_ARCHIVED',
        organizationId: mockOrgId,
      }),
    );
  });
});
