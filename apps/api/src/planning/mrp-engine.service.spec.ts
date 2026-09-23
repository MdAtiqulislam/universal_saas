import { Test, TestingModule } from '@nestjs/testing';
import { MrpEngineService } from './mrp-engine.service';
import { PlanningConfigService } from './planning-config.service';
import { BomExplosionService } from './bom-explosion.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { PlannedOrderAction, Prisma } from '@prisma/client';

describe('MrpEngineService', () => {
  let service: MrpEngineService;
  let prisma: any;
  let configService: any;
  let bomExplosionService: any;

  const mockOrgId = 'org-mrp-engine-1';
  const mockUserId = 'user-mrp-1';
  const finishedItemId = 'item-finished-1';
  const rawItemId = 'item-raw-1';

  beforeEach(async () => {
    prisma = {
      salesOrder: { findMany: jest.fn() },
      productionOrder: { findMany: jest.fn() },
      inventoryBalance: { findMany: jest.fn() },
      purchaseOrder: { findMany: jest.fn() },
      billOfMaterial: { findFirst: jest.fn() },
    };

    configService = {
      getItemProfile: jest.fn().mockImplementation((orgId, itemId) => {
        if (itemId === rawItemId) {
          return Promise.resolve({
            leadTimeDays: 5,
            safetyStock: new Prisma.Decimal(20),
            minOrderQuantity: new Prisma.Decimal(50),
            orderMultiple: new Prisma.Decimal(10),
            preferredSupplierId: 'sup-1',
            preferredBomId: null,
          });
        }
        return Promise.resolve({
          leadTimeDays: 3,
          safetyStock: new Prisma.Decimal(0),
          minOrderQuantity: new Prisma.Decimal(1),
          orderMultiple: new Prisma.Decimal(1),
          preferredSupplierId: null,
          preferredBomId: 'bom-finished-1',
        });
      }),
    };

    bomExplosionService = {
      explode: jest.fn().mockImplementation((orgId, itemId, demandQty) => {
        if (itemId === finishedItemId) {
          // Finished Good requires 2 units of Raw Material
          return Promise.resolve([
            {
              level: 1,
              parentItemId: finishedItemId,
              itemId: rawItemId,
              requiredQuantity: demandQty.times(2),
              scrapPercentage: new Prisma.Decimal(0),
              bomNumber: 'BOM-001',
              isLeaf: true,
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MrpEngineService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
        { provide: NumberingService, useValue: { nextNumber: jest.fn() } },
        { provide: PlanningConfigService, useValue: configService },
        { provide: BomExplosionService, useValue: bomExplosionService },
      ],
    }).compile();

    service = module.get<MrpEngineService>(MrpEngineService);
  });

  it('should calculate gross demands, match supply, and generate net requirements with lot sizing & MOQ', async () => {
    // 1. Sales order demand for 10 Finished Goods
    prisma.salesOrder.findMany.mockResolvedValue([
      {
        id: 'so-1',
        orderNumber: 'SO-000001',
        locationId: 'loc-1',
        expectedDeliveryDate: new Date('2026-09-20'),
        lines: [
          {
            itemId: finishedItemId,
            quantity: new Prisma.Decimal(10),
            quantityDelivered: new Prisma.Decimal(0),
          },
        ],
      },
    ]);

    prisma.productionOrder.findMany.mockResolvedValue([]);

    // 2. Supply:
    // Finished goods: 0 on hand
    // Raw item: 5 on hand, 0 open PO
    prisma.inventoryBalance.findMany.mockResolvedValue([
      {
        id: 'bal-raw',
        itemId: rawItemId,
        locationId: 'loc-1',
        quantityOnHand: new Prisma.Decimal(5),
        quantityReserved: new Prisma.Decimal(0), // Available = 5
      },
    ]);

    prisma.purchaseOrder.findMany.mockResolvedValue([]);

    // Active BOM for finished item
    prisma.billOfMaterial.findFirst.mockImplementation(({ where }: any) => {
      if (where.itemId === finishedItemId) {
        return Promise.resolve({ id: 'bom-finished-1' });
      }
      return Promise.resolve(null);
    });

    const result = await service.executeCalculation(
      {
        planningRunId: 'run-1',
        organizationId: mockOrgId,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-30'),
        includeSalesOrders: true,
        includeProductionOrders: true,
        includeSafetyStock: true,
        userId: mockUserId,
      },
      prisma,
    );

    expect(result).toBeDefined();
    // Demand for Finished Item = 10
    // Exploded demand for Raw Item = 10 * 2 = 20
    // Total demand snapshots = 1 (SO) + 1 (Exploded) = 2
    expect(result.demandSnapshots).toHaveLength(2);

    // Check Finished Item Planned Order:
    // Gross: 10, Avail: 0, Net: 10 -> PRODUCTION
    const finishedPlan = result.plannedOrders.find(
      (p) => p.itemId === finishedItemId,
    );
    expect(finishedPlan).toBeDefined();
    expect(finishedPlan?.action).toBe(PlannedOrderAction.PRODUCTION);
    expect(Number(finishedPlan?.quantity)).toBe(10);

    // Check Raw Item Planned Order:
    // Gross: 20, SafetyStock: 20, Avail: 5
    // Net: 20 + 20 - 5 = 35
    // MOQ: 50, OrderMultiple: 10 -> rounded up from 35 to MOQ=50 (which is multiple of 10)
    const rawPlan = result.plannedOrders.find((p) => p.itemId === rawItemId);
    expect(rawPlan).toBeDefined();
    expect(rawPlan?.action).toBe(PlannedOrderAction.PURCHASE);
    expect(Number(rawPlan?.quantity)).toBe(50);
    expect(rawPlan?.supplierId).toBe('sup-1');
  });
});
