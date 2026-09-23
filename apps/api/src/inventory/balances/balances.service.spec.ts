import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  StockMovementType,
  TrackingType,
  SerialStatus,
} from '@prisma/client';
import { BalancesService } from './balances.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';

describe('BalancesService (M09)', () => {
  let service: BalancesService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';
  const mockItemId = '33333333-3333-3333-3333-333333333333';
  const mockLocationId = '44444444-4444-4444-4444-444444444444';
  const mockBatchId = '55555555-5555-5555-5555-555555555555';
  const mockSerialId = '66666666-6666-6666-6666-666666666666';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      item: {
        findFirst: jest.fn(),
      },
      itemVariant: {
        findFirst: jest.fn(),
      },
      location: {
        findFirst: jest.fn(),
      },
      inventoryBalance: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      inventoryBatch: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      inventorySerial: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      stockMovement: {
        create: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalancesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<BalancesService>(BalancesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. should create initial balance and movement on RECEIPT', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      organizationId: mockOrgId,
      sku: 'ITEM-100',
      trackingType: TrackingType.NONE,
      isActive: true,
    });
    prismaMock.location.findFirst.mockResolvedValue({
      id: mockLocationId,
      organizationId: mockOrgId,
      code: 'WH-MAIN',
      isActive: true,
    });
    prismaMock.inventoryBalance.findFirst.mockResolvedValue(null);
    prismaMock.inventoryBalance.create.mockResolvedValue({
      id: 'balance-1',
      organizationId: mockOrgId,
      locationId: mockLocationId,
      itemId: mockItemId,
      quantityOnHand: new Prisma.Decimal('0.0000'),
      quantityReserved: new Prisma.Decimal('0.0000'),
    });
    prismaMock.inventoryBalance.update.mockResolvedValue({
      id: 'balance-1',
      quantityOnHand: new Prisma.Decimal('10.0000'),
    });
    prismaMock.stockMovement.create.mockResolvedValue({
      id: 'mov-1',
      movementType: StockMovementType.RECEIPT,
      quantity: new Prisma.Decimal('10.0000'),
    });

    const result = await service.applyStockMovement(
      mockOrgId,
      {
        itemId: mockItemId,
        locationId: mockLocationId,
        movementType: StockMovementType.RECEIPT,
        quantity: 10,
      },
      mockUserId,
    );

    expect(result.balance.quantityOnHand.toString()).toBe('10');
    expect(result.movement.id).toBe('mov-1');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'STOCK_RECEIVED',
      }),
    );
  });

  it('2. should decrease stock on ISSUE', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      organizationId: mockOrgId,
      sku: 'ITEM-100',
      trackingType: TrackingType.NONE,
      isActive: true,
    });
    prismaMock.location.findFirst.mockResolvedValue({
      id: mockLocationId,
      organizationId: mockOrgId,
      code: 'WH-MAIN',
      isActive: true,
    });
    prismaMock.inventoryBalance.findFirst.mockResolvedValue({
      id: 'balance-1',
      organizationId: mockOrgId,
      locationId: mockLocationId,
      itemId: mockItemId,
      quantityOnHand: new Prisma.Decimal('10.0000'),
      quantityReserved: new Prisma.Decimal('0.0000'),
    });
    prismaMock.inventoryBalance.update.mockResolvedValue({
      id: 'balance-1',
      quantityOnHand: new Prisma.Decimal('6.0000'),
    });
    prismaMock.stockMovement.create.mockResolvedValue({
      id: 'mov-2',
      movementType: StockMovementType.ISSUE,
      quantity: new Prisma.Decimal('4.0000'),
    });

    const result = await service.applyStockMovement(
      mockOrgId,
      {
        itemId: mockItemId,
        locationId: mockLocationId,
        movementType: StockMovementType.ISSUE,
        quantity: 4,
      },
      mockUserId,
    );

    expect(result.balance.quantityOnHand.toString()).toBe('6');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'STOCK_ISSUED',
      }),
    );
  });

  it('3. should reject negative resulting stock on ISSUE', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      organizationId: mockOrgId,
      sku: 'ITEM-100',
      trackingType: TrackingType.NONE,
      isActive: true,
    });
    prismaMock.location.findFirst.mockResolvedValue({
      id: mockLocationId,
      organizationId: mockOrgId,
      code: 'WH-MAIN',
      isActive: true,
    });
    prismaMock.inventoryBalance.findFirst.mockResolvedValue({
      id: 'balance-1',
      organizationId: mockOrgId,
      locationId: mockLocationId,
      itemId: mockItemId,
      quantityOnHand: new Prisma.Decimal('5.0000'),
      quantityReserved: new Prisma.Decimal('0.0000'),
    });

    await expect(
      service.applyStockMovement(
        mockOrgId,
        {
          itemId: mockItemId,
          locationId: mockLocationId,
          movementType: StockMovementType.ISSUE,
          quantity: 10,
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('4. should reject movements with quantity <= 0', async () => {
    await expect(
      service.applyStockMovement(
        mockOrgId,
        {
          itemId: mockItemId,
          locationId: mockLocationId,
          movementType: StockMovementType.RECEIPT,
          quantity: 0,
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('5. should reject movements on inactive item or location', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      organizationId: mockOrgId,
      sku: 'ITEM-100',
      trackingType: TrackingType.NONE,
      isActive: false,
    });

    await expect(
      service.applyStockMovement(
        mockOrgId,
        {
          itemId: mockItemId,
          locationId: mockLocationId,
          movementType: StockMovementType.RECEIPT,
          quantity: 5,
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('6. should reject batch/serial parameters for TrackingType.NONE item', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      organizationId: mockOrgId,
      sku: 'ITEM-100',
      trackingType: TrackingType.NONE,
      isActive: true,
    });
    prismaMock.location.findFirst.mockResolvedValue({
      id: mockLocationId,
      organizationId: mockOrgId,
      code: 'WH-MAIN',
      isActive: true,
    });

    await expect(
      service.applyStockMovement(
        mockOrgId,
        {
          itemId: mockItemId,
          locationId: mockLocationId,
          movementType: StockMovementType.RECEIPT,
          quantity: 5,
          batchId: mockBatchId,
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('7. should validate batch for TrackingType.BATCH and update batch quantity', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      organizationId: mockOrgId,
      sku: 'ITEM-BATCH',
      trackingType: TrackingType.BATCH,
      isActive: true,
    });
    prismaMock.location.findFirst.mockResolvedValue({
      id: mockLocationId,
      organizationId: mockOrgId,
      code: 'WH-MAIN',
      isActive: true,
    });
    prismaMock.inventoryBatch.findFirst.mockResolvedValue({
      id: mockBatchId,
      organizationId: mockOrgId,
      itemId: mockItemId,
      locationId: mockLocationId,
      batchNumber: 'LOT-2026-001',
      quantity: new Prisma.Decimal('20.0000'),
    });
    prismaMock.inventoryBatch.findUnique.mockResolvedValue({
      id: mockBatchId,
      quantity: new Prisma.Decimal('20.0000'),
    });
    prismaMock.inventoryBalance.findFirst.mockResolvedValue({
      id: 'balance-1',
      quantityOnHand: new Prisma.Decimal('20.0000'),
      quantityReserved: new Prisma.Decimal('0.0000'),
    });
    prismaMock.inventoryBalance.update.mockResolvedValue({
      id: 'balance-1',
      quantityOnHand: new Prisma.Decimal('15.0000'),
    });
    prismaMock.stockMovement.create.mockResolvedValue({
      id: 'mov-3',
      movementType: StockMovementType.ISSUE,
      quantity: new Prisma.Decimal('5.0000'),
    });

    const result = await service.applyStockMovement(
      mockOrgId,
      {
        itemId: mockItemId,
        locationId: mockLocationId,
        movementType: StockMovementType.ISSUE,
        quantity: 5,
        batchId: mockBatchId,
      },
      mockUserId,
    );

    expect(prismaMock.inventoryBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockBatchId },
        data: { quantity: new Prisma.Decimal('15.0000') },
      }),
    );
    expect(result.movement.id).toBe('mov-3');
  });

  it('8. should validate serial for TrackingType.SERIAL and enforce quantity=1', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      organizationId: mockOrgId,
      sku: 'ITEM-SERIAL',
      trackingType: TrackingType.SERIAL,
      isActive: true,
    });
    prismaMock.location.findFirst.mockResolvedValue({
      id: mockLocationId,
      organizationId: mockOrgId,
      code: 'WH-MAIN',
      isActive: true,
    });
    prismaMock.inventorySerial.findFirst.mockResolvedValue({
      id: mockSerialId,
      organizationId: mockOrgId,
      itemId: mockItemId,
      locationId: mockLocationId,
      serialNumber: 'SN-998877',
      status: SerialStatus.AVAILABLE,
    });
    prismaMock.inventoryBalance.findFirst.mockResolvedValue({
      id: 'balance-1',
      quantityOnHand: new Prisma.Decimal('1.0000'),
      quantityReserved: new Prisma.Decimal('0.0000'),
    });
    prismaMock.inventoryBalance.update.mockResolvedValue({
      id: 'balance-1',
      quantityOnHand: new Prisma.Decimal('0.0000'),
    });
    prismaMock.stockMovement.create.mockResolvedValue({
      id: 'mov-4',
      movementType: StockMovementType.ISSUE,
      quantity: new Prisma.Decimal('1.0000'),
    });

    // Should fail if quantity is not 1
    await expect(
      service.applyStockMovement(
        mockOrgId,
        {
          itemId: mockItemId,
          locationId: mockLocationId,
          movementType: StockMovementType.ISSUE,
          quantity: 2,
          serialId: mockSerialId,
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);

    // Should succeed with quantity 1 and update status to SOLD
    const result = await service.applyStockMovement(
      mockOrgId,
      {
        itemId: mockItemId,
        locationId: mockLocationId,
        movementType: StockMovementType.ISSUE,
        quantity: 1,
        serialId: mockSerialId,
      },
      mockUserId,
    );

    expect(prismaMock.inventorySerial.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockSerialId },
        data: expect.objectContaining({ status: SerialStatus.SOLD }),
      }),
    );
    expect(result.movement.id).toBe('mov-4');
  });

  it('9. should calculate available quantity in findAll', async () => {
    prismaMock.inventoryBalance.count.mockResolvedValue(1);
    prismaMock.inventoryBalance.findMany.mockResolvedValue([
      {
        id: 'balance-1',
        organizationId: mockOrgId,
        locationId: mockLocationId,
        itemId: mockItemId,
        quantityOnHand: new Prisma.Decimal('100.0000'),
        quantityReserved: new Prisma.Decimal('25.0000'),
        location: {
          id: mockLocationId,
          code: 'WH-1',
          name: 'Main Warehouse',
          type: 'WAREHOUSE',
        },
        item: {
          id: mockItemId,
          sku: 'ITEM-A',
          name: 'Item A',
          itemType: 'PRODUCT',
          trackingType: 'NONE',
        },
        variant: null,
      },
    ]);

    const result = await service.findAll(mockOrgId, {});
    expect(result.total).toBe(1);
    expect(result.balances[0].quantityAvailable).toBe('75');
    expect(result.balances[0].quantityOnHand).toBe('100');
    expect(result.balances[0].quantityReserved).toBe('25');
  });

  it('10. should find balances by item ID', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      organizationId: mockOrgId,
      sku: 'ITEM-A',
    });
    prismaMock.inventoryBalance.findMany.mockResolvedValue([
      {
        id: 'balance-1',
        organizationId: mockOrgId,
        locationId: mockLocationId,
        itemId: mockItemId,
        quantityOnHand: new Prisma.Decimal('50.0000'),
        quantityReserved: new Prisma.Decimal('0.0000'),
        location: {
          id: mockLocationId,
          code: 'WH-1',
          name: 'Main Warehouse',
          type: 'WAREHOUSE',
        },
        variant: null,
      },
    ]);

    const result = await service.findOneByItem(mockOrgId, mockItemId);
    expect(result).toHaveLength(1);
    expect(result[0].quantityAvailable).toBe('50');
  });

  it('11. should throw NotFoundException when item does not exist in findOneByItem', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null);

    await expect(
      service.findOneByItem(mockOrgId, 'missing-item'),
    ).rejects.toThrow(NotFoundException);
  });
});
