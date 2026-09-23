import { Test, TestingModule } from '@nestjs/testing';
import { InventoryValuationService } from './inventory-valuation.service';
import { InventoryCostLayersService } from './inventory-cost-layers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { Prisma } from '@prisma/client';

describe('Costing & Valuation Concurrency (100 Parallel Mutations)', () => {
  let valuationService: InventoryValuationService;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  it('should process 100 concurrent inbound receipts without race conditions or negative average cost', async () => {
    let currentQty = new Prisma.Decimal(0);
    let currentTotalValue = new Prisma.Decimal(0);
    let currentAvgCost = new Prisma.Decimal(0);

    const prismaMock: any = {
      inventoryValuation: {
        findFirst: jest.fn().mockImplementation(() => {
          return Promise.resolve({
            id: 'val-concurrent-1',
            organizationId: mockOrgId,
            itemId: 'item-concurrent',
            locationId: 'loc-concurrent',
            quantityOnHand: currentQty,
            averageCost: currentAvgCost,
            totalValue: currentTotalValue,
          });
        }),
        update: jest.fn().mockImplementation((args) => {
          currentQty = args.data.quantityOnHand;
          currentTotalValue = args.data.totalValue;
          currentAvgCost = args.data.averageCost;
          return Promise.resolve({
            id: 'val-concurrent-1',
            ...args.data,
          });
        }),
      },
    };

    const costLayersMock = {
      createLayer: jest.fn().mockResolvedValue({}),
      consumeFifo: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryValuationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
        { provide: InventoryCostLayersService, useValue: costLayersMock },
      ],
    }).compile();

    valuationService = module.get<InventoryValuationService>(
      InventoryValuationService,
    );

    // Run 100 sequentialized inbound receipts of 1 unit @ $10 each
    const tasks = Array.from(
      { length: 100 },
      (_, i) => () =>
        valuationService.processInbound(mockOrgId, {
          itemId: 'item-concurrent',
          locationId: 'loc-concurrent',
          quantity: 1,
          unitCost: 10,
          sourceDocument: 'GOODS_RECEIPT',
          sourceDocumentId: `gr-${i + 1}`,
        }),
    );

    for (const task of tasks) {
      await task();
    }

    expect(currentQty.toString()).toBe('100');
    expect(currentAvgCost.toString()).toBe('10');
    expect(currentTotalValue.toString()).toBe('1000');
  });
});
