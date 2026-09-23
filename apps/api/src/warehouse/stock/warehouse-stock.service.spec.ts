import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseStockService } from './warehouse-stock.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Prisma,
  WarehouseLocationType,
  ReservationStatus,
  QuarantineStatus,
} from '@prisma/client';

describe('WarehouseStockService', () => {
  let service: WarehouseStockService;
  let prisma: any;

  const mockOrgId = 'org-111';

  beforeEach(async () => {
    prisma = {
      inventoryBalance: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      inventoryReservation: {
        findMany: jest.fn(),
      },
      quarantineRecord: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseStockService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<WarehouseStockService>(WarehouseStockService);
  });

  it('should derive available stock correctly after deducting reservations and quarantine', async () => {
    prisma.inventoryBalance.findMany.mockResolvedValue([
      {
        locationId: 'loc-1',
        itemId: 'item-1',
        variantId: null,
        quantityOnHand: new Prisma.Decimal('100.0000'),
        location: {
          id: 'loc-1',
          code: 'BIN-01',
          name: 'Storage Bin 01',
          locationType: WarehouseLocationType.STORAGE,
        },
        item: {
          id: 'item-1',
          sku: 'SKU-A',
          name: 'Widget A',
        },
        variant: null,
      },
    ]);
    prisma.inventoryBalance.count.mockResolvedValue(1);

    prisma.inventoryReservation.findMany.mockResolvedValue([
      {
        locationId: 'loc-1',
        itemId: 'item-1',
        variantId: null,
        quantity: new Prisma.Decimal('20.0000'),
        status: ReservationStatus.ACTIVE,
      },
    ]);

    prisma.quarantineRecord.findMany.mockResolvedValue([
      {
        locationId: 'loc-1',
        itemId: 'item-1',
        variantId: null,
        quantity: new Prisma.Decimal('15.0000'),
        status: QuarantineStatus.QUARANTINED,
      },
    ]);

    const result = await service.getStockPositions(mockOrgId, {});
    expect(result.data).toHaveLength(1);
    const pos = result.data[0];
    expect(pos.onHand).toBe('100');
    expect(pos.reserved).toBe('20');
    expect(pos.quarantined).toBe('15');
    expect(pos.available).toBe('65');
  });

  it('should calculate zero available for damaged and scrap location types', async () => {
    prisma.inventoryBalance.findMany.mockResolvedValue([
      {
        locationId: 'loc-dmg',
        itemId: 'item-1',
        variantId: null,
        quantityOnHand: new Prisma.Decimal('50.0000'),
        location: {
          id: 'loc-dmg',
          code: 'DMG-01',
          name: 'Damaged Hold',
          locationType: WarehouseLocationType.DAMAGED,
        },
        item: { id: 'item-1', sku: 'SKU-A', name: 'Widget A' },
        variant: null,
      },
    ]);
    prisma.inventoryBalance.count.mockResolvedValue(1);
    prisma.inventoryReservation.findMany.mockResolvedValue([]);
    prisma.quarantineRecord.findMany.mockResolvedValue([]);

    const result = await service.getStockPositions(mockOrgId, {});
    expect(result.data[0].available).toBe('0');
    expect(result.data[0].damaged).toBe('50');
  });
});
