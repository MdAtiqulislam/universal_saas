import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseTransfersService } from './warehouse-transfers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BalancesService } from '../../inventory/balances/balances.service';
import { WarehouseTransferStatus, Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('WarehouseTransfersService', () => {
  let service: WarehouseTransfersService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;
  let balancesService: any;

  const mockOrgId = 'org-111';

  beforeEach(async () => {
    prisma = {
      location: { findFirst: jest.fn() },
      warehouseTransfer: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'WTR-000001' }),
    };
    balancesService = { applyStockMovement: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseTransfersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: BalancesService, useValue: balancesService },
      ],
    }).compile();

    service = module.get<WarehouseTransfersService>(WarehouseTransfersService);
  });

  it('should complete warehouse transfer and move inventory atomically', async () => {
    prisma.warehouseTransfer.findFirst.mockResolvedValue({
      id: 'wtr-1',
      organizationId: mockOrgId,
      transferNumber: 'WTR-000001',
      status: WarehouseTransferStatus.IN_PROGRESS,
      sourceWarehouse: { id: 'wh-1', code: 'WH1', name: 'Main' },
      destinationWarehouse: { id: 'wh-2', code: 'WH2', name: 'Annex' },
      lines: [
        {
          id: 'line-1',
          itemId: 'item-1',
          variantId: null,
          batchId: null,
          serialId: null,
          sourceLocationId: 'loc-src',
          destinationLocationId: 'loc-dst',
          quantity: new Prisma.Decimal('100.0000'),
          item: { id: 'item-1', sku: 'SKU1', name: 'Item 1' },
          variant: null,
          sourceLocation: { id: 'loc-src', code: 'LOC-A', name: 'Loc A' },
          destinationLocation: { id: 'loc-dst', code: 'LOC-B', name: 'Loc B' },
          batch: null,
          serial: null,
        },
      ],
    });

    await service.complete(mockOrgId, 'wtr-1', 'user-1');

    expect(balancesService.applyStockMovement).toHaveBeenCalledTimes(2);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'WAREHOUSE_TRANSFER_COMPLETED',
      }),
    );
  });

  it('should reject creating transfer if source and destination location are identical', async () => {
    prisma.location.findFirst.mockResolvedValue({
      id: 'wh-1',
      organizationId: mockOrgId,
    });

    await expect(
      service.create(mockOrgId, {
        sourceWarehouseId: 'wh-1',
        destinationWarehouseId: 'wh-1',
        lines: [
          {
            itemId: 'item-1',
            sourceLocationId: 'loc-same',
            destinationLocationId: 'loc-same',
            quantity: 10,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
