import { Test, TestingModule } from '@nestjs/testing';
import { AssetDepreciationService } from './asset-depreciation.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import {
  Prisma,
  FixedAssetStatus,
  FiscalPeriodStatus,
  AssetDepreciationEntryStatus,
} from '@prisma/client';

describe('AssetDepreciationService', () => {
  let service: AssetDepreciationService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;
  let accountMappingService: any;

  const orgId = 'org-asset-test';
  const userId = 'user-test';

  beforeEach(async () => {
    prisma = {
      fixedAsset: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      assetDepreciationEntry: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
      },
      journalEntry: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'JE-DEP-001' }),
    };
    accountMappingService = {
      resolveAccount: jest.fn().mockResolvedValue('acc-mapped-id'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetDepreciationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: ApAccountMappingService, useValue: accountMappingService },
      ],
    }).compile();

    service = module.get<AssetDepreciationService>(AssetDepreciationService);
  });

  describe('postEntry', () => {
    it('should post depreciation entry, create balanced journal entry and update asset balances', async () => {
      const entry = {
        id: 'entry-1',
        organizationId: orgId,
        assetId: 'fa-1',
        fiscalPeriodId: 'fp-1',
        periodEnd: new Date('2026-08-31'),
        depreciationAmount: new Prisma.Decimal(100),
        status: AssetDepreciationEntryStatus.SCHEDULED,
        fiscalPeriod: {
          id: 'fp-1',
          name: '2026-08',
          status: FiscalPeriodStatus.OPEN,
        },
        asset: {
          id: 'fa-1',
          assetNumber: 'FA-000001',
          name: 'Office Desk',
          acquisitionCost: new Prisma.Decimal(1200),
          residualValue: new Prisma.Decimal(0),
          accumulatedDepreciation: new Prisma.Decimal(0),
          status: FixedAssetStatus.ACTIVE,
          category: {},
        },
      };

      prisma.assetDepreciationEntry.findFirst.mockResolvedValue(entry);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-dep-1' });
      prisma.assetDepreciationEntry.update.mockResolvedValue({
        ...entry,
        status: AssetDepreciationEntryStatus.POSTED,
        journalEntryId: 'je-dep-1',
      });
      prisma.fixedAsset.update.mockResolvedValue({
        id: 'fa-1',
        accumulatedDepreciation: new Prisma.Decimal(100),
        netBookValue: new Prisma.Decimal(1100),
      });

      const result = await service.postEntry(orgId, 'entry-1', userId);

      expect(result.status).toBe(AssetDepreciationEntryStatus.POSTED);
      expect(prisma.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceType: 'FIXED_ASSET_DEPRECIATION',
          }),
        }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'ASSET_DEPRECIATION_POSTED' }),
      );
    });

    it('should mark asset FULLY_DEPRECIATED when netBookValue equals residualValue', async () => {
      const entry = {
        id: 'entry-final',
        organizationId: orgId,
        assetId: 'fa-1',
        fiscalPeriodId: 'fp-12',
        periodEnd: new Date('2027-07-31'),
        depreciationAmount: new Prisma.Decimal(100),
        status: AssetDepreciationEntryStatus.SCHEDULED,
        fiscalPeriod: {
          id: 'fp-12',
          name: '2027-07',
          status: FiscalPeriodStatus.OPEN,
        },
        asset: {
          id: 'fa-1',
          assetNumber: 'FA-000001',
          name: 'Office Desk',
          acquisitionCost: new Prisma.Decimal(1200),
          residualValue: new Prisma.Decimal(0),
          accumulatedDepreciation: new Prisma.Decimal(1100),
          status: FixedAssetStatus.ACTIVE,
          category: {},
        },
      };

      prisma.assetDepreciationEntry.findFirst.mockResolvedValue(entry);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-dep-12' });
      prisma.assetDepreciationEntry.update.mockResolvedValue({
        ...entry,
        status: AssetDepreciationEntryStatus.POSTED,
      });

      await service.postEntry(orgId, 'entry-final', userId);

      expect(prisma.fixedAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: FixedAssetStatus.FULLY_DEPRECIATED,
          }),
        }),
      );
    });

    it('should return existing entry if already posted (idempotent)', async () => {
      prisma.assetDepreciationEntry.findFirst.mockResolvedValue({
        id: 'entry-1',
        status: AssetDepreciationEntryStatus.POSTED,
      });

      const result = await service.postEntry(orgId, 'entry-1', userId);
      expect(result.status).toBe(AssetDepreciationEntryStatus.POSTED);
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('runDepreciation', () => {
    it('should run depreciation across eligible scheduled entries for open fiscal period', async () => {
      prisma.fiscalPeriod.findFirst.mockResolvedValue({
        id: 'fp-1',
        name: '2026-08',
        status: FiscalPeriodStatus.OPEN,
      });

      prisma.assetDepreciationEntry.findMany.mockResolvedValue([
        { id: 'entry-1' },
        { id: 'entry-2' },
      ]);

      const entryMock = {
        id: 'entry-1',
        organizationId: orgId,
        fiscalPeriodId: 'fp-1',
        periodEnd: new Date('2026-08-31'),
        depreciationAmount: new Prisma.Decimal(150),
        status: AssetDepreciationEntryStatus.SCHEDULED,
        fiscalPeriod: {
          id: 'fp-1',
          name: '2026-08',
          status: FiscalPeriodStatus.OPEN,
        },
        asset: {
          id: 'fa-1',
          assetNumber: 'FA-1',
          name: 'Asset 1',
          acquisitionCost: new Prisma.Decimal(1800),
          residualValue: new Prisma.Decimal(0),
          accumulatedDepreciation: new Prisma.Decimal(0),
          status: FixedAssetStatus.ACTIVE,
          category: {},
        },
      };

      prisma.assetDepreciationEntry.findFirst.mockResolvedValue(entryMock);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-run-1' });
      prisma.assetDepreciationEntry.update.mockResolvedValue({
        ...entryMock,
        status: AssetDepreciationEntryStatus.POSTED,
      });

      const result = await service.runDepreciation(
        orgId,
        { fiscalPeriodId: 'fp-1' },
        userId,
      );

      expect(result.processedCount).toBe(2);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'ASSET_DEPRECIATION_CALCULATED' }),
      );
    });
  });
});
