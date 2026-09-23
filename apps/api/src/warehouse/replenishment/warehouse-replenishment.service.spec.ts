import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseReplenishmentService } from './warehouse-replenishment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BalancesService } from '../../inventory/balances/balances.service';
import { ReplenishmentStatus, Prisma } from '@prisma/client';

describe('WarehouseReplenishmentService', () => {
  let service: WarehouseReplenishmentService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;
  let balancesService: any;

  const mockOrgId = 'org-111';

  beforeEach(async () => {
    prisma = {
      replenishmentRule: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      replenishmentTask: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      inventoryBalance: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'REP-000001' }),
    };
    balancesService = { applyStockMovement: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseReplenishmentService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: BalancesService, useValue: balancesService },
      ],
    }).compile();

    service = module.get<WarehouseReplenishmentService>(
      WarehouseReplenishmentService,
    );
  });

  it('should generate replenishment task when destination on-hand is below minQuantity', async () => {
    prisma.replenishmentRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        organizationId: mockOrgId,
        warehouseId: 'wh-1',
        itemId: 'item-1',
        variantId: null,
        sourceLocationId: 'loc-bulk',
        destinationLocationId: 'loc-pick',
        minQuantity: new Prisma.Decimal('10.0000'),
        maxQuantity: new Prisma.Decimal('50.0000'),
        replenishQuantity: new Prisma.Decimal('40.0000'),
        isActive: true,
      },
    ]);

    // Current balance at pick face is 4 (< 10)
    prisma.inventoryBalance.findFirst.mockResolvedValue({
      quantityOnHand: new Prisma.Decimal('4.0000'),
    });

    prisma.replenishmentTask.findFirst.mockResolvedValue(null); // No existing open task
    prisma.replenishmentTask.create.mockResolvedValue({
      id: 'rep-task-1',
      taskNumber: 'REP-000001',
      quantity: new Prisma.Decimal('40.0000'),
      status: ReplenishmentStatus.PENDING,
      warehouse: { id: 'wh-1', code: 'WH1', name: 'Main' },
      item: { id: 'item-1', sku: 'SKU1', name: 'Item 1' },
      variant: null,
      sourceLocation: { id: 'loc-bulk', code: 'BULK', name: 'Bulk' },
      destinationLocation: { id: 'loc-pick', code: 'PICK', name: 'Pick Face' },
    });

    const tasks = await service.generateTasks(
      mockOrgId,
      { warehouseId: 'wh-1' },
      'user-1',
    );

    expect(tasks).toHaveLength(1);
    expect(tasks[0].taskNumber).toBe('REP-000001');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'WAREHOUSE_REPLENISHMENT_CREATED',
      }),
    );
  });
});
