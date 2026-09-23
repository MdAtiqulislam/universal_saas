import { Test, TestingModule } from '@nestjs/testing';
import { ProductionOrdersService } from './production-orders.service';
import { ProductionExecutionService } from './production-execution.service';
import { ManufacturingConfigService } from './manufacturing-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BalancesService } from '../inventory/balances/balances.service';
import { InventoryCostLayersService } from '../inventory/costing/inventory-cost-layers.service';
import { ProductionOrderStatus, SerialStatus, Prisma } from '@prisma/client';

describe('Manufacturing Concurrency & Idempotency Tests (100 parallel workers)', () => {
  let ordersService: ProductionOrdersService;
  let executionService: ProductionExecutionService;
  let prisma: any;

  const mockOrgId = 'org-concurrent-m25';
  const mockUserId = 'user-concurrent';

  beforeEach(async () => {
    prisma = {
      productionOrder: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      productionOrderLine: {
        update: jest.fn(),
      },
      productionMaterialIssue: {
        create: jest.fn(),
      },
      productionOutput: {
        create: jest.fn(),
      },
      inventorySerial: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      inventoryBalance: {
        findFirst: jest.fn(),
      },
      manufacturingConfiguration: {
        findUnique: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
      },
      journalEntry: {
        create: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'MO-000001' }),
    };
    const balancesService = {
      applyStockMovement: jest
        .fn()
        .mockResolvedValue({ movement: { id: 'sm-1' } }),
    };
    const costLayersService = {
      consumeFifo: jest
        .fn()
        .mockResolvedValue({ totalCost: new Prisma.Decimal(100) }),
      createLayer: jest.fn().mockResolvedValue({ id: 'layer-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionOrdersService,
        ProductionExecutionService,
        ManufacturingConfigService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: BalancesService, useValue: balancesService },
        { provide: InventoryCostLayersService, useValue: costLayersService },
      ],
    }).compile();

    ordersService = module.get<ProductionOrdersService>(
      ProductionOrdersService,
    );
    executionService = module.get<ProductionExecutionService>(
      ProductionExecutionService,
    );
  });

  it('Scenario 1: 100 parallel release attempts on same order -> exactly 1 success, 99 rejected', async () => {
    let orderStatus: ProductionOrderStatus = ProductionOrderStatus.DRAFT;

    prisma.$transaction.mockImplementation((cb: (tx: any) => Promise<any>) => {
      if (orderStatus !== ProductionOrderStatus.DRAFT) {
        throw new Error(
          `Cannot release production order in status ${String(orderStatus)}. Must be DRAFT.`,
        );
      }
      orderStatus = ProductionOrderStatus.RELEASED;
      return cb({
        ...prisma,
        productionOrder: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'mo-1',
            status: ProductionOrderStatus.DRAFT,
            orderNumber: 'MO-000001',
            lines: [],
          }),
          update: jest.fn().mockResolvedValue({
            id: 'mo-1',
            status: ProductionOrderStatus.RELEASED,
            orderNumber: 'MO-000001',
          }),
        },
        manufacturingConfiguration: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ allowReleaseOnShortage: true }),
        },
      });
    });

    const promises = Array.from({ length: 100 }, () =>
      ordersService.release(mockOrgId, 'mo-1', mockUserId),
    );

    const results = await Promise.allSettled(promises);
    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(99);
  });

  it('Scenario 2: 100 parallel completion attempts on single-run order -> exactly 1 success, 99 rejected', async () => {
    let orderStatus: ProductionOrderStatus = ProductionOrderStatus.IN_PROGRESS;

    prisma.$transaction.mockImplementation((cb: (tx: any) => Promise<any>) => {
      if (orderStatus !== ProductionOrderStatus.IN_PROGRESS) {
        throw new Error(
          `Cannot complete production order in status ${String(orderStatus)}. Must be IN_PROGRESS.`,
        );
      }
      orderStatus = ProductionOrderStatus.COMPLETED;
      return cb({
        ...prisma,
        productionOrder: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'mo-1',
            orderNumber: 'MO-000001',
            itemId: 'item-1',
            locationId: 'loc-1',
            status: ProductionOrderStatus.IN_PROGRESS,
            plannedQuantity: new Prisma.Decimal(10),
            producedQuantity: new Prisma.Decimal(0),
            scrapQuantity: new Prisma.Decimal(0),
            materialCost: new Prisma.Decimal(500),
            laborCost: new Prisma.Decimal(0),
            overheadCost: new Prisma.Decimal(0),
            totalCost: new Prisma.Decimal(500),
            lines: [],
            outputs: [],
          }),
          update: jest.fn().mockResolvedValue({
            id: 'mo-1',
            status: ProductionOrderStatus.COMPLETED,
            producedQuantity: new Prisma.Decimal(10),
          }),
        },
        productionOutput: {
          create: jest.fn().mockResolvedValue({ id: 'out-1' }),
        },
        manufacturingConfiguration: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      });
    });

    const promises = Array.from({ length: 100 }, () =>
      executionService.complete(
        mockOrgId,
        'mo-1',
        { quantity: 10 },
        mockUserId,
      ),
    );

    const results = await Promise.allSettled(promises);
    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(99);
  });

  it('Scenario 3: 100 parallel attempts to consume the same serial number -> exactly 1 success, 99 rejected', async () => {
    let serialStatus: SerialStatus = SerialStatus.AVAILABLE;

    prisma.$transaction.mockImplementation((cb: (tx: any) => Promise<any>) => {
      if (serialStatus !== SerialStatus.AVAILABLE) {
        throw new Error('Serial number is not available in inventory.');
      }
      serialStatus = SerialStatus.TRANSFERRED;
      return cb({
        ...prisma,
        productionOrder: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'mo-1',
            orderNumber: 'MO-000001',
            status: ProductionOrderStatus.IN_PROGRESS,
            materialCost: new Prisma.Decimal(0),
            laborCost: new Prisma.Decimal(0),
            overheadCost: new Prisma.Decimal(0),
            lines: [
              {
                id: 'line-1',
                itemId: 'item-raw-1',
                issuedQuantity: new Prisma.Decimal(0),
                consumedQuantity: new Prisma.Decimal(0),
                requiredQuantity: new Prisma.Decimal(1),
                unitCost: new Prisma.Decimal(100),
                totalCost: new Prisma.Decimal(0),
              },
            ],
          }),
          update: jest.fn().mockResolvedValue({ id: 'mo-1' }),
        },
        productionOrderLine: {
          update: jest.fn().mockResolvedValue({ id: 'line-1' }),
        },
        productionMaterialIssue: {
          create: jest.fn().mockResolvedValue({ id: 'pmi-1' }),
        },
        inventorySerial: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'serial-1',
            status: SerialStatus.AVAILABLE,
          }),
          update: jest.fn().mockResolvedValue({
            id: 'serial-1',
            status: SerialStatus.TRANSFERRED,
          }),
        },
        manufacturingConfiguration: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      });
    });

    const promises = Array.from({ length: 100 }, () =>
      executionService.issueMaterial(
        mockOrgId,
        'mo-1',
        {
          productionOrderLineId: 'line-1',
          quantity: 1,
          serialNumbers: ['SN-UNIQUE-999'],
        },
        mockUserId,
      ),
    );

    const results = await Promise.allSettled(promises);
    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(99);
  });
});
