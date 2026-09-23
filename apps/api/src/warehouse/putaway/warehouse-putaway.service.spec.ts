import { Test, TestingModule } from '@nestjs/testing';
import { WarehousePutawayService } from './warehouse-putaway.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BalancesService } from '../../inventory/balances/balances.service';
import { WarehouseTaskStatus, Prisma } from '@prisma/client';

describe('WarehousePutawayService', () => {
  let service: WarehousePutawayService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;
  let balancesService: any;

  const mockOrgId = 'org-111';

  beforeEach(async () => {
    prisma = {
      location: { findFirst: jest.fn() },
      putawayTask: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      putawayTaskLine: {
        update: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'PT-000001' }),
    };
    balancesService = { applyStockMovement: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehousePutawayService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: BalancesService, useValue: balancesService },
      ],
    }).compile();

    service = module.get<WarehousePutawayService>(WarehousePutawayService);
  });

  it('should complete putaway task and apply stock movements', async () => {
    prisma.putawayTask.findFirst.mockResolvedValue({
      id: 'pt-1',
      organizationId: mockOrgId,
      taskNumber: 'PT-000001',
      sourceLocationId: 'loc-rec',
      targetLocationId: 'loc-store',
      status: WarehouseTaskStatus.IN_PROGRESS,
      warehouse: { id: 'wh-1', code: 'WH1', name: 'Main' },
      sourceLocation: { id: 'loc-rec', code: 'RECEIVING', name: 'Receiving' },
      targetLocation: { id: 'loc-store', code: 'STORAGE', name: 'Storage' },
      lines: [
        {
          id: 'line-1',
          itemId: 'item-1',
          variantId: null,
          batchId: null,
          serialId: null,
          quantity: new Prisma.Decimal('25.0000'),
          actualLocationId: 'loc-store',
          item: { id: 'item-1', sku: 'SKU1', name: 'Widget 1' },
          variant: null,
          batch: null,
          serial: null,
        },
      ],
    });

    const result = await service.complete(mockOrgId, 'pt-1', {}, 'user-1');

    expect(result).toBeDefined();
    expect(balancesService.applyStockMovement).toHaveBeenCalledTimes(2);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'WAREHOUSE_PUTAWAY_COMPLETED',
      }),
    );
  });
});
