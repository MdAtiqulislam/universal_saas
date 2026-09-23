import { Test, TestingModule } from '@nestjs/testing';
import { AssetCategoriesService } from './asset-categories.service';
import { FixedAssetsService } from './fixed-assets.service';
import { AssetDepreciationService } from './asset-depreciation.service';
import { AssetDisposalService } from './asset-disposal.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { NotFoundException } from '@nestjs/common';

describe('Tenant Isolation — Fixed Assets & Depreciation (M22)', () => {
  let categoriesService: AssetCategoriesService;
  let assetsService: FixedAssetsService;
  let depreciationService: AssetDepreciationService;
  let disposalService: AssetDisposalService;
  let prisma: any;

  const orgA = 'org-tenant-a';
  const orgB = 'org-tenant-b';
  const userA = 'user-a';

  beforeEach(async () => {
    prisma = {
      assetCategory: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      fixedAsset: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      assetDepreciationEntry: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      currency: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cur-usd' }),
      },
      location: {
        findFirst: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
      },
      account: {
        findMany: jest.fn(),
      },
      paymentAccount: {
        findFirst: jest.fn(),
      },
      journalEntry: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'FA-001' }),
    };
    const accountMappingService = {
      resolveAccount: jest.fn().mockResolvedValue('acc-mapped'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetCategoriesService,
        FixedAssetsService,
        AssetDepreciationService,
        AssetDisposalService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: ApAccountMappingService, useValue: accountMappingService },
      ],
    }).compile();

    categoriesService = module.get<AssetCategoriesService>(
      AssetCategoriesService,
    );
    assetsService = module.get<FixedAssetsService>(FixedAssetsService);
    depreciationService = module.get<AssetDepreciationService>(
      AssetDepreciationService,
    );
    disposalService = module.get<AssetDisposalService>(AssetDisposalService);
  });

  it('1. Org A cannot read Org B asset categories', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue(null);
    await expect(
      categoriesService.findOne(orgA, `cat-${orgB}`),
    ).rejects.toThrow(NotFoundException);
  });

  it('2. Org A cannot update Org B asset categories', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue(null);
    await expect(
      categoriesService.update(orgA, `cat-${orgB}`, { name: 'Hacked' }, userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('3. Org A cannot delete Org B asset categories', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue(null);
    await expect(categoriesService.delete(orgA, `cat-${orgB}`)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('4. Org A cannot read Org B fixed assets', async () => {
    prisma.fixedAsset.findFirst.mockResolvedValue(null);
    await expect(assetsService.findOne(orgA, `fa-${orgB}`)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('5. Org A cannot update Org B fixed assets', async () => {
    prisma.fixedAsset.findFirst.mockResolvedValue(null);
    await expect(
      assetsService.update(orgA, `fa-${orgB}`, { name: 'Hacked' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('6. Org A cannot create asset referencing Org B category', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue(null); // Category not found for Org A
    await expect(
      assetsService.create(
        orgA,
        {
          name: 'Laptop',
          categoryId: `cat-${orgB}`,
          currencyId: 'cur-usd',
          acquisitionDate: '2026-08-01',
          acquisitionCost: 1000,
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('7. Org A cannot create asset referencing Org B location', async () => {
    prisma.assetCategory.findFirst.mockResolvedValue({
      id: 'cat-a',
      defaultUsefulLifeMonths: 36,
      defaultResidualValuePercent: 0,
    });
    prisma.location.findFirst.mockResolvedValue(null); // Location not found for Org A

    await expect(
      assetsService.create(
        orgA,
        {
          name: 'Laptop',
          categoryId: 'cat-a',
          locationId: `loc-${orgB}`,
          currencyId: 'cur-usd',
          acquisitionDate: '2026-08-01',
          acquisitionCost: 1000,
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('8. Org A cannot capitalize Org B assets', async () => {
    prisma.fixedAsset.findFirst.mockResolvedValue(null);
    await expect(
      assetsService.capitalize(orgA, `fa-${orgB}`, userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('9. Org A cannot post depreciation for Org B assets', async () => {
    prisma.assetDepreciationEntry.findFirst.mockResolvedValue(null);
    await expect(
      depreciationService.postEntry(orgA, `entry-${orgB}`, userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('10. Org A cannot dispose Org B assets', async () => {
    prisma.fixedAsset.findFirst.mockResolvedValue(null);
    await expect(
      disposalService.dispose(
        orgA,
        `fa-${orgB}`,
        { disposalDate: '2026-08-20' },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
