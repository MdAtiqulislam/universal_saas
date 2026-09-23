import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseQuarantineService } from './warehouse-quarantine.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BadRequestException } from '@nestjs/common';
import { Prisma, QuarantineStatus } from '@prisma/client';

describe('WarehouseQuarantineService', () => {
  let service: WarehouseQuarantineService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;

  const mockOrgId = 'org-111';

  beforeEach(async () => {
    prisma = {
      location: { findFirst: jest.fn() },
      item: { findFirst: jest.fn() },
      inventoryBalance: { findFirst: jest.fn() },
      quarantineRecord: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'QR-000001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseQuarantineService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
      ],
    }).compile();

    service = module.get<WarehouseQuarantineService>(
      WarehouseQuarantineService,
    );
  });

  it('should quarantine stock when balance is sufficient', async () => {
    prisma.location.findFirst.mockResolvedValue({
      id: 'loc-1',
      organizationId: mockOrgId,
    });
    prisma.item.findFirst.mockResolvedValue({
      id: 'item-1',
      organizationId: mockOrgId,
    });
    prisma.inventoryBalance.findFirst.mockResolvedValue({
      quantityOnHand: new Prisma.Decimal('50.0000'),
    });

    prisma.quarantineRecord.create.mockResolvedValue({
      id: 'qr-1',
      organizationId: mockOrgId,
      quarantineNumber: 'QR-000001',
      quantity: new Prisma.Decimal('10.0000'),
      status: QuarantineStatus.QUARANTINED,
      warehouse: { id: 'wh-1', code: 'WH1', name: 'Main WH' },
      location: { id: 'loc-1', code: 'LOC1', name: 'Bin 1' },
      item: { id: 'item-1', sku: 'SKU1', name: 'Item 1' },
      variant: null,
      batch: null,
      serial: null,
    });

    const result = await service.quarantineStock(mockOrgId, {
      warehouseId: 'wh-1',
      locationId: 'loc-1',
      itemId: 'item-1',
      quantity: 10,
      reason: 'Damaged packaging during unloading',
    });

    expect(result.quarantineNumber).toBe('QR-000001');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'WAREHOUSE_STOCK_QUARANTINED',
      }),
    );
  });

  it('should throw BadRequestException if quarantine quantity exceeds on-hand balance', async () => {
    prisma.location.findFirst.mockResolvedValue({
      id: 'loc-1',
      organizationId: mockOrgId,
    });
    prisma.item.findFirst.mockResolvedValue({
      id: 'item-1',
      organizationId: mockOrgId,
    });
    prisma.inventoryBalance.findFirst.mockResolvedValue({
      quantityOnHand: new Prisma.Decimal('5.0000'),
    });

    await expect(
      service.quarantineStock(mockOrgId, {
        warehouseId: 'wh-1',
        locationId: 'loc-1',
        itemId: 'item-1',
        quantity: 20,
        reason: 'Excessive check',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
