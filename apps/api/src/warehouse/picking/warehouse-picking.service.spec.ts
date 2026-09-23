import { Test, TestingModule } from '@nestjs/testing';
import { WarehousePickingService } from './warehouse-picking.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BalancesService } from '../../inventory/balances/balances.service';
import { PickTaskStatus, Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('WarehousePickingService', () => {
  let service: WarehousePickingService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;
  let balancesService: any;

  const mockOrgId = 'org-111';

  beforeEach(async () => {
    prisma = {
      location: { findFirst: jest.fn() },
      pickTask: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      pickTaskLine: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      warehouseConfiguration: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ defaultStagingLocationId: 'loc-stage' }),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'PK-000001' }),
    };
    balancesService = { applyStockMovement: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehousePickingService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: BalancesService, useValue: balancesService },
      ],
    }).compile();

    service = module.get<WarehousePickingService>(WarehousePickingService);
  });

  it('should execute pick and move items to staging location', async () => {
    prisma.pickTask.findFirst.mockResolvedValue({
      id: 'pk-1',
      organizationId: mockOrgId,
      taskNumber: 'PK-000001',
      stagingLocationId: 'loc-stage',
      status: PickTaskStatus.IN_PROGRESS,
      warehouse: { id: 'wh-1', code: 'WH1', name: 'Main' },
      salesOrder: null,
      deliveryOrder: null,
      stagingLocation: { id: 'loc-stage', code: 'STAGING', name: 'Staging' },
      lines: [
        {
          id: 'line-1',
          itemId: 'item-1',
          variantId: null,
          batchId: null,
          serialId: null,
          sourceLocationId: 'loc-pick-face',
          requestedQuantity: new Prisma.Decimal('10.0000'),
          pickedQuantity: new Prisma.Decimal('0'),
          item: { id: 'item-1', sku: 'SKU1', name: 'Widget 1' },
          variant: null,
          sourceLocation: {
            id: 'loc-pick-face',
            code: 'A-01',
            name: 'Bin A01',
          },
          batch: null,
          serial: null,
        },
      ],
    });

    prisma.pickTaskLine.findMany.mockResolvedValue([
      {
        id: 'line-1',
        requestedQuantity: new Prisma.Decimal('10.0000'),
        pickedQuantity: new Prisma.Decimal('10.0000'),
      },
    ]);

    await service.executePick(
      mockOrgId,
      'pk-1',
      {
        lines: [{ lineId: 'line-1', pickedQuantity: 10 }],
      },
      'user-1',
    );

    expect(balancesService.applyStockMovement).toHaveBeenCalledTimes(2);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'WAREHOUSE_PICK_EXECUTED',
      }),
    );
  });

  it('should throw BadRequestException if picked quantity exceeds remaining requested', async () => {
    prisma.pickTask.findFirst.mockResolvedValue({
      id: 'pk-1',
      organizationId: mockOrgId,
      taskNumber: 'PK-000001',
      status: PickTaskStatus.IN_PROGRESS,
      lines: [
        {
          id: 'line-1',
          itemId: 'item-1',
          variantId: null,
          sourceLocationId: 'loc-pick-face',
          requestedQuantity: new Prisma.Decimal('10.0000'),
          pickedQuantity: new Prisma.Decimal('8.0000'),
          item: { sku: 'SKU1' },
        },
      ],
    });

    await expect(
      service.executePick(mockOrgId, 'pk-1', {
        lines: [{ lineId: 'line-1', pickedQuantity: 5 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
