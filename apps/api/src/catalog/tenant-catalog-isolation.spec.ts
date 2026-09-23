import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CategoriesService } from './categories/categories.service';
import { UnitsService } from './units/units.service';
import { ItemsService } from './items/items.service';
import { VariantsService } from './variants/variants.service';
import { PricingService } from './pricing/pricing.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('Tenant Catalog & Multi-Tenancy Data Isolation', () => {
  let categoriesService: CategoriesService;
  let unitsService: UnitsService;
  let itemsService: ItemsService;
  let variantsService: VariantsService;
  let pricingService: PricingService;
  let prismaMock: any;

  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';
  const userA = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    prismaMock = {
      category: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      unitOfMeasure: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      item: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      itemVariant: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      pricingTier: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      itemPrice: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      currency: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        if (typeof cb === 'function') {
          return cb(prismaMock);
        }
        return Promise.all(cb);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        UnitsService,
        ItemsService,
        VariantsService,
        PricingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    categoriesService = module.get<CategoriesService>(CategoriesService);
    unitsService = module.get<UnitsService>(UnitsService);
    itemsService = module.get<ItemsService>(ItemsService);
    variantsService = module.get<VariantsService>(VariantsService);
    pricingService = module.get<PricingService>(PricingService);
  });

  it('1. Org A cannot read Org B category by ID (returns NotFoundException without leaking existence)', async () => {
    prismaMock.category.findFirst.mockResolvedValue(null);

    await expect(categoriesService.findOne(orgA, 'cat-b-id')).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.category.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'cat-b-id',
        organizationId: orgA,
        deletedAt: null,
      },
      include: expect.any(Object),
    });
  });

  it('2. Org A cannot assign Org B category as a parent category', async () => {
    prismaMock.category.findFirst
      .mockResolvedValueOnce(null) // code uniqueness
      .mockResolvedValueOnce(null); // parent existence in Org A

    await expect(
      categoriesService.create(
        orgA,
        {
          name: 'Sub Category',
          code: 'SUB-CAT',
          parentId: 'cat-belonging-to-org-b',
        },
        userA,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. Org A cannot read Org B Unit of Measure', async () => {
    prismaMock.unitOfMeasure.findFirst.mockResolvedValue(null);

    await expect(unitsService.findOne(orgA, 'uom-b-id')).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.unitOfMeasure.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'uom-b-id',
        organizationId: orgA,
      },
    });
  });

  it('4. Org A cannot use Org B Unit of Measure when creating an Item', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null);
    prismaMock.unitOfMeasure.findFirst.mockResolvedValue(null); // Not found in Org A

    await expect(
      itemsService.create(
        orgA,
        {
          sku: 'ITEM-A',
          name: 'Item A',
          unitId: 'uom-belonging-to-org-b',
        },
        userA,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('5. Org A cannot read or mutate Org B Item', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null);

    await expect(itemsService.findOne(orgA, 'item-b-id')).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      itemsService.softDelete(orgA, 'item-b-id', userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('6. Org A cannot create a variant for an Item belonging to Org B', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null); // item-b not in Org A

    await expect(
      variantsService.create(
        orgA,
        'item-belonging-to-org-b',
        { sku: 'VAR-1' },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('7. Org A cannot create price referencing Org B pricing tier', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: 'item-a-id',
      organizationId: orgA,
    });
    prismaMock.pricingTier.findFirst.mockResolvedValue(null); // Tier belonging to Org B not found in Org A

    await expect(
      pricingService.createPrice(
        orgA,
        { itemId: 'item-a-id' },
        { pricingTierId: 'tier-belonging-to-org-b', amount: 150 },
        userA,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('8. Org A cannot read or modify Org B price entries', async () => {
    prismaMock.itemPrice.findFirst.mockResolvedValue(null);

    await expect(
      pricingService.updatePrice(orgA, 'price-b-id', { amount: 200 }, userA),
    ).rejects.toThrow(NotFoundException);

    await expect(
      pricingService.deletePrice(orgA, 'price-b-id', userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('9. Org A and Org B can independently have items with identical SKU without conflict', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null);
    prismaMock.unitOfMeasure.findFirst.mockResolvedValue({
      id: 'uom-1',
      isActive: true,
    });
    prismaMock.item.create
      .mockResolvedValueOnce({
        id: 'item-a',
        organizationId: orgA,
        sku: 'PROD-SAME-SKU',
      })
      .mockResolvedValueOnce({
        id: 'item-b',
        organizationId: orgB,
        sku: 'PROD-SAME-SKU',
      });

    const itemA = await itemsService.create(
      orgA,
      { sku: 'PROD-SAME-SKU', name: 'Item in Org A', unitId: 'uom-1' },
      userA,
    );
    const itemB = await itemsService.create(
      orgB,
      { sku: 'PROD-SAME-SKU', name: 'Item in Org B', unitId: 'uom-1' },
      userA,
    );

    expect(itemA.sku).toBe('PROD-SAME-SKU');
    expect(itemB.sku).toBe('PROD-SAME-SKU');
    expect(itemA.organizationId).not.toBe(itemB.organizationId);
  });
});
