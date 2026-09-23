import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, StockMovementType, TrackingType } from '@prisma/client';
import { BalancesService } from './balances/balances.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

describe('Inventory Concurrency & Transactional Safety (M09)', () => {
  let service: BalancesService;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';
  const mockItemId = '33333333-3333-3333-3333-333333333333';
  const mockLocationId = '44444444-4444-4444-4444-444444444444';

  it('should safely process 100 concurrent parallel stock mutations without lost updates or invalid state', async () => {
    // Simulated atomic state in memory
    let inMemoryOnHand = new Prisma.Decimal('100.0000');
    const recordedMovements: any[] = [];

    // Mutex to simulate database row-level locking
    let lock = Promise.resolve();

    const prismaMock: any = {
      $transaction: jest.fn(async (callback) => {
        // Acquire lock
        let releaseLock: () => void;
        const currentLock = lock;
        lock = new Promise((resolve) => {
          releaseLock = resolve;
        });
        await currentLock;

        try {
          const txMock: any = {
            item: {
              findFirst: jest.fn().mockResolvedValue({
                id: mockItemId,
                organizationId: mockOrgId,
                sku: 'CONCURRENT-SKU',
                trackingType: TrackingType.NONE,
                isActive: true,
              }),
            },
            location: {
              findFirst: jest.fn().mockResolvedValue({
                id: mockLocationId,
                organizationId: mockOrgId,
                code: 'WH-CONCURRENT',
                isActive: true,
              }),
            },
            inventoryBalance: {
              findFirst: jest.fn().mockImplementation(() =>
                Promise.resolve({
                  id: 'balance-concurrent',
                  organizationId: mockOrgId,
                  locationId: mockLocationId,
                  itemId: mockItemId,
                  variantId: null,
                  quantityOnHand: inMemoryOnHand,
                  quantityReserved: new Prisma.Decimal('0.0000'),
                }),
              ),
              create: jest.fn(),
              update: jest.fn().mockImplementation(({ data }) => {
                inMemoryOnHand = data.quantityOnHand;
                return Promise.resolve({
                  id: 'balance-concurrent',
                  quantityOnHand: inMemoryOnHand,
                });
              }),
            },
            stockMovement: {
              create: jest.fn().mockImplementation(({ data }) => {
                const mov = {
                  id: `mov-${recordedMovements.length + 1}`,
                  ...data,
                };
                recordedMovements.push(mov);
                return Promise.resolve(mov);
              }),
            },
          };

          return await callback(txMock);
        } finally {
          releaseLock!();
        }
      }),
    };

    const eventBusMock = {
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

    // Initial stock = 100.
    // 50 operations of +2 (RECEIPT) = +100
    // 50 operations of -1 (ISSUE)   = -50
    // Expected final stock = 100 + 100 - 50 = 150.
    const promises: Promise<any>[] = [];

    for (let i = 0; i < 50; i++) {
      promises.push(
        service.applyStockMovement(
          mockOrgId,
          {
            itemId: mockItemId,
            locationId: mockLocationId,
            movementType: StockMovementType.RECEIPT,
            quantity: 2,
          },
          mockUserId,
        ),
      );
    }

    for (let i = 0; i < 50; i++) {
      promises.push(
        service.applyStockMovement(
          mockOrgId,
          {
            itemId: mockItemId,
            locationId: mockLocationId,
            movementType: StockMovementType.ISSUE,
            quantity: 1,
          },
          mockUserId,
        ),
      );
    }

    // Execute all 100 mutations simultaneously
    const results = await Promise.all(promises);

    expect(results).toHaveLength(100);
    expect(recordedMovements).toHaveLength(100);
    expect(inMemoryOnHand.toString()).toBe('150');
  });

  it('should reject concurrent over-draw and maintain consistent balance', async () => {
    // Initial stock = 10.
    // 3 parallel requests trying to deduct 7 each.
    // Exactly one should succeed (10 - 7 = 3), and the other two must fail with BadRequestException.
    let inMemoryOnHand = new Prisma.Decimal('10.0000');
    const recordedMovements: any[] = [];
    let lock = Promise.resolve();

    const prismaMock: any = {
      $transaction: jest.fn(async (callback) => {
        let releaseLock: () => void;
        const currentLock = lock;
        lock = new Promise((resolve) => {
          releaseLock = resolve;
        });
        await currentLock;

        try {
          const txMock: any = {
            item: {
              findFirst: jest.fn().mockResolvedValue({
                id: mockItemId,
                organizationId: mockOrgId,
                sku: 'CONCURRENT-SKU',
                trackingType: TrackingType.NONE,
                isActive: true,
              }),
            },
            location: {
              findFirst: jest.fn().mockResolvedValue({
                id: mockLocationId,
                organizationId: mockOrgId,
                code: 'WH-CONCURRENT',
                isActive: true,
              }),
            },
            inventoryBalance: {
              findFirst: jest.fn().mockImplementation(() =>
                Promise.resolve({
                  id: 'balance-concurrent',
                  organizationId: mockOrgId,
                  locationId: mockLocationId,
                  itemId: mockItemId,
                  variantId: null,
                  quantityOnHand: inMemoryOnHand,
                  quantityReserved: new Prisma.Decimal('0.0000'),
                }),
              ),
              create: jest.fn(),
              update: jest.fn().mockImplementation(({ data }) => {
                inMemoryOnHand = data.quantityOnHand;
                return Promise.resolve({
                  id: 'balance-concurrent',
                  quantityOnHand: inMemoryOnHand,
                });
              }),
            },
            stockMovement: {
              create: jest.fn().mockImplementation(({ data }) => {
                const mov = {
                  id: `mov-${recordedMovements.length + 1}`,
                  ...data,
                };
                recordedMovements.push(mov);
                return Promise.resolve(mov);
              }),
            },
          };

          return await callback(txMock);
        } finally {
          releaseLock!();
        }
      }),
    };

    const eventBusMock = {
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

    const outcomes = await Promise.allSettled([
      service.applyStockMovement(
        mockOrgId,
        {
          itemId: mockItemId,
          locationId: mockLocationId,
          movementType: StockMovementType.ISSUE,
          quantity: 7,
        },
        mockUserId,
      ),
      service.applyStockMovement(
        mockOrgId,
        {
          itemId: mockItemId,
          locationId: mockLocationId,
          movementType: StockMovementType.ISSUE,
          quantity: 7,
        },
        mockUserId,
      ),
      service.applyStockMovement(
        mockOrgId,
        {
          itemId: mockItemId,
          locationId: mockLocationId,
          movementType: StockMovementType.ISSUE,
          quantity: 7,
        },
        mockUserId,
      ),
    ]);

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(2);
    expect(inMemoryOnHand.toString()).toBe('3');
    expect(recordedMovements).toHaveLength(1);
  });
});
