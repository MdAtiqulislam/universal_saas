import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StockMovementType, TrackingType } from '@prisma/client';
import { BalancesService } from './balances/balances.service';
import { BatchesService } from './batches/batches.service';
import { SerialsService } from './serials/serials.service';
import { TransfersService } from './transfers/transfers.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';

describe('Tenant Inventory Isolation & Multi-Tenancy (M09)', () => {
  let balancesService: BalancesService;
  let batchesService: BatchesService;
  let serialsService: SerialsService;
  let transfersService: TransfersService;
  let prismaMock: any;

  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';
  const userA = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((cb) => cb(prismaMock)),
      inventoryBalance: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      item: {
        findFirst: jest.fn(),
      },
      location: {
        findFirst: jest.fn(),
      },
      inventoryBatch: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      inventorySerial: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      stockTransfer: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const numberingServiceMock = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'TRF-000001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalancesService,
        BatchesService,
        SerialsService,
        TransfersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingServiceMock },
      ],
    }).compile();

    balancesService = module.get<BalancesService>(BalancesService);
    batchesService = module.get<BatchesService>(BatchesService);
    serialsService = module.get<SerialsService>(SerialsService);
    transfersService = module.get<TransfersService>(TransfersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. Org A cannot see Org B stock balances', async () => {
    prismaMock.inventoryBalance.findMany.mockResolvedValue([]);
    prismaMock.inventoryBalance.count.mockResolvedValue(0);

    await balancesService.findAll(orgA, {});

    expect(prismaMock.inventoryBalance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: orgA }),
      }),
    );
  });

  it('2. Org A cannot mutate stock for Org B item', async () => {
    // Item belongs to Org B, not found when querying with orgA
    prismaMock.item.findFirst.mockResolvedValue(null);

    await expect(
      balancesService.applyStockMovement(
        orgA,
        {
          itemId: 'item-b-id',
          locationId: 'loc-a-id',
          movementType: StockMovementType.RECEIPT,
          quantity: 10,
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('3. Org A cannot mutate stock at Org B location', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: 'item-a-id',
      organizationId: orgA,
      sku: 'ITEM-A',
      trackingType: TrackingType.NONE,
      isActive: true,
    });
    // Location belongs to Org B, not found when querying with orgA
    prismaMock.location.findFirst.mockResolvedValue(null);

    await expect(
      balancesService.applyStockMovement(
        orgA,
        {
          itemId: 'item-a-id',
          locationId: 'loc-b-id',
          movementType: StockMovementType.RECEIPT,
          quantity: 10,
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('4. Org A cannot access or update Org B batch', async () => {
    prismaMock.inventoryBatch.findFirst.mockResolvedValue(null);

    await expect(batchesService.findOne(orgA, 'batch-b-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('5. Org A cannot access or update Org B serial', async () => {
    prismaMock.inventorySerial.findFirst.mockResolvedValue(null);

    await expect(serialsService.findOne(orgA, 'serial-b-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('6. Org A cannot complete Org B stock transfer', async () => {
    prismaMock.stockTransfer.findFirst.mockResolvedValue(null);

    await expect(
      transfersService.completeTransfer(
        orgA,
        'transfer-b-id',
        { lines: [{ itemId: 'item-1', quantity: 5 }] },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('7. Org A and Org B can maintain independent stock records without collision', async () => {
    prismaMock.inventoryBalance.findMany
      .mockResolvedValueOnce([
        {
          id: 'bal-a',
          organizationId: orgA,
          quantityOnHand: {
            minus: () => ({ toString: () => '50' }),
            toString: () => '50',
          },
          quantityReserved: { toString: () => '0' },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'bal-b',
          organizationId: orgB,
          quantityOnHand: {
            minus: () => ({ toString: () => '120' }),
            toString: () => '120',
          },
          quantityReserved: { toString: () => '0' },
        },
      ]);
    prismaMock.inventoryBalance.count.mockResolvedValue(1);

    const resultA = await balancesService.findAll(orgA, {});
    const resultB = await balancesService.findAll(orgB, {});

    expect(resultA.balances[0].quantityOnHand).toBe('50');
    expect(resultB.balances[0].quantityOnHand).toBe('120');
  });
});
