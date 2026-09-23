import { Test, TestingModule } from '@nestjs/testing';
import { InventoryValuationService } from './inventory-valuation.service';
import { InventoryCostLayersService } from './inventory-cost-layers.service';
import { CogsService } from './cogs.service';
import { CostingService } from './costing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../../ap/account-mapping/ap-account-mapping.service';
import { NotFoundException } from '@nestjs/common';

describe('Tenant Costing and Valuation Isolation', () => {
  let valuationService: InventoryValuationService;
  let cogsService: CogsService;
  let prismaMock: any;

  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    prismaMock = {
      inventoryValuation: {
        findMany: jest.fn().mockImplementation((args) => {
          if (args.where.organizationId === orgA) {
            return Promise.resolve([
              { id: 'val-A', organizationId: orgA, totalValue: 500 },
            ]);
          }
          return Promise.resolve([]);
        }),
        count: jest.fn().mockImplementation((args) => {
          return Promise.resolve(args.where.organizationId === orgA ? 1 : 0);
        }),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { quantityOnHand: 0, totalValue: 0 },
        }),
      },
      item: {
        findFirst: jest.fn().mockImplementation((args) => {
          if (
            args.where.organizationId === orgA &&
            args.where.id === 'item-A'
          ) {
            return Promise.resolve({ id: 'item-A', organizationId: orgA });
          }
          return Promise.resolve(null);
        }),
      },
      inventoryCostLayer: {
        findMany: jest.fn().mockImplementation((args) => {
          if (args.where.organizationId === orgA) {
            return Promise.resolve([{ id: 'layer-A', organizationId: orgA }]);
          }
          return Promise.resolve([]);
        }),
        count: jest.fn().mockResolvedValue(0),
      },
      costOfGoodsSoldRecord: {
        findMany: jest.fn().mockImplementation((args) => {
          if (args.where.organizationId === orgA) {
            return Promise.resolve([{ id: 'cogs-A', organizationId: orgA }]);
          }
          return Promise.resolve([]);
        }),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { quantity: 0, totalCost: 0 },
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryValuationService,
        InventoryCostLayersService,
        CogsService,
        CostingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
        { provide: NumberingService, useValue: { nextNumber: jest.fn() } },
        {
          provide: ApAccountMappingService,
          useValue: { resolveAccount: jest.fn() },
        },
      ],
    }).compile();

    valuationService = module.get<InventoryValuationService>(
      InventoryValuationService,
    );
    cogsService = module.get<CogsService>(CogsService);
  });

  it('1. Org B should not see Org A inventory valuations', async () => {
    const resA = await valuationService.getValuation(orgA, {});
    expect(resA.items.length).toBe(1);
    expect(resA.items[0].organizationId).toBe(orgA);

    const resB = await valuationService.getValuation(orgB, {});
    expect(resB.items.length).toBe(0);
  });

  it('2. Org B cannot view Org A item cost history', async () => {
    await expect(
      valuationService.getItemCostHistory(orgB, 'item-A', {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('3. Org B should not see Org A COGS records', async () => {
    const resA = await cogsService.getCogsReport(orgA, {});
    expect(resA.items.length).toBe(1);
    expect(resA.items[0].organizationId).toBe(orgA);

    const resB = await cogsService.getCogsReport(orgB, {});
    expect(resB.items.length).toBe(0);
  });
});
