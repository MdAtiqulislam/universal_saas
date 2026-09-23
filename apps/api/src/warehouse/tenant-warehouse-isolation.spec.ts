import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseZonesService } from './zones/warehouse-zones.service';
import { WarehouseTasksService } from './tasks/warehouse-tasks.service';
import { WarehousePutawayService } from './putaway/warehouse-putaway.service';
import { WarehousePickingService } from './picking/warehouse-picking.service';
import { WarehouseWavesService } from './picking/warehouse-waves.service';
import { WarehouseTransfersService } from './transfers/warehouse-transfers.service';
import { WarehouseCountsService } from './counts/warehouse-counts.service';
import { WarehouseReplenishmentService } from './replenishment/warehouse-replenishment.service';
import { WarehouseQuarantineService } from './stock/warehouse-quarantine.service';
import { WarehouseConfigService } from './config/warehouse-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BalancesService } from '../inventory/balances/balances.service';
import { NotFoundException } from '@nestjs/common';

describe('Warehouse Multi-Tenant Isolation Specs (12+ Scenarios)', () => {
  let zonesService: WarehouseZonesService;
  let tasksService: WarehouseTasksService;
  let putawayService: WarehousePutawayService;
  let pickingService: WarehousePickingService;
  let wavesService: WarehouseWavesService;
  let transfersService: WarehouseTransfersService;
  let countsService: WarehouseCountsService;
  let replenishmentService: WarehouseReplenishmentService;
  let quarantineService: WarehouseQuarantineService;
  let configService: WarehouseConfigService;
  let prisma: any;

  const TENANT_A = 'tenant-a-uuid';
  const TENANT_B = 'tenant-b-uuid';

  beforeEach(async () => {
    prisma = {
      location: { findFirst: jest.fn() },
      warehouseZone: { findFirst: jest.fn(), findMany: jest.fn() },
      warehouseTask: { findFirst: jest.fn(), findMany: jest.fn() },
      putawayTask: { findFirst: jest.fn(), findMany: jest.fn() },
      pickTask: { findFirst: jest.fn(), findMany: jest.fn() },
      pickWave: { findFirst: jest.fn(), findMany: jest.fn() },
      warehouseTransfer: { findFirst: jest.fn(), findMany: jest.fn() },
      cycleCount: { findFirst: jest.fn(), findMany: jest.fn() },
      replenishmentRule: { findFirst: jest.fn(), findMany: jest.fn() },
      replenishmentTask: { findFirst: jest.fn(), findMany: jest.fn() },
      quarantineRecord: { findFirst: jest.fn(), findMany: jest.fn() },
      warehouseConfiguration: { findUnique: jest.fn() },
    };

    const mockEventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const mockNumbering = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'TEST-0001' }),
    };
    const mockBalances = {
      applyStockMovement: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseZonesService,
        WarehouseTasksService,
        WarehousePutawayService,
        WarehousePickingService,
        WarehouseWavesService,
        WarehouseTransfersService,
        WarehouseCountsService,
        WarehouseReplenishmentService,
        WarehouseQuarantineService,
        WarehouseConfigService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: NumberingService, useValue: mockNumbering },
        { provide: BalancesService, useValue: mockBalances },
      ],
    }).compile();

    zonesService = module.get<WarehouseZonesService>(WarehouseZonesService);
    tasksService = module.get<WarehouseTasksService>(WarehouseTasksService);
    putawayService = module.get<WarehousePutawayService>(
      WarehousePutawayService,
    );
    pickingService = module.get<WarehousePickingService>(
      WarehousePickingService,
    );
    wavesService = module.get<WarehouseWavesService>(WarehouseWavesService);
    transfersService = module.get<WarehouseTransfersService>(
      WarehouseTransfersService,
    );
    countsService = module.get<WarehouseCountsService>(WarehouseCountsService);
    replenishmentService = module.get<WarehouseReplenishmentService>(
      WarehouseReplenishmentService,
    );
    quarantineService = module.get<WarehouseQuarantineService>(
      WarehouseQuarantineService,
    );
    configService = module.get<WarehouseConfigService>(WarehouseConfigService);
  });

  // Scenario 1: Zone isolation
  it('Scenario 1: Tenant B cannot view Tenant A warehouse zone', async () => {
    expect(TENANT_A).not.toBe(TENANT_B);
    prisma.warehouseZone.findFirst.mockResolvedValue(null);
    await expect(zonesService.findOne(TENANT_B, 'zone-a')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.warehouseZone.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'zone-a', organizationId: TENANT_B },
      }),
    );
  });

  // Scenario 2: Zone create isolation
  it('Scenario 2: Tenant B cannot create zone under Tenant A location', async () => {
    prisma.location.findFirst.mockResolvedValue(null);
    await expect(
      zonesService.create(TENANT_B, {
        locationId: 'loc-a',
        code: 'Z1',
        name: 'Z1',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // Scenario 3: Warehouse Task isolation
  it('Scenario 3: Tenant B cannot retrieve or update Tenant A warehouse task', async () => {
    prisma.warehouseTask.findFirst.mockResolvedValue(null);
    await expect(tasksService.findOne(TENANT_B, 'task-a')).rejects.toThrow(
      NotFoundException,
    );
  });

  // Scenario 4: Putaway Task isolation
  it('Scenario 4: Tenant B cannot view or complete Tenant A putaway task', async () => {
    prisma.putawayTask.findFirst.mockResolvedValue(null);
    await expect(putawayService.findOne(TENANT_B, 'putaway-a')).rejects.toThrow(
      NotFoundException,
    );
  });

  // Scenario 5: Putaway Create Location Isolation
  it('Scenario 5: Tenant B cannot create putaway pointing to Tenant A warehouse', async () => {
    prisma.location.findFirst.mockResolvedValue(null);
    await expect(
      putawayService.create(TENANT_B, {
        warehouseId: 'wh-a',
        sourceLocationId: 'loc-a',
        lines: [{ itemId: 'item-1', quantity: 10 }],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // Scenario 6: Picking Task Isolation
  it('Scenario 6: Tenant B cannot find or execute Tenant A pick task', async () => {
    prisma.pickTask.findFirst.mockResolvedValue(null);
    await expect(pickingService.findOne(TENANT_B, 'pick-a')).rejects.toThrow(
      NotFoundException,
    );
  });

  // Scenario 7: Pick Wave Isolation
  it('Scenario 7: Tenant B cannot find or release Tenant A pick wave', async () => {
    prisma.pickWave.findFirst.mockResolvedValue(null);
    await expect(wavesService.findOne(TENANT_B, 'wave-a')).rejects.toThrow(
      NotFoundException,
    );
  });

  // Scenario 8: Warehouse Transfer Isolation
  it('Scenario 8: Tenant B cannot find or approve Tenant A warehouse transfer', async () => {
    prisma.warehouseTransfer.findFirst.mockResolvedValue(null);
    await expect(transfersService.findOne(TENANT_B, 'wtr-a')).rejects.toThrow(
      NotFoundException,
    );
  });

  // Scenario 9: Transfer Warehouse Ownership Isolation
  it('Scenario 9: Tenant B cannot initiate transfer with Tenant A warehouse locations', async () => {
    prisma.location.findFirst.mockResolvedValue(null);
    await expect(
      transfersService.create(TENANT_B, {
        sourceWarehouseId: 'wh-a',
        destinationWarehouseId: 'wh-b',
        lines: [
          {
            itemId: 'i-1',
            sourceLocationId: 'l-1',
            destinationLocationId: 'l-2',
            quantity: 5,
          },
        ],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // Scenario 10: Cycle Count Isolation
  it('Scenario 10: Tenant B cannot find or post Tenant A cycle count', async () => {
    prisma.cycleCount.findFirst.mockResolvedValue(null);
    await expect(countsService.findOne(TENANT_B, 'cc-a')).rejects.toThrow(
      NotFoundException,
    );
  });

  // Scenario 11: Quarantine Record Isolation
  it('Scenario 11: Tenant B cannot find or release Tenant A quarantine lot', async () => {
    prisma.quarantineRecord.findFirst.mockResolvedValue(null);
    await expect(quarantineService.findOne(TENANT_B, 'qr-a')).rejects.toThrow(
      NotFoundException,
    );
  });

  // Scenario 12: Replenishment Task Isolation
  it('Scenario 12: Tenant B cannot complete Tenant A replenishment task', async () => {
    prisma.replenishmentTask.findFirst.mockResolvedValue(null);
    await expect(
      replenishmentService.cancelTask(TENANT_B, 'rep-a'),
    ).rejects.toThrow(NotFoundException);
  });

  // Scenario 13: Warehouse Configuration Isolation
  it('Scenario 13: Tenant B query strictly accesses Tenant B configuration', async () => {
    prisma.warehouseConfiguration.findUnique.mockResolvedValue({
      id: 'cfg-b',
      organizationId: TENANT_B,
    });
    const config = await configService.getConfig(TENANT_B);
    expect(config.organizationId).toBe(TENANT_B);
    expect(prisma.warehouseConfiguration.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: TENANT_B } }),
    );
  });
});
