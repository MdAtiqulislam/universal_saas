import { Test, TestingModule } from '@nestjs/testing';
import { InventoryValuationService } from './inventory-valuation.service';
import { InventoryCostLayersService } from './inventory-cost-layers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { Prisma } from '@prisma/client';

describe('InventoryValuationService', () => {
  let service: InventoryValuationService;
  let prismaMock: any;
  let eventBusMock: any;
  let costLayersMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prismaMock = {
      inventoryValuation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            quantityOnHand: new Prisma.Decimal(0),
            totalValue: new Prisma.Decimal(0),
          },
        }),
      },
    };

    eventBusMock = { publish: jest.fn().mockResolvedValue(undefined) };
    costLayersMock = {
      createLayer: jest.fn().mockResolvedValue({}),
      consumeFifo: jest.fn().mockResolvedValue({
        consumedLayers: [],
        totalQuantity: new Prisma.Decimal(0),
        totalCost: new Prisma.Decimal(0),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryValuationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: InventoryCostLayersService, useValue: costLayersMock },
      ],
    }).compile();

    service = module.get<InventoryValuationService>(InventoryValuationService);
  });

  it('1. should calculate Weighted Average Cost for inbound receipts correctly', async () => {
    // Current stock: 10 units @ $20 (totalValue = 200)
    // Inbound: 10 units @ $30 (incomingValue = 300)
    // New: 20 units, totalValue = 500, newAvgCost = 25
    prismaMock.inventoryValuation.findFirst.mockResolvedValue({
      id: 'val-1',
      organizationId: mockOrgId,
      itemId: 'item-1',
      locationId: 'loc-1',
      quantityOnHand: new Prisma.Decimal(10),
      averageCost: new Prisma.Decimal(20),
      totalValue: new Prisma.Decimal(200),
    });

    prismaMock.inventoryValuation.update.mockImplementation((args: any) => ({
      id: 'val-1',
      ...args.data,
    }));

    const result = await service.processInbound(mockOrgId, {
      itemId: 'item-1',
      locationId: 'loc-1',
      quantity: 10,
      unitCost: 30,
      sourceDocument: 'GOODS_RECEIPT',
      sourceDocumentId: 'gr-1',
    });

    expect(result.quantityOnHand.toString()).toBe('20');
    expect(result.averageCost.toString()).toBe('25');
    expect(result.totalValue.toString()).toBe('500');
    expect(costLayersMock.createLayer).toHaveBeenCalledWith(
      mockOrgId,
      expect.objectContaining({
        itemId: 'item-1',
        receiptQuantity: new Prisma.Decimal(10),
        unitCost: new Prisma.Decimal(30),
      }),
      prismaMock,
    );
  });

  it('2. should preserve Weighted Average Cost on outbound issues and reduce quantity', async () => {
    // Current stock: 20 units @ $25 (totalValue = 500)
    // Outbound: 5 units -> COGS unitCost = $25, totalCost = $125
    // Remaining: 15 units @ $25 = $375
    prismaMock.inventoryValuation.findFirst.mockResolvedValue({
      id: 'val-1',
      organizationId: mockOrgId,
      itemId: 'item-1',
      locationId: 'loc-1',
      quantityOnHand: new Prisma.Decimal(20),
      averageCost: new Prisma.Decimal(25),
      totalValue: new Prisma.Decimal(500),
    });

    prismaMock.inventoryValuation.update.mockImplementation((args: any) => ({
      id: 'val-1',
      ...args.data,
      averageCost: new Prisma.Decimal(25),
    }));

    const result = await service.processOutbound(mockOrgId, {
      itemId: 'item-1',
      locationId: 'loc-1',
      quantity: 5,
      sourceDocument: 'DELIVERY_ORDER',
      sourceDocumentId: 'do-1',
    });

    expect(result.unitCost.toString()).toBe('25');
    expect(result.totalCost.toString()).toBe('125');
    expect(result.quantityIssued.toString()).toBe('5');
    expect(result.valuation.quantityOnHand.toString()).toBe('15');
    expect(result.valuation.totalValue.toString()).toBe('375');
    expect(costLayersMock.consumeFifo).toHaveBeenCalledWith(
      mockOrgId,
      expect.objectContaining({
        itemId: 'item-1',
        quantity: new Prisma.Decimal(5),
      }),
      prismaMock,
    );
  });

  it('3. should get valuation summary report', async () => {
    prismaMock.inventoryValuation.findMany.mockResolvedValue([
      {
        id: 'val-1',
        quantityOnHand: new Prisma.Decimal(15),
        averageCost: new Prisma.Decimal(25),
        totalValue: new Prisma.Decimal(375),
        item: { sku: 'ITEM-1', name: 'Widget' },
        location: { name: 'Main Warehouse' },
      },
    ]);

    prismaMock.inventoryValuation.count.mockResolvedValue(1);
    prismaMock.inventoryValuation.aggregate.mockResolvedValue({
      _sum: {
        quantityOnHand: new Prisma.Decimal(15),
        totalValue: new Prisma.Decimal(375),
      },
    });

    const result = await service.getValuation(mockOrgId, {});

    expect(result.items.length).toBe(1);
    expect(result.summary.totalQuantityOnHand.toString()).toBe('15');
    expect(result.summary.totalInventoryValue.toString()).toBe('375');
  });
});
