import { Test, TestingModule } from '@nestjs/testing';
import { InventoryCostLayersService } from './inventory-cost-layers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('InventoryCostLayersService', () => {
  let service: InventoryCostLayersService;
  let prismaMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prismaMock = {
      inventoryCostLayer: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryCostLayersService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<InventoryCostLayersService>(
      InventoryCostLayersService,
    );
  });

  it('1. should create an inbound inventory cost layer', async () => {
    prismaMock.inventoryCostLayer.create.mockImplementation((args: any) => ({
      id: 'layer-1',
      ...args.data,
    }));

    const result = await service.createLayer(mockOrgId, {
      itemId: 'item-1',
      locationId: 'loc-1',
      receiptQuantity: 10,
      unitCost: 25.5,
      sourceDocument: 'GOODS_RECEIPT',
      sourceDocumentId: 'gr-1',
    });

    expect(result.id).toBe('layer-1');
    expect(result.receiptQuantity.toString()).toBe('10');
    expect(result.unitCost.toString()).toBe('25.5');
    expect(result.remainingQuantity.toString()).toBe('10');
    expect(result.consumedQuantity.toString()).toBe('0');
  });

  it('2. should reject negative or zero receipt quantity', async () => {
    await expect(
      service.createLayer(mockOrgId, {
        itemId: 'item-1',
        locationId: 'loc-1',
        receiptQuantity: 0,
        unitCost: 10,
        sourceDocument: 'GOODS_RECEIPT',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should consume cost layers using FIFO across multiple layers', async () => {
    // Layer 1: 5 units @ $10 (Total $50)
    // Layer 2: 10 units @ $12 (Total $120)
    // Consume 8 units -> 5 from Layer 1 ($50) + 3 from Layer 2 ($36) = $86 (avg unit cost 10.75)
    prismaMock.inventoryCostLayer.findMany.mockResolvedValue([
      {
        id: 'layer-1',
        unitCost: new Prisma.Decimal(10),
        remainingQuantity: new Prisma.Decimal(5),
        consumedQuantity: new Prisma.Decimal(0),
      },
      {
        id: 'layer-2',
        unitCost: new Prisma.Decimal(12),
        remainingQuantity: new Prisma.Decimal(10),
        consumedQuantity: new Prisma.Decimal(0),
      },
    ]);

    prismaMock.inventoryCostLayer.update.mockResolvedValue({});

    const result = await service.consumeFifo(mockOrgId, {
      itemId: 'item-1',
      locationId: 'loc-1',
      quantity: 8,
    });

    expect(result.totalQuantity.toString()).toBe('8');
    expect(result.totalCost.toString()).toBe('86');
    expect(result.averageUnitCost.toString()).toBe('10.75');
    expect(result.uncoveredQuantity.isZero()).toBe(true);
    expect(result.consumedLayers.length).toBe(2);

    expect(prismaMock.inventoryCostLayer.update).toHaveBeenCalledWith({
      where: { id: 'layer-1' },
      data: {
        remainingQuantity: new Prisma.Decimal(0),
        consumedQuantity: new Prisma.Decimal(5),
      },
    });

    expect(prismaMock.inventoryCostLayer.update).toHaveBeenCalledWith({
      where: { id: 'layer-2' },
      data: {
        remainingQuantity: new Prisma.Decimal(7),
        consumedQuantity: new Prisma.Decimal(3),
      },
    });
  });
});
