import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PurchaseCostsService } from './purchase-costs.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { PurchaseCostType, CostAllocationMethod, Prisma } from '@prisma/client';

describe('PurchaseCostsService', () => {
  let service: PurchaseCostsService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockCurrencyId = '22222222-2222-2222-2222-222222222222';
  const mockOrderId = '33333333-3333-3333-3333-333333333333';
  const mockCostId = '44444444-4444-4444-4444-444444444444';

  beforeEach(async () => {
    prismaMock = {
      purchaseCostAllocation: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      purchaseOrder: {
        findFirst: jest.fn(),
      },
      goodsReceipt: {
        findFirst: jest.fn(),
      },
      currency: {
        findFirst: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseCostsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<PurchaseCostsService>(PurchaseCostsService);
  });

  it('1. should create purchase cost allocation record', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue({ id: mockOrderId });
    prismaMock.currency.findFirst.mockResolvedValue({ id: mockCurrencyId });
    prismaMock.purchaseCostAllocation.create.mockResolvedValue({
      id: mockCostId,
      organizationId: mockOrgId,
      purchaseOrderId: mockOrderId,
      costType: PurchaseCostType.CUSTOMS,
      amount: new Prisma.Decimal('250.0000'),
      currencyId: mockCurrencyId,
      allocationMethod: CostAllocationMethod.BY_VALUE,
    });

    const result = await service.create(mockOrgId, {
      purchaseOrderId: mockOrderId,
      costType: PurchaseCostType.CUSTOMS,
      amount: 250,
      currencyId: mockCurrencyId,
      allocationMethod: CostAllocationMethod.BY_VALUE,
    });

    expect(result.costType).toBe(PurchaseCostType.CUSTOMS);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'PURCHASE_COST_CREATED',
      }),
    );
  });

  it('2. should reject non-positive cost amount', async () => {
    await expect(
      service.create(mockOrgId, {
        costType: PurchaseCostType.SHIPPING,
        amount: 0,
        currencyId: mockCurrencyId,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should reject non-existent purchase order reference', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);

    await expect(
      service.create(mockOrgId, {
        purchaseOrderId: 'invalid-po',
        costType: PurchaseCostType.SHIPPING,
        amount: 100,
        currencyId: mockCurrencyId,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('4. should update cost allocation record', async () => {
    prismaMock.purchaseCostAllocation.findFirst.mockResolvedValue({
      id: mockCostId,
      costType: PurchaseCostType.SHIPPING,
      amount: new Prisma.Decimal('100.0000'),
    });
    prismaMock.purchaseCostAllocation.update.mockResolvedValue({
      id: mockCostId,
      costType: PurchaseCostType.SHIPPING,
      amount: new Prisma.Decimal('150.0000'),
    });

    const result = await service.update(mockOrgId, mockCostId, {
      amount: 150,
    });

    expect(result.amount.toString()).toBe('150');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'PURCHASE_COST_UPDATED',
      }),
    );
  });
});
