import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TrackingType, Prisma } from '@prisma/client';
import { BatchesService } from './batches.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { BalancesService } from '../balances/balances.service';

describe('BatchesService (M09)', () => {
  let service: BatchesService;
  let prismaMock: any;
  let eventBusMock: any;
  let balancesServiceMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';
  const mockItemId = '33333333-3333-3333-3333-333333333333';
  const mockLocationId = '44444444-4444-4444-4444-444444444444';

  beforeEach(async () => {
    prismaMock = {
      item: {
        findFirst: jest.fn(),
      },
      location: {
        findFirst: jest.fn(),
      },
      itemVariant: {
        findFirst: jest.fn(),
      },
      inventoryBatch: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    balancesServiceMock = {
      applyStockMovement: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: BalancesService, useValue: balancesServiceMock },
      ],
    }).compile();

    service = module.get<BatchesService>(BatchesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. should create a new batch for BATCH-tracked item', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      organizationId: mockOrgId,
      sku: 'PROD-BATCH',
      trackingType: TrackingType.BATCH,
    });
    prismaMock.location.findFirst.mockResolvedValue({
      id: mockLocationId,
      organizationId: mockOrgId,
      code: 'WH-1',
    });
    prismaMock.inventoryBatch.findFirst.mockResolvedValue(null);
    prismaMock.inventoryBatch.create.mockResolvedValue({
      id: 'batch-1',
      organizationId: mockOrgId,
      itemId: mockItemId,
      locationId: mockLocationId,
      batchNumber: 'LOT-2026-A',
      quantity: new Prisma.Decimal('0.0000'),
    });

    const result = await service.create(
      mockOrgId,
      {
        itemId: mockItemId,
        locationId: mockLocationId,
        batchNumber: 'lot-2026-a',
      },
      mockUserId,
    );

    expect(result.batchNumber).toBe('LOT-2026-A');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'BATCH_CREATED',
      }),
    );
  });

  it('2. should reject batch creation for non-BATCH tracked item', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      organizationId: mockOrgId,
      sku: 'PROD-NONE',
      trackingType: TrackingType.NONE,
    });

    await expect(
      service.create(
        mockOrgId,
        {
          itemId: mockItemId,
          locationId: mockLocationId,
          batchNumber: 'LOT-1',
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should reject duplicate batch number for same item at same location', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      organizationId: mockOrgId,
      sku: 'PROD-BATCH',
      trackingType: TrackingType.BATCH,
    });
    prismaMock.location.findFirst.mockResolvedValue({
      id: mockLocationId,
      organizationId: mockOrgId,
      code: 'WH-1',
    });
    prismaMock.inventoryBatch.findFirst.mockResolvedValue({
      id: 'batch-existing',
      batchNumber: 'LOT-DUP',
    });

    await expect(
      service.create(
        mockOrgId,
        {
          itemId: mockItemId,
          locationId: mockLocationId,
          batchNumber: 'LOT-DUP',
        },
        mockUserId,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('4. should auto-receive initial quantity when specified', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      organizationId: mockOrgId,
      sku: 'PROD-BATCH',
      trackingType: TrackingType.BATCH,
    });
    prismaMock.location.findFirst.mockResolvedValue({
      id: mockLocationId,
      organizationId: mockOrgId,
      code: 'WH-1',
    });
    prismaMock.inventoryBatch.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'batch-1',
        batchNumber: 'LOT-INIT',
        quantity: new Prisma.Decimal('50.0000'),
      });
    prismaMock.inventoryBatch.create.mockResolvedValue({
      id: 'batch-1',
      organizationId: mockOrgId,
      itemId: mockItemId,
      locationId: mockLocationId,
      batchNumber: 'LOT-INIT',
      quantity: new Prisma.Decimal('0.0000'),
    });

    const result = await service.create(
      mockOrgId,
      {
        itemId: mockItemId,
        locationId: mockLocationId,
        batchNumber: 'LOT-INIT',
        initialQuantity: 50,
      },
      mockUserId,
    );

    expect(balancesServiceMock.applyStockMovement).toHaveBeenCalledWith(
      mockOrgId,
      expect.objectContaining({
        batchId: 'batch-1',
        quantity: 50,
      }),
      mockUserId,
    );
    expect(result.id).toBe('batch-1');
  });

  it('5. should update batch dates and emit BATCH_UPDATED', async () => {
    prismaMock.inventoryBatch.findFirst.mockResolvedValue({
      id: 'batch-1',
      organizationId: mockOrgId,
      batchNumber: 'LOT-1',
    });
    prismaMock.inventoryBatch.update.mockResolvedValue({
      id: 'batch-1',
      batchNumber: 'LOT-1',
      expiresAt: new Date('2028-12-31'),
    });

    const result = await service.update(
      mockOrgId,
      'batch-1',
      { expiresAt: '2028-12-31T00:00:00Z' },
      mockUserId,
    );

    expect(result.id).toBe('batch-1');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'BATCH_UPDATED',
      }),
    );
  });

  it('6. should throw NotFoundException when batch is missing', async () => {
    prismaMock.inventoryBatch.findFirst.mockResolvedValue(null);

    await expect(service.findOne(mockOrgId, 'missing-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
