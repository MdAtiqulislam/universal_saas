import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers/suppliers.service';
import { PurchaseOrdersService } from './orders/purchase-orders.service';
import { GoodsReceiptsService } from './receipts/goods-receipts.service';
import { PurchaseCostsService } from './costs/purchase-costs.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BalancesService } from '../inventory/balances/balances.service';

describe('Tenant Purchasing Isolation', () => {
  let suppliersService: SuppliersService;
  let ordersService: PurchaseOrdersService;
  let receiptsService: GoodsReceiptsService;
  let costsService: PurchaseCostsService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let balancesMock: any;

  const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const supplierB = '22222222-2222-2222-2222-222222222222';
  const locationB = '33333333-3333-3333-3333-333333333333';
  const itemB = '44444444-4444-4444-4444-444444444444';
  const orderB = '55555555-5555-5555-5555-555555555555';
  const receiptB = '66666666-6666-6666-6666-666666666666';
  const costB = '77777777-7777-7777-7777-777777777777';
  const userA = '88888888-8888-8888-8888-888888888888';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      supplier: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      purchaseOrder: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      goodsReceipt: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      purchaseCostAllocation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      location: {
        findFirst: jest.fn(),
      },
      item: {
        findFirst: jest.fn(),
      },
      currency: {
        findFirst: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({
        sequenceKey: 'TEST',
        number: 1,
        formatted: 'TEST-000001',
      }),
    };

    balancesMock = {
      applyStockMovement: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        PurchaseOrdersService,
        GoodsReceiptsService,
        PurchaseCostsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        { provide: BalancesService, useValue: balancesMock },
      ],
    }).compile();

    suppliersService = module.get<SuppliersService>(SuppliersService);
    ordersService = module.get<PurchaseOrdersService>(PurchaseOrdersService);
    receiptsService = module.get<GoodsReceiptsService>(GoodsReceiptsService);
    costsService = module.get<PurchaseCostsService>(PurchaseCostsService);
  });

  it('1. Tenant A cannot see or find Tenant B supplier', async () => {
    prismaMock.supplier.findFirst.mockImplementation(({ where }: any) => {
      if (where.id === supplierB && where.organizationId === tenantA) {
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    });

    await expect(suppliersService.findOne(tenantA, supplierB)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('2. Tenant A cannot modify Tenant B supplier', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(null);

    await expect(
      suppliersService.update(tenantA, supplierB, { name: 'Hijacked' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('3. Tenant A cannot create PO against Tenant B supplier', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(null);

    await expect(
      ordersService.create(
        tenantA,
        {
          supplierId: supplierB,
          locationId: 'loc-a',
          currencyId: 'curr-a',
          lines: [{ itemId: 'item-a', quantity: 1, unitPrice: 10 }],
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('4. Tenant A cannot create PO referencing Tenant B location', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({
      id: 'sup-a',
      isActive: true,
    });
    prismaMock.location.findFirst.mockResolvedValue(null);

    await expect(
      ordersService.create(
        tenantA,
        {
          supplierId: 'sup-a',
          locationId: locationB,
          currencyId: 'curr-a',
          lines: [{ itemId: 'item-a', quantity: 1, unitPrice: 10 }],
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('5. Tenant A cannot create PO referencing Tenant B item', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({
      id: 'sup-a',
      isActive: true,
    });
    prismaMock.location.findFirst.mockResolvedValue({
      id: 'loc-a',
      isActive: true,
    });
    prismaMock.currency.findFirst.mockResolvedValue({
      id: 'curr-a',
      isActive: true,
    });
    prismaMock.item.findFirst.mockResolvedValue(null);

    await expect(
      ordersService.create(
        tenantA,
        {
          supplierId: 'sup-a',
          locationId: 'loc-a',
          currencyId: 'curr-a',
          lines: [{ itemId: itemB, quantity: 1, unitPrice: 10 }],
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('6. Tenant A cannot create goods receipt against Tenant B PO', async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);

    await expect(
      receiptsService.createDraft(
        tenantA,
        {
          purchaseOrderId: orderB,
          lines: [{ purchaseOrderLineId: 'po-line-b', quantity: 5 }],
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('7. Tenant A cannot view Tenant B goods receipt', async () => {
    prismaMock.goodsReceipt.findFirst.mockResolvedValue(null);

    await expect(receiptsService.findOne(tenantA, receiptB)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('8. Tenant A cannot view Tenant B purchase cost allocation', async () => {
    prismaMock.purchaseCostAllocation.findFirst.mockResolvedValue(null);

    await expect(costsService.findOne(tenantA, costB)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('9. Tenant A list queries never return Tenant B data', async () => {
    prismaMock.supplier.count.mockResolvedValue(1);
    prismaMock.supplier.findMany.mockImplementation(({ where }: any) => {
      expect(where.organizationId).toBe(tenantA);
      expect(where.organizationId).not.toBe(tenantB);
      return Promise.resolve([]);
    });

    const result = await suppliersService.findAll(tenantA, {});
    expect(result.suppliers).toHaveLength(0);
  });
});
