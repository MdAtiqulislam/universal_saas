import { Test, TestingModule } from '@nestjs/testing';
import { FixedAssetsService } from './fixed-assets.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { BadRequestException } from '@nestjs/common';
import { Prisma, FixedAssetStatus, FiscalPeriodStatus } from '@prisma/client';

describe('FixedAssetsService', () => {
  let service: FixedAssetsService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;
  let accountMappingService: any;

  const orgId = 'org-asset-test';
  const userId = 'user-test';

  beforeEach(async () => {
    prisma = {
      assetCategory: {
        findFirst: jest.fn(),
      },
      currency: {
        findFirst: jest.fn(),
      },
      location: {
        findFirst: jest.fn(),
      },
      supplier: {
        findFirst: jest.fn(),
      },
      purchaseOrder: {
        findFirst: jest.fn(),
      },
      goodsReceipt: {
        findFirst: jest.fn(),
      },
      supplierInvoice: {
        findFirst: jest.fn(),
      },
      fixedAsset: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      journalEntry: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      assetDepreciationEntry: {
        createMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn(),
      },
      assetTransferHistory: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'FA-000001' }),
    };
    accountMappingService = {
      resolveAccount: jest.fn().mockResolvedValue('acc-mapped-id'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FixedAssetsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: ApAccountMappingService, useValue: accountMappingService },
      ],
    }).compile();

    service = module.get<FixedAssetsService>(FixedAssetsService);
  });

  describe('create', () => {
    it('should create fixed asset in DRAFT status with exact Decimal precision', async () => {
      prisma.assetCategory.findFirst.mockResolvedValue({
        id: 'cat-1',
        defaultUsefulLifeMonths: 36,
        defaultResidualValuePercent: new Prisma.Decimal(0),
        assetAccountId: 'acc-asset',
        accumulatedDepreciationAccountId: 'acc-accum',
        depreciationExpenseAccountId: 'acc-exp',
      });
      prisma.currency.findFirst.mockResolvedValue({ id: 'cur-usd' });
      prisma.fixedAsset.findFirst.mockResolvedValue(null);
      prisma.fixedAsset.create.mockResolvedValue({
        id: 'fa-1',
        organizationId: orgId,
        assetNumber: 'FA-000001',
        name: 'MacBook Pro',
        acquisitionCost: new Prisma.Decimal(2500),
        residualValue: new Prisma.Decimal(250),
        netBookValue: new Prisma.Decimal(2500),
        status: FixedAssetStatus.DRAFT,
      });

      const result = await service.create(
        orgId,
        {
          name: 'MacBook Pro',
          categoryId: 'cat-1',
          currencyId: 'cur-usd',
          acquisitionDate: '2026-08-01',
          acquisitionCost: 2500,
          residualValue: 250,
        },
        userId,
      );

      expect(result.status).toBe(FixedAssetStatus.DRAFT);
      expect(result.netBookValue).toEqual(new Prisma.Decimal(2500));
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'ASSET_CREATED' }),
      );
    });

    it('should reject non-positive acquisition cost', async () => {
      prisma.assetCategory.findFirst.mockResolvedValue({ id: 'cat-1' });
      prisma.currency.findFirst.mockResolvedValue({ id: 'cur-usd' });

      await expect(
        service.create(
          orgId,
          {
            name: 'Invalid Cost Asset',
            categoryId: 'cat-1',
            currencyId: 'cur-usd',
            acquisitionDate: '2026-08-01',
            acquisitionCost: 0,
          },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject residual value exceeding acquisition cost', async () => {
      prisma.assetCategory.findFirst.mockResolvedValue({
        id: 'cat-1',
        defaultUsefulLifeMonths: 12,
        defaultResidualValuePercent: new Prisma.Decimal(0),
      });
      prisma.currency.findFirst.mockResolvedValue({ id: 'cur-usd' });

      await expect(
        service.create(
          orgId,
          {
            name: 'Invalid Residual Asset',
            categoryId: 'cat-1',
            currencyId: 'cur-usd',
            acquisitionDate: '2026-08-01',
            acquisitionCost: 1000,
            residualValue: 1200,
          },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('capitalize', () => {
    it('should capitalize asset, create balanced GL entry and generate depreciation schedule', async () => {
      const asset = {
        id: 'fa-1',
        organizationId: orgId,
        assetNumber: 'FA-000001',
        name: 'Server Rack',
        acquisitionDate: new Date('2026-08-01'),
        placedInServiceDate: new Date('2026-08-01'),
        acquisitionCost: new Prisma.Decimal(12000),
        residualValue: new Prisma.Decimal(0),
        usefulLifeMonths: 12,
        status: FixedAssetStatus.DRAFT,
        category: {
          assetAccountId: 'acc-asset-gl',
        },
      };

      prisma.fixedAsset.findFirst.mockResolvedValue(asset);
      prisma.fiscalPeriod.findFirst.mockResolvedValue({
        id: 'fp-1',
        status: FiscalPeriodStatus.OPEN,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-31'),
      });
      prisma.fiscalPeriod.findMany.mockResolvedValue([
        {
          id: 'fp-1',
          startDate: new Date('2026-08-01'),
          endDate: new Date('2026-08-31'),
        },
      ]);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-cap-1' });
      prisma.fixedAsset.update.mockResolvedValue({
        ...asset,
        status: FixedAssetStatus.ACTIVE,
        capitalizationJournalEntryId: 'je-cap-1',
      });

      const result = await service.capitalize(orgId, 'fa-1', userId);

      expect(result.status).toBe(FixedAssetStatus.ACTIVE);
      expect(prisma.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceType: 'FIXED_ASSET_CAPITALIZATION',
          }),
        }),
      );
      expect(prisma.assetDepreciationEntry.createMany).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'ASSET_CAPITALIZED' }),
      );
    });

    it('should reject capitalization if fiscal period is closed', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue({
        id: 'fa-1',
        status: FixedAssetStatus.DRAFT,
        acquisitionDate: new Date('2026-08-01'),
        category: {},
      });
      prisma.fiscalPeriod.findFirst.mockResolvedValue(null);

      await expect(service.capitalize(orgId, 'fa-1', userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('transfer', () => {
    it('should transfer asset location and create audit history', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue({
        id: 'fa-1',
        organizationId: orgId,
        assetNumber: 'FA-000001',
        locationId: 'loc-warehouse',
        status: FixedAssetStatus.ACTIVE,
        category: {},
      });
      prisma.location.findFirst.mockResolvedValue({
        id: 'loc-branch',
        name: 'Branch Office',
      });
      prisma.assetTransferHistory.create.mockResolvedValue({ id: 'trans-1' });
      prisma.fixedAsset.update.mockResolvedValue({
        id: 'fa-1',
        locationId: 'loc-branch',
        status: FixedAssetStatus.ACTIVE,
      });

      const result = await service.transfer(
        orgId,
        'fa-1',
        {
          toLocationId: 'loc-branch',
          transferDate: '2026-08-15',
          reason: 'Office Relocation',
        },
        userId,
      );

      expect(result.asset.locationId).toBe('loc-branch');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'ASSET_TRANSFERRED' }),
      );
    });
  });

  describe('void', () => {
    it('should void capitalized asset and reverse journal entry', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue({
        id: 'fa-1',
        organizationId: orgId,
        assetNumber: 'FA-000001',
        name: 'Laptop',
        acquisitionCost: new Prisma.Decimal(1000),
        status: FixedAssetStatus.CAPITALIZED,
        assetAccountId: 'acc-asset',
        category: {},
      });
      prisma.assetDepreciationEntry.count.mockResolvedValue(0); // 0 posted depreciation
      prisma.fiscalPeriod.findFirst.mockResolvedValue({
        id: 'fp-1',
        status: FiscalPeriodStatus.OPEN,
      });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-rev-1' });
      prisma.fixedAsset.update.mockResolvedValue({
        id: 'fa-1',
        status: FixedAssetStatus.VOIDED,
      });

      const result = await service.void(orgId, 'fa-1', userId);

      expect(result.status).toBe(FixedAssetStatus.VOIDED);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'ASSET_VOIDED' }),
      );
    });

    it('should prevent voiding asset with posted depreciation entries', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue({
        id: 'fa-1',
        status: FixedAssetStatus.ACTIVE,
        category: {},
      });
      prisma.assetDepreciationEntry.count.mockResolvedValue(2); // 2 posted entries

      await expect(service.void(orgId, 'fa-1', userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
