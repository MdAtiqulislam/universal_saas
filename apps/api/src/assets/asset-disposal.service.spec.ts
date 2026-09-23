import { Test, TestingModule } from '@nestjs/testing';
import { AssetDisposalService } from './asset-disposal.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { BadRequestException } from '@nestjs/common';
import { Prisma, FixedAssetStatus, FiscalPeriodStatus } from '@prisma/client';

describe('AssetDisposalService', () => {
  let service: AssetDisposalService;
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
      fiscalPeriod: {
        findFirst: jest.fn(),
      },
      paymentAccount: {
        findFirst: jest.fn(),
      },
      journalEntry: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      assetDepreciationEntry: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'JE-DISP-001' }),
    };
    accountMappingService = {
      resolveAccount: jest.fn().mockImplementation((_orgId, key) => {
        return `acc-${key.toLowerCase()}`;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetDisposalService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: ApAccountMappingService, useValue: accountMappingService },
      ],
    }).compile();

    service = module.get<AssetDisposalService>(AssetDisposalService);
  });

  describe('dispose', () => {
    it('should dispose asset with GAIN on disposal when proceeds exceed NBV', async () => {
      // Cost: 1000, Accumulated: 600, NBV: 400. Proceeds: 500 => Gain: 100
      const asset = {
        id: 'fa-1',
        organizationId: orgId,
        assetNumber: 'FA-000001',
        name: 'Company Van',
        acquisitionCost: new Prisma.Decimal(1000),
        accumulatedDepreciation: new Prisma.Decimal(600),
        netBookValue: new Prisma.Decimal(400),
        status: FixedAssetStatus.ACTIVE,
        assetAccountId: 'acc-van-asset',
        accumulatedDepreciationAccountId: 'acc-van-accum',
        category: {},
      };

      prisma.fixedAsset.findFirst.mockResolvedValue(asset);
      prisma.fiscalPeriod.findFirst.mockResolvedValue({
        id: 'fp-1',
        status: FiscalPeriodStatus.OPEN,
      });
      prisma.paymentAccount.findFirst.mockResolvedValue({
        id: 'pay-acc-1',
        accountingAccountId: 'acc-bank',
      });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-disp-1' });
      prisma.fixedAsset.update.mockResolvedValue({
        ...asset,
        status: FixedAssetStatus.DISPOSED,
        disposalProceeds: new Prisma.Decimal(500),
        disposalGainLoss: new Prisma.Decimal(100),
        disposalJournalEntryId: 'je-disp-1',
      });

      const result = await service.dispose(
        orgId,
        'fa-1',
        {
          disposalDate: '2026-08-20',
          disposalProceeds: 500,
          proceedsPaymentAccountId: 'pay-acc-1',
          disposalReason: 'Sold to third party',
        },
        userId,
      );

      expect(result.status).toBe(FixedAssetStatus.DISPOSED);
      expect(prisma.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceType: 'FIXED_ASSET_DISPOSAL',
            lines: {
              create: expect.arrayContaining([
                expect.objectContaining({
                  accountId: 'acc-van-accum',
                  debit: new Prisma.Decimal(600),
                }),
                expect.objectContaining({
                  accountId: 'acc-bank',
                  debit: new Prisma.Decimal(500),
                }),
                expect.objectContaining({
                  accountId: 'acc-asset_disposal_gain',
                  credit: new Prisma.Decimal(100),
                }),
                expect.objectContaining({
                  accountId: 'acc-van-asset',
                  credit: new Prisma.Decimal(1000),
                }),
              ]),
            },
          }),
        }),
      );
      expect(prisma.assetDepreciationEntry.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'VOIDED' },
        }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'ASSET_DISPOSED' }),
      );
    });

    it('should dispose asset with LOSS on disposal when proceeds are less than NBV', async () => {
      // Cost: 1000, Accumulated: 400, NBV: 600. Proceeds: 200 => Loss: -400
      const asset = {
        id: 'fa-2',
        organizationId: orgId,
        assetNumber: 'FA-000002',
        name: 'Damaged Machine',
        acquisitionCost: new Prisma.Decimal(1000),
        accumulatedDepreciation: new Prisma.Decimal(400),
        netBookValue: new Prisma.Decimal(600),
        status: FixedAssetStatus.ACTIVE,
        assetAccountId: 'acc-mach-asset',
        accumulatedDepreciationAccountId: 'acc-mach-accum',
        category: {},
      };

      prisma.fixedAsset.findFirst.mockResolvedValue(asset);
      prisma.fiscalPeriod.findFirst.mockResolvedValue({
        id: 'fp-1',
        status: FiscalPeriodStatus.OPEN,
      });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-disp-2' });
      prisma.fixedAsset.update.mockResolvedValue({
        ...asset,
        status: FixedAssetStatus.DISPOSED,
        disposalProceeds: new Prisma.Decimal(200),
        disposalGainLoss: new Prisma.Decimal(-400),
      });

      const result = await service.dispose(
        orgId,
        'fa-2',
        {
          disposalDate: '2026-08-20',
          disposalProceeds: 200,
          disposalReason: 'Scrapped for parts',
        },
        userId,
      );

      expect(result.status).toBe(FixedAssetStatus.DISPOSED);
      expect(prisma.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lines: {
              create: expect.arrayContaining([
                expect.objectContaining({
                  accountId: 'acc-asset_disposal_loss',
                  debit: new Prisma.Decimal(400),
                }),
              ]),
            },
          }),
        }),
      );
    });

    it('should reject disposal of DRAFT asset', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue({
        id: 'fa-draft',
        status: FixedAssetStatus.DRAFT,
        category: {},
      });

      await expect(
        service.dispose(
          orgId,
          'fa-draft',
          { disposalDate: '2026-08-20' },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
