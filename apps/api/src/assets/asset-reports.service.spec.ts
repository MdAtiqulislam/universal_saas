import { Test, TestingModule } from '@nestjs/testing';
import { AssetReportsService } from './asset-reports.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  FixedAssetStatus,
  AssetDepreciationEntryStatus,
} from '@prisma/client';

describe('AssetReportsService', () => {
  let service: AssetReportsService;
  let prisma: any;

  const orgId = 'org-asset-test';

  beforeEach(async () => {
    prisma = {
      fixedAsset: {
        findMany: jest.fn(),
      },
      assetDepreciationEntry: {
        findMany: jest.fn(),
      },
      assetTransferHistory: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AssetReportsService>(AssetReportsService);
  });

  it('should generate fixed asset register report with exact summary calculations', async () => {
    prisma.fixedAsset.findMany.mockResolvedValue([
      {
        id: 'fa-1',
        assetNumber: 'FA-001',
        name: 'Desk',
        category: { name: 'Furniture' },
        location: { name: 'HQ' },
        acquisitionDate: new Date('2026-08-01'),
        placedInServiceDate: new Date('2026-08-01'),
        acquisitionCost: new Prisma.Decimal(500),
        residualValue: new Prisma.Decimal(0),
        accumulatedDepreciation: new Prisma.Decimal(50),
        netBookValue: new Prisma.Decimal(450),
        status: FixedAssetStatus.ACTIVE,
      },
      {
        id: 'fa-2',
        assetNumber: 'FA-002',
        name: 'Laptop',
        category: { name: 'IT' },
        location: null,
        acquisitionDate: new Date('2026-08-01'),
        placedInServiceDate: new Date('2026-08-01'),
        acquisitionCost: new Prisma.Decimal(1500),
        residualValue: new Prisma.Decimal(150),
        accumulatedDepreciation: new Prisma.Decimal(100),
        netBookValue: new Prisma.Decimal(1400),
        status: FixedAssetStatus.ACTIVE,
      },
    ]);

    const res = await service.getRegister(orgId, {});

    expect(res.totalAssets).toBe(2);
    expect(res.summary.totalAcquisitionCost).toBe('2000.0000');
    expect(res.summary.totalAccumulatedDepreciation).toBe('150.0000');
    expect(res.summary.totalNetBookValue).toBe('1850.0000');
  });

  it('should generate periodic depreciation report with category breakdown', async () => {
    prisma.assetDepreciationEntry.findMany.mockResolvedValue([
      {
        id: 'e-1',
        fiscalPeriod: { name: '2026-08' },
        periodStart: new Date('2026-08-01'),
        periodEnd: new Date('2026-08-31'),
        openingBookValue: new Prisma.Decimal(500),
        depreciationAmount: new Prisma.Decimal(50),
        accumulatedDepreciation: new Prisma.Decimal(50),
        closingBookValue: new Prisma.Decimal(450),
        status: AssetDepreciationEntryStatus.POSTED,
        asset: {
          assetNumber: 'FA-001',
          name: 'Desk',
          category: { name: 'Furniture' },
        },
      },
      {
        id: 'e-2',
        fiscalPeriod: { name: '2026-08' },
        periodStart: new Date('2026-08-01'),
        periodEnd: new Date('2026-08-31'),
        openingBookValue: new Prisma.Decimal(1500),
        depreciationAmount: new Prisma.Decimal(100),
        accumulatedDepreciation: new Prisma.Decimal(100),
        closingBookValue: new Prisma.Decimal(1400),
        status: AssetDepreciationEntryStatus.POSTED,
        asset: {
          assetNumber: 'FA-002',
          name: 'Laptop',
          category: { name: 'IT' },
        },
      },
    ]);

    const res = await service.getDepreciationReport(orgId, {});

    expect(res.totalEntries).toBe(2);
    expect(res.totalDepreciation).toBe('150.0000');
    expect(res.categoryBreakdown.length).toBe(2);
  });

  it('should generate asset movements report', async () => {
    prisma.fixedAsset.findMany
      .mockResolvedValueOnce([
        {
          assetNumber: 'FA-001',
          name: 'Desk',
          category: { name: 'Furniture' },
          acquisitionCost: new Prisma.Decimal(500),
          acquisitionDate: new Date('2026-08-01'),
        },
      ])
      .mockResolvedValueOnce([
        {
          assetNumber: 'FA-OLD',
          name: 'Old Server',
          category: { name: 'IT' },
          disposalProceeds: new Prisma.Decimal(50),
          disposalGainLoss: new Prisma.Decimal(-200),
          disposedAt: new Date('2026-08-15'),
        },
      ]);

    prisma.assetTransferHistory.findMany.mockResolvedValue([
      {
        asset: { assetNumber: 'FA-001', name: 'Desk' },
        fromLocation: { name: 'HQ' },
        toLocation: { name: 'Branch' },
        transferDate: new Date('2026-08-10'),
        reason: 'Office Move',
      },
    ]);

    const res = await service.getMovementsReport(orgId, {});

    expect(res.acquisitions.length).toBe(1);
    expect(res.transfers.length).toBe(1);
    expect(res.disposals.length).toBe(1);
  });

  it('should generate GL reconciliation report', async () => {
    prisma.fixedAsset.findMany.mockResolvedValue([
      {
        acquisitionCost: new Prisma.Decimal(1000),
        accumulatedDepreciation: new Prisma.Decimal(200),
        netBookValue: new Prisma.Decimal(800),
      },
    ]);

    const res = await service.getReconciliation(orgId);

    expect(res.subLedger.totalAssets).toBe(1);
    expect(res.subLedger.totalAcquisitionCost).toBe('1000.0000');
    expect(res.subLedger.totalAccumulatedDepreciation).toBe('200.0000');
    expect(res.subLedger.totalNetBookValue).toBe('800.0000');
    expect(res.status).toBe('RECONCILED');
  });
});
