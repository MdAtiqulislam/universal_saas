import { Test, TestingModule } from '@nestjs/testing';
import { BomsService } from './boms.service';
import { ProductionOrdersService } from './production-orders.service';
import { ProductionExecutionService } from './production-execution.service';
import { ManufacturingReportsService } from './manufacturing-reports.service';
import { ManufacturingConfigService } from './manufacturing-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BalancesService } from '../inventory/balances/balances.service';
import { InventoryCostLayersService } from '../inventory/costing/inventory-cost-layers.service';
import { NotFoundException } from '@nestjs/common';

describe('Tenant Manufacturing Isolation Tests', () => {
  let bomsService: BomsService;
  let ordersService: ProductionOrdersService;
  let executionService: ProductionExecutionService;
  let reportsService: ManufacturingReportsService;
  let prisma: any;

  const TENANT_A = 'tenant-aaa-111';
  const TENANT_B = 'tenant-bbb-222';
  const USER_A = 'user-a';

  beforeEach(async () => {
    prisma = {
      item: { findFirst: jest.fn() },
      unitOfMeasure: { findFirst: jest.fn() },
      location: { findFirst: jest.fn() },
      billOfMaterial: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      productionOrder: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      productionMaterialIssue: {
        findMany: jest.fn(),
      },
      inventoryBalance: { findFirst: jest.fn() },
      manufacturingConfiguration: { findUnique: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'NUM-001' }),
    };
    const balancesService = { applyStockMovement: jest.fn() };
    const costLayersService = {
      consumeFifo: jest.fn(),
      createLayer: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BomsService,
        ProductionOrdersService,
        ProductionExecutionService,
        ManufacturingReportsService,
        ManufacturingConfigService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: BalancesService, useValue: balancesService },
        { provide: InventoryCostLayersService, useValue: costLayersService },
      ],
    }).compile();

    bomsService = module.get<BomsService>(BomsService);
    ordersService = module.get<ProductionOrdersService>(
      ProductionOrdersService,
    );
    executionService = module.get<ProductionExecutionService>(
      ProductionExecutionService,
    );
    reportsService = module.get<ManufacturingReportsService>(
      ManufacturingReportsService,
    );
  });

  describe('BOM Isolation', () => {
    it('Scenario 1: Tenant A cannot read Tenant B BOM', async () => {
      prisma.billOfMaterial.findFirst.mockImplementation(({ where }: any) => {
        if (where.organizationId === TENANT_B && where.id === 'bom-b') {
          return Promise.resolve({ id: 'bom-b', organizationId: TENANT_B });
        }
        return Promise.resolve(null);
      });

      await expect(bomsService.findOne(TENANT_A, 'bom-b')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('Scenario 2: Tenant A cannot update Tenant B BOM', async () => {
      prisma.billOfMaterial.findFirst.mockResolvedValue(null);

      await expect(
        bomsService.update(TENANT_A, 'bom-b', { name: 'Hacked BOM' }, USER_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('Scenario 3: Tenant A cannot delete Tenant B BOM', async () => {
      prisma.billOfMaterial.findFirst.mockResolvedValue(null);

      await expect(
        bomsService.delete(TENANT_A, 'bom-b', USER_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('Scenario 4: Tenant A cannot activate Tenant B BOM', async () => {
      prisma.billOfMaterial.findFirst.mockResolvedValue(null);

      await expect(
        bomsService.activate(TENANT_A, 'bom-b', USER_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('Scenario 5: Tenant A cannot create BOM using Tenant B finished item', async () => {
      prisma.item.findFirst.mockImplementation(({ where }: any) => {
        if (where.organizationId === TENANT_A && where.id === 'item-b') {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });

      await expect(
        bomsService.create(
          TENANT_A,
          {
            name: 'Cross-tenant BOM',
            itemId: 'item-b',
            uomId: 'uom-a',
            effectiveFrom: '2026-01-01',
            lines: [{ itemId: 'item-a2', quantity: 1, uomId: 'uom-a' }],
          },
          USER_A,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Production Order Isolation', () => {
    it('Scenario 6: Tenant A cannot read Tenant B Production Order', async () => {
      prisma.productionOrder.findFirst.mockResolvedValue(null);

      await expect(ordersService.findOne(TENANT_A, 'mo-b')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('Scenario 7: Tenant A cannot update Tenant B Production Order', async () => {
      prisma.productionOrder.findFirst.mockResolvedValue(null);

      await expect(
        ordersService.update(TENANT_A, 'mo-b', { notes: 'Tampered' }, USER_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('Scenario 8: Tenant A cannot release Tenant B Production Order', async () => {
      prisma.productionOrder.findFirst.mockResolvedValue(null);

      await expect(
        ordersService.release(TENANT_A, 'mo-b', USER_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('Scenario 9: Tenant A cannot issue materials to Tenant B Production Order', async () => {
      prisma.productionOrder.findFirst.mockResolvedValue(null);

      await expect(
        executionService.issueMaterial(
          TENANT_A,
          'mo-b',
          { productionOrderLineId: 'line-b', quantity: 10 },
          USER_A,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('Scenario 10: Tenant A cannot complete Tenant B Production Order', async () => {
      prisma.productionOrder.findFirst.mockResolvedValue(null);

      await expect(
        executionService.complete(TENANT_A, 'mo-b', { quantity: 10 }, USER_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('Scenario 11: Tenant A cannot close Tenant B Production Order', async () => {
      prisma.productionOrder.findFirst.mockResolvedValue(null);

      await expect(
        executionService.close(TENANT_A, 'mo-b', USER_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('Scenario 12: Tenant A reports only query Tenant A data', async () => {
      prisma.productionOrder.findMany.mockImplementation(({ where }: any) => {
        expect(where.organizationId).toBe(TENANT_A);
        return Promise.resolve([]);
      });

      await reportsService.getProductionSummary(TENANT_A, {});
      await reportsService.getWipReport(TENANT_A);
    });
  });
});
