import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { StockMovementType, Prisma } from '@prisma/client';
import { AdjustmentsService } from './adjustments.service';
import { BalancesService } from '../balances/balances.service';

describe('AdjustmentsService (M09)', () => {
  let service: AdjustmentsService;
  let balancesServiceMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';
  const mockItemId = '33333333-3333-3333-3333-333333333333';
  const mockLocationId = '44444444-4444-4444-4444-444444444444';

  beforeEach(async () => {
    balancesServiceMock = {
      applyStockMovement: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdjustmentsService,
        { provide: BalancesService, useValue: balancesServiceMock },
      ],
    }).compile();

    service = module.get<AdjustmentsService>(AdjustmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. should execute ADJUSTMENT_IN via BalancesService', async () => {
    balancesServiceMock.applyStockMovement.mockResolvedValue({
      balance: {
        id: 'bal-1',
        quantityOnHand: new Prisma.Decimal('15.0000'),
      },
      movement: {
        id: 'mov-1',
        movementType: StockMovementType.ADJUSTMENT_IN,
        quantity: new Prisma.Decimal('5.0000'),
      },
    });

    const result = await service.createAdjustment(
      mockOrgId,
      {
        itemId: mockItemId,
        locationId: mockLocationId,
        movementType: StockMovementType.ADJUSTMENT_IN,
        quantity: 5,
        reason: 'Cycle count surplus',
      },
      mockUserId,
    );

    expect(balancesServiceMock.applyStockMovement).toHaveBeenCalledWith(
      mockOrgId,
      expect.objectContaining({
        itemId: mockItemId,
        locationId: mockLocationId,
        movementType: StockMovementType.ADJUSTMENT_IN,
        quantity: 5,
        reason: 'Cycle count surplus',
      }),
      mockUserId,
    );
    expect(result.movement.id).toBe('mov-1');
  });

  it('2. should execute ADJUSTMENT_OUT via BalancesService', async () => {
    balancesServiceMock.applyStockMovement.mockResolvedValue({
      balance: {
        id: 'bal-1',
        quantityOnHand: new Prisma.Decimal('8.0000'),
      },
      movement: {
        id: 'mov-2',
        movementType: StockMovementType.ADJUSTMENT_OUT,
        quantity: new Prisma.Decimal('2.0000'),
      },
    });

    const result = await service.createAdjustment(
      mockOrgId,
      {
        itemId: mockItemId,
        locationId: mockLocationId,
        movementType: StockMovementType.ADJUSTMENT_OUT,
        quantity: 2,
        reason: 'Damaged packaging write-off',
      },
      mockUserId,
    );

    expect(balancesServiceMock.applyStockMovement).toHaveBeenCalledWith(
      mockOrgId,
      expect.objectContaining({
        movementType: StockMovementType.ADJUSTMENT_OUT,
      }),
      mockUserId,
    );
    expect(result.movement.id).toBe('mov-2');
  });

  it('3. should reject invalid movementType in adjustment', async () => {
    await expect(
      service.createAdjustment(
        mockOrgId,
        {
          itemId: mockItemId,
          locationId: mockLocationId,
          movementType: StockMovementType.RECEIPT as any,
          quantity: 2,
          reason: 'Invalid type',
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
