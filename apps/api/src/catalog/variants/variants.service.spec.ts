import { Test, TestingModule } from '@nestjs/testing';
import { VariantsService } from './variants.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

describe('VariantsService', () => {
  let service: VariantsService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockItemId = '22222222-2222-2222-2222-222222222222';
  const mockUserId = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    prismaMock = {
      item: {
        findFirst: jest.fn(),
      },
      itemVariant: {
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
        VariantsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<VariantsService>(VariantsService);
  });

  it('1. should create a valid variant and emit VARIANT_CREATED', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      organizationId: mockOrgId,
      sku: 'SHIRT-001',
      isActive: true,
    });
    prismaMock.itemVariant.findFirst.mockResolvedValue(null);
    prismaMock.itemVariant.create.mockResolvedValue({
      id: 'var-1',
      organizationId: mockOrgId,
      itemId: mockItemId,
      sku: 'SHIRT-001-RED-XL',
      name: 'Red XL',
      attributes: { color: 'Red', size: 'XL' },
      isActive: true,
    });

    const result = await service.create(
      mockOrgId,
      mockItemId,
      {
        sku: 'shirt-001-red-xl',
        name: 'Red XL',
        attributes: { color: 'Red', size: 'XL' },
      },
      mockUserId,
    );

    expect(result.sku).toBe('SHIRT-001-RED-XL');
    expect(prismaMock.itemVariant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: mockOrgId,
        itemId: mockItemId,
        sku: 'SHIRT-001-RED-XL',
      }),
    });
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'VARIANT_CREATED',
        organizationId: mockOrgId,
      }),
    );
  });

  it('2. should reject variant creation when parent item does not exist', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        mockOrgId,
        'non-existent-item',
        { sku: 'VAR-1' },
        mockUserId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('3. should reject variant creation when parent item is inactive', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      sku: 'SHIRT-001',
      isActive: false,
    });

    await expect(
      service.create(
        mockOrgId,
        mockItemId,
        { sku: 'SHIRT-001-BLUE' },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('4. should reject duplicate variant SKU in same organization', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      sku: 'SHIRT-001',
      isActive: true,
    });
    prismaMock.itemVariant.findFirst.mockResolvedValue({
      id: 'var-1',
      sku: 'SHIRT-001-RED',
    });

    await expect(
      service.create(
        mockOrgId,
        mockItemId,
        { sku: 'SHIRT-001-RED' },
        mockUserId,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('5. should list all variants by parent item', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      organizationId: mockOrgId,
    });
    prismaMock.itemVariant.findMany.mockResolvedValue([
      { id: 'var-1', sku: 'VAR-1' },
      { id: 'var-2', sku: 'VAR-2' },
    ]);

    const result = await service.findAllByItem(mockOrgId, mockItemId);
    expect(result).toHaveLength(2);
  });

  it('6. should find single variant by ID', async () => {
    prismaMock.itemVariant.findFirst.mockResolvedValue({
      id: 'var-1',
      organizationId: mockOrgId,
      sku: 'VAR-1',
    });

    const result = await service.findOne(mockOrgId, 'var-1');
    expect(result.id).toBe('var-1');
  });

  it('7. should soft delete variant and emit VARIANT_ARCHIVED', async () => {
    prismaMock.itemVariant.findFirst.mockResolvedValue({
      id: 'var-1',
      organizationId: mockOrgId,
      sku: 'VAR-1',
    });
    prismaMock.itemVariant.update.mockResolvedValue({
      id: 'var-1',
      isActive: false,
      deletedAt: new Date(),
    });

    const result = await service.softDelete(mockOrgId, 'var-1', mockUserId);
    expect(result.success).toBe(true);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'VARIANT_ARCHIVED',
      }),
    );
  });
});
