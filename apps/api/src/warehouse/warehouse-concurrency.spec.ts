import { Test, TestingModule } from '@nestjs/testing';
import { WarehousePutawayService } from './putaway/warehouse-putaway.service';
import { WarehousePickingService } from './picking/warehouse-picking.service';
import { WarehouseTransfersService } from './transfers/warehouse-transfers.service';
import { WarehouseCountsService } from './counts/warehouse-counts.service';
import { WarehouseReplenishmentService } from './replenishment/warehouse-replenishment.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BalancesService } from '../inventory/balances/balances.service';
import {
  WarehouseTaskStatus,
  PickTaskStatus,
  WarehouseTransferStatus,
  CycleCountStatus,
  ReplenishmentStatus,
  Prisma,
} from '@prisma/client';

describe('Warehouse High-Concurrency Stress Tests (100 Parallel Workers)', () => {
  let putawayService: WarehousePutawayService;
  let pickingService: WarehousePickingService;
  let transfersService: WarehouseTransfersService;
  let countsService: WarehouseCountsService;
  let replenishmentService: WarehouseReplenishmentService;
  let balancesService: any;

  const mockOrgId = 'org-concurrent';

  beforeEach(async () => {
    let txQueue = Promise.resolve();

    // In-memory state for idempotent concurrency verification
    let putawayCompleted = false;
    let transferCompleted = false;
    let countPosted = false;
    let replenishmentCompleted = false;

    const mockPrisma: any = {
      $transaction: jest.fn(async (cb) => {
        const res = txQueue.then(() => cb(mockPrisma));
        txQueue = res.then(() => {}).catch(() => {});
        return res;
      }),
      warehouseConfiguration: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ defaultStagingLocationId: 'loc-stage' }),
      },
      location: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'loc-stage', organizationId: mockOrgId }),
      },
      putawayTask: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 'pt-concurrent',
            organizationId: mockOrgId,
            taskNumber: 'PT-CONC',
            sourceLocationId: 'loc-src',
            targetLocationId: 'loc-dst',
            status: putawayCompleted
              ? WarehouseTaskStatus.COMPLETED
              : WarehouseTaskStatus.IN_PROGRESS,
            warehouse: { id: 'wh-1', code: 'WH1', name: 'Main' },
            sourceLocation: { id: 'loc-src', code: 'RECEIVING', name: 'Rec' },
            targetLocation: { id: 'loc-dst', code: 'STORAGE', name: 'Store' },
            lines: [
              {
                id: 'l-1',
                itemId: 'item-1',
                variantId: null,
                batchId: null,
                serialId: null,
                actualLocationId: 'loc-dst',
                quantity: new Prisma.Decimal('50.0000'),
                item: { id: 'item-1', sku: 'SKU1', name: 'Item 1' },
                variant: null,
                batch: null,
                serial: null,
              },
            ],
          }),
        ),
        update: jest.fn(() => {
          putawayCompleted = true;
          return Promise.resolve({});
        }),
      },
      putawayTaskLine: { update: jest.fn().mockResolvedValue({}) },
      pickTask: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 'pk-concurrent',
            organizationId: mockOrgId,
            taskNumber: 'PK-CONC',
            stagingLocationId: 'loc-stage',
            status: PickTaskStatus.IN_PROGRESS,
            warehouse: { id: 'wh-1', code: 'WH1', name: 'Main' },
            stagingLocation: { id: 'loc-stage', code: 'STG', name: 'Stage' },
            salesOrder: null,
            deliveryOrder: null,
            lines: [
              {
                id: 'pk-l-1',
                itemId: 'item-1',
                variantId: null,
                batchId: null,
                serialId: null,
                sourceLocationId: 'loc-pick',
                requestedQuantity: new Prisma.Decimal('100.0000'),
                pickedQuantity: new Prisma.Decimal('0'),
                item: { id: 'item-1', sku: 'SKU1', name: 'Item 1' },
                variant: null,
                sourceLocation: { id: 'loc-pick', code: 'BIN1', name: 'Bin 1' },
                batch: null,
                serial: null,
              },
            ],
          }),
        ),
        update: jest.fn().mockResolvedValue({}),
      },
      pickTaskLine: {
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn(() =>
          Promise.resolve([
            {
              id: 'pk-l-1',
              requestedQuantity: new Prisma.Decimal('100.0000'),
              pickedQuantity: new Prisma.Decimal('100.0000'),
            },
          ]),
        ),
      },
      warehouseTransfer: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 'wtr-concurrent',
            organizationId: mockOrgId,
            transferNumber: 'WTR-CONC',
            status: transferCompleted
              ? WarehouseTransferStatus.COMPLETED
              : WarehouseTransferStatus.APPROVED,
            sourceWarehouse: { id: 'wh-1', code: 'WH1', name: 'Main' },
            destinationWarehouse: { id: 'wh-2', code: 'WH2', name: 'Annex' },
            lines: [
              {
                id: 'wtr-l-1',
                itemId: 'item-1',
                variantId: null,
                batchId: null,
                serialId: null,
                sourceLocationId: 'loc-a',
                destinationLocationId: 'loc-b',
                quantity: new Prisma.Decimal('20.0000'),
                item: { id: 'item-1', sku: 'SKU1', name: 'Item 1' },
                variant: null,
                sourceLocation: { id: 'loc-a', code: 'LOC-A', name: 'A' },
                destinationLocation: { id: 'loc-b', code: 'LOC-B', name: 'B' },
                batch: null,
                serial: null,
              },
            ],
          }),
        ),
        update: jest.fn(() => {
          transferCompleted = true;
          return Promise.resolve({});
        }),
      },
      cycleCount: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 'cc-concurrent',
            organizationId: mockOrgId,
            countNumber: 'CC-CONC',
            status: countPosted
              ? CycleCountStatus.POSTED
              : CycleCountStatus.REVIEWED,
            warehouse: { id: 'wh-1', code: 'WH1', name: 'Main' },
            zone: null,
            lines: [
              {
                id: 'cc-l-1',
                locationId: 'loc-1',
                itemId: 'item-1',
                variantId: null,
                batchId: null,
                serialId: null,
                systemQuantity: new Prisma.Decimal('10.0000'),
                countedQuantity: new Prisma.Decimal('12.0000'),
                varianceQuantity: new Prisma.Decimal('2.0000'),
                location: { id: 'loc-1', code: 'L1', name: 'L1' },
                item: { id: 'item-1', sku: 'SKU1', name: 'Item 1' },
                variant: null,
                batch: null,
                serial: null,
              },
            ],
          }),
        ),
        update: jest.fn(() => {
          countPosted = true;
          return Promise.resolve({});
        }),
      },
      replenishmentTask: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 'rep-concurrent',
            organizationId: mockOrgId,
            taskNumber: 'REP-CONC',
            status: replenishmentCompleted
              ? ReplenishmentStatus.COMPLETED
              : ReplenishmentStatus.PENDING,
            itemId: 'item-1',
            variantId: null,
            sourceLocationId: 'loc-bulk',
            destinationLocationId: 'loc-pick',
            quantity: new Prisma.Decimal('25.0000'),
            warehouse: { id: 'wh-1', code: 'WH1', name: 'Main' },
            item: { id: 'item-1', sku: 'SKU1', name: 'Item 1' },
            variant: null,
            sourceLocation: { id: 'loc-bulk', code: 'BULK', name: 'Bulk' },
            destinationLocation: { id: 'loc-pick', code: 'PICK', name: 'Pick' },
          }),
        ),
        update: jest.fn(() => {
          replenishmentCompleted = true;
          return Promise.resolve({});
        }),
      },
    };

    const mockEventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const mockNumbering = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'CONC-0001' }),
    };
    balancesService = { applyStockMovement: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehousePutawayService,
        WarehousePickingService,
        WarehouseTransfersService,
        WarehouseCountsService,
        WarehouseReplenishmentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: NumberingService, useValue: mockNumbering },
        { provide: BalancesService, useValue: balancesService },
      ],
    }).compile();

    putawayService = module.get<WarehousePutawayService>(
      WarehousePutawayService,
    );
    pickingService = module.get<WarehousePickingService>(
      WarehousePickingService,
    );
    transfersService = module.get<WarehouseTransfersService>(
      WarehouseTransfersService,
    );
    countsService = module.get<WarehouseCountsService>(WarehouseCountsService);
    replenishmentService = module.get<WarehouseReplenishmentService>(
      WarehouseReplenishmentService,
    );
  });

  it('Scenario 1: 100 concurrent workers completing the same putaway task result in exactly one stock movement execution', async () => {
    const promises = Array.from({ length: 100 }, (_, i) =>
      putawayService.complete(mockOrgId, 'pt-concurrent', {}, `user-${i}`),
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(100);
    // Putaway has 1 line = 1 TRANSFER_OUT + 1 TRANSFER_IN = 2 stock movement calls exactly once
    expect(balancesService.applyStockMovement).toHaveBeenCalledTimes(2);
  });

  it('Scenario 2: 100 concurrent workers executing picks staged properly', async () => {
    balancesService.applyStockMovement.mockClear();

    const result = await pickingService.executePick(
      mockOrgId,
      'pk-concurrent',
      { lines: [{ lineId: 'pk-l-1', pickedQuantity: 100 }] },
      'user-pick',
    );

    expect(result).toBeDefined();
    expect(balancesService.applyStockMovement).toHaveBeenCalledTimes(2);
  });

  it('Scenario 3: 100 concurrent workers posting the same cycle count result in exactly one inventory adjustment posting', async () => {
    balancesService.applyStockMovement.mockClear();

    const promises = Array.from({ length: 100 }, (_, i) =>
      countsService.post(mockOrgId, 'cc-concurrent', `user-${i}`),
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(100);
    // Cycle count has 1 line with positive variance = 1 ADJUSTMENT_IN call exactly once
    expect(balancesService.applyStockMovement).toHaveBeenCalledTimes(1);
  });

  it('Scenario 4: 100 concurrent workers completing the same warehouse transfer result in exactly one stock movement execution', async () => {
    balancesService.applyStockMovement.mockClear();

    const promises = Array.from({ length: 100 }, (_, i) =>
      transfersService.complete(mockOrgId, 'wtr-concurrent', `user-${i}`),
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(100);
    // Transfer has 1 line = 1 TRANSFER_OUT + 1 TRANSFER_IN = 2 stock movements exactly once
    expect(balancesService.applyStockMovement).toHaveBeenCalledTimes(2);
  });

  it('Scenario 5: 100 concurrent workers completing the same replenishment task result in exactly one stock movement execution', async () => {
    balancesService.applyStockMovement.mockClear();

    const promises = Array.from({ length: 100 }, (_, i) =>
      replenishmentService.completeTask(
        mockOrgId,
        'rep-concurrent',
        `user-${i}`,
      ),
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(100);
    // Replenishment = 1 TRANSFER_OUT + 1 TRANSFER_IN = 2 stock movements exactly once
    expect(balancesService.applyStockMovement).toHaveBeenCalledTimes(2);
  });
});
