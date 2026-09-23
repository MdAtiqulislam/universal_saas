import { Test, TestingModule } from '@nestjs/testing';
import { FixedAssetsService } from './fixed-assets.service';
import { AssetDepreciationService } from './asset-depreciation.service';
import { AssetDisposalService } from './asset-disposal.service';
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

describe('Fixed Assets Concurrency (M22)', () => {
  let assetsService: FixedAssetsService;
  let depreciationService: AssetDepreciationService;
  let disposalService: AssetDisposalService;
  let prisma: any;

  const orgId = 'org-concurrency-test';
  const userId = 'user-worker';

  beforeEach(async () => {
    let assetStatus: FixedAssetStatus = FixedAssetStatus.DRAFT;
    let entryStatus: AssetDepreciationEntryStatus =
      AssetDepreciationEntryStatus.SCHEDULED;

    prisma = {
      fixedAsset: {
        findFirst: jest.fn().mockImplementation(() => ({
          id: 'fa-conc-1',
          organizationId: orgId,
          assetNumber: 'FA-CONC-001',
          name: 'Concurrent Asset',
          acquisitionDate: new Date('2026-08-01'),
          placedInServiceDate: new Date('2026-08-01'),
          acquisitionCost: new Prisma.Decimal(12000),
          residualValue: new Prisma.Decimal(0),
          accumulatedDepreciation: new Prisma.Decimal(0),
          netBookValue: new Prisma.Decimal(12000),
          usefulLifeMonths: 12,
          status: assetStatus,
          category: { assetAccountId: 'acc-asset' },
          assetAccountId: 'acc-asset',
          accumulatedDepreciationAccountId: 'acc-accum',
        })),
        update: jest.fn().mockImplementation(({ data }) => {
          if (data.status) {
            assetStatus = data.status;
          }
          return {
            id: 'fa-conc-1',
            organizationId: orgId,
            assetNumber: 'FA-CONC-001',
            status: assetStatus,
            acquisitionCost: new Prisma.Decimal(12000),
            accumulatedDepreciation: new Prisma.Decimal(0),
            netBookValue: new Prisma.Decimal(12000),
            category: {},
          };
        }),
      },
      assetDepreciationEntry: {
        findFirst: jest.fn().mockImplementation(() => ({
          id: 'entry-conc-1',
          organizationId: orgId,
          assetId: 'fa-conc-1',
          fiscalPeriodId: 'fp-1',
          periodEnd: new Date('2026-08-31'),
          depreciationAmount: new Prisma.Decimal(1000),
          status: entryStatus,
          fiscalPeriod: {
            id: 'fp-1',
            name: '2026-08',
            status: FiscalPeriodStatus.OPEN,
          },
          asset: {
            id: 'fa-conc-1',
            assetNumber: 'FA-CONC-001',
            name: 'Concurrent Asset',
            acquisitionCost: new Prisma.Decimal(12000),
            residualValue: new Prisma.Decimal(0),
            accumulatedDepreciation: new Prisma.Decimal(0),
            netBookValue: new Prisma.Decimal(12000),
            status: FixedAssetStatus.ACTIVE,
            category: {},
          },
        })),
        update: jest.fn().mockImplementation(({ data }) => {
          if (data.status) {
            entryStatus = data.status;
          }
          return {
            id: 'entry-conc-1',
            status: entryStatus,
            depreciationAmount: new Prisma.Decimal(1000),
          };
        }),
        updateMany: jest.fn(),
        createMany: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'fp-1',
          status: FiscalPeriodStatus.OPEN,
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      journalEntry: {
        create: jest.fn().mockResolvedValue({ id: 'je-conc-1' }),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'JE-001' }),
    };
    const accountMappingService = {
      resolveAccount: jest.fn().mockResolvedValue('acc-mapped'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FixedAssetsService,
        AssetDepreciationService,
        AssetDisposalService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: ApAccountMappingService, useValue: accountMappingService },
      ],
    }).compile();

    assetsService = module.get<FixedAssetsService>(FixedAssetsService);
    depreciationService = module.get<AssetDepreciationService>(
      AssetDepreciationService,
    );
    disposalService = module.get<AssetDisposalService>(AssetDisposalService);
  });

  it('1. should handle 100 concurrent capitalization attempts with exactly 1 success', async () => {
    let capitalizationDone = false;
    prisma.fixedAsset.findFirst.mockImplementation(() => {
      if (capitalizationDone) {
        return {
          id: 'fa-conc-1',
          organizationId: orgId,
          assetNumber: 'FA-CONC-001',
          status: FixedAssetStatus.ACTIVE,
          acquisitionDate: new Date('2026-08-01'),
          acquisitionCost: new Prisma.Decimal(12000),
          residualValue: new Prisma.Decimal(0),
          usefulLifeMonths: 12,
          category: {},
        };
      }
      capitalizationDone = true;
      return {
        id: 'fa-conc-1',
        organizationId: orgId,
        assetNumber: 'FA-CONC-001',
        name: 'Server',
        status: FixedAssetStatus.DRAFT,
        acquisitionDate: new Date('2026-08-01'),
        placedInServiceDate: new Date('2026-08-01'),
        acquisitionCost: new Prisma.Decimal(12000),
        residualValue: new Prisma.Decimal(0),
        usefulLifeMonths: 12,
        category: {},
      };
    });

    const attempts = Array.from({ length: 100 }, () =>
      assetsService
        .capitalize(orgId, 'fa-conc-1', userId)
        .then(() => ({ status: 'fulfilled' }))
        .catch((err) => ({ status: 'rejected', reason: err.message })),
    );

    const results = await Promise.all(attempts);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(99);
  });

  it('2. should handle 100 concurrent depreciation postings idempotently', async () => {
    let postingDone = false;
    prisma.assetDepreciationEntry.findFirst.mockImplementation(() => {
      if (postingDone) {
        return {
          id: 'entry-conc-1',
          organizationId: orgId,
          status: AssetDepreciationEntryStatus.POSTED,
          depreciationAmount: new Prisma.Decimal(1000),
          fiscalPeriod: { status: FiscalPeriodStatus.OPEN },
          asset: {
            id: 'fa-conc-1',
            status: FixedAssetStatus.ACTIVE,
            acquisitionCost: new Prisma.Decimal(12000),
            accumulatedDepreciation: new Prisma.Decimal(1000),
            residualValue: new Prisma.Decimal(0),
            category: {},
          },
        };
      }
      postingDone = true;
      return {
        id: 'entry-conc-1',
        organizationId: orgId,
        status: AssetDepreciationEntryStatus.SCHEDULED,
        fiscalPeriodId: 'fp-1',
        periodEnd: new Date('2026-08-31'),
        depreciationAmount: new Prisma.Decimal(1000),
        fiscalPeriod: { status: FiscalPeriodStatus.OPEN },
        asset: {
          id: 'fa-conc-1',
          status: FixedAssetStatus.ACTIVE,
          acquisitionCost: new Prisma.Decimal(12000),
          accumulatedDepreciation: new Prisma.Decimal(0),
          residualValue: new Prisma.Decimal(0),
          category: {},
        },
      };
    });

    const attempts = Array.from({ length: 100 }, () =>
      depreciationService.postEntry(orgId, 'entry-conc-1', userId),
    );

    const results = await Promise.all(attempts);

    // All 100 return the posted entry successfully (first posts, rest return idempotent)
    expect(results.length).toBe(100);
    expect(prisma.journalEntry.create).toHaveBeenCalledTimes(1);
  });

  it('3. should handle 100 concurrent disposal attempts with exactly 1 success', async () => {
    let disposalDone = false;
    prisma.fixedAsset.findFirst.mockImplementation(() => {
      if (disposalDone) {
        return {
          id: 'fa-conc-1',
          organizationId: orgId,
          status: FixedAssetStatus.DISPOSED,
          acquisitionCost: new Prisma.Decimal(12000),
          accumulatedDepreciation: new Prisma.Decimal(0),
          category: {},
        };
      }
      disposalDone = true;
      return {
        id: 'fa-conc-1',
        organizationId: orgId,
        assetNumber: 'FA-CONC-001',
        name: 'Asset',
        status: FixedAssetStatus.ACTIVE,
        acquisitionCost: new Prisma.Decimal(12000),
        accumulatedDepreciation: new Prisma.Decimal(0),
        category: {},
      };
    });

    const attempts = Array.from({ length: 100 }, () =>
      disposalService
        .dispose(
          orgId,
          'fa-conc-1',
          { disposalDate: '2026-08-20', disposalProceeds: 5000 },
          userId,
        )
        .then(() => ({ status: 'fulfilled' }))
        .catch((err) => ({ status: 'rejected', reason: err.message })),
    );

    const results = await Promise.all(attempts);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(99);
  });
});
