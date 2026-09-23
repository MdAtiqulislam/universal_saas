import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseCountsService } from './warehouse-counts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BalancesService } from '../../inventory/balances/balances.service';
import { CycleCountStatus, Prisma } from '@prisma/client';

describe('WarehouseCountsService', () => {
  let service: WarehouseCountsService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;
  let balancesService: any;

  const mockOrgId = 'org-111';

  beforeEach(async () => {
    prisma = {
      location: { findFirst: jest.fn() },
      cycleCount: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      cycleCountLine: {
        update: jest.fn(),
      },
      inventoryBalance: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'CC-000001' }),
    };
    balancesService = { applyStockMovement: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseCountsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: BalancesService, useValue: balancesService },
      ],
    }).compile();

    service = module.get<WarehouseCountsService>(WarehouseCountsService);
  });

  it('should post positive variance as ADJUSTMENT_IN and negative as ADJUSTMENT_OUT', async () => {
    prisma.cycleCount.findFirst.mockResolvedValue({
      id: 'cc-1',
      organizationId: mockOrgId,
      countNumber: 'CC-000001',
      status: CycleCountStatus.REVIEWED,
      warehouse: { id: 'wh-1', code: 'WH1', name: 'Main' },
      zone: null,
      lines: [
        {
          id: 'line-gain',
          locationId: 'loc-1',
          itemId: 'item-gain',
          variantId: null,
          batchId: null,
          serialId: null,
          systemQuantity: new Prisma.Decimal('10.0000'),
          countedQuantity: new Prisma.Decimal('12.0000'),
          varianceQuantity: new Prisma.Decimal('2.0000'), // +2
          location: { id: 'loc-1', code: 'LOC1', name: 'Loc 1' },
          item: { id: 'item-gain', sku: 'SKU-G', name: 'Item Gain' },
          variant: null,
          batch: null,
          serial: null,
        },
        {
          id: 'line-loss',
          locationId: 'loc-1',
          itemId: 'item-loss',
          variantId: null,
          batchId: null,
          serialId: null,
          systemQuantity: new Prisma.Decimal('20.0000'),
          countedQuantity: new Prisma.Decimal('15.0000'),
          varianceQuantity: new Prisma.Decimal('-5.0000'), // -5
          location: { id: 'loc-1', code: 'LOC1', name: 'Loc 1' },
          item: { id: 'item-loss', sku: 'SKU-L', name: 'Item Loss' },
          variant: null,
          batch: null,
          serial: null,
        },
      ],
    });

    await service.post(mockOrgId, 'cc-1', 'user-1');

    expect(balancesService.applyStockMovement).toHaveBeenCalledTimes(2);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'WAREHOUSE_COUNT_POSTED',
      }),
    );
  });
});
