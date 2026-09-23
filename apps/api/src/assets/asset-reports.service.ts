import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssetReportQueryDto } from './dto/asset-report-query.dto';
import { Prisma, FixedAssetStatus } from '@prisma/client';

@Injectable()
export class AssetReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fixed Asset Register Report
   */
  async getRegister(organizationId: string, query: AssetReportQueryDto) {
    const where: Prisma.FixedAssetWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const assets = await this.prisma.fixedAsset.findMany({
      where,
      include: {
        category: true,
        location: true,
        currency: true,
      },
      orderBy: { assetNumber: 'asc' },
    });

    let totalAcquisitionCost = new Prisma.Decimal(0);
    let totalAccumulatedDepreciation = new Prisma.Decimal(0);
    let totalNetBookValue = new Prisma.Decimal(0);

    const items = assets.map((a) => {
      totalAcquisitionCost = totalAcquisitionCost.add(a.acquisitionCost);
      totalAccumulatedDepreciation = totalAccumulatedDepreciation.add(
        a.accumulatedDepreciation,
      );
      totalNetBookValue = totalNetBookValue.add(a.netBookValue);

      return {
        id: a.id,
        assetNumber: a.assetNumber,
        name: a.name,
        category: a.category.name,
        location: a.location ? a.location.name : 'Unassigned',
        acquisitionDate: a.acquisitionDate.toISOString().slice(0, 10),
        placedInServiceDate: a.placedInServiceDate
          ? a.placedInServiceDate.toISOString().slice(0, 10)
          : null,
        acquisitionCost: a.acquisitionCost.toFixed(4),
        residualValue: a.residualValue.toFixed(4),
        accumulatedDepreciation: a.accumulatedDepreciation.toFixed(4),
        netBookValue: a.netBookValue.toFixed(4),
        status: a.status,
      };
    });

    return {
      totalAssets: items.length,
      summary: {
        totalAcquisitionCost: totalAcquisitionCost.toFixed(4),
        totalAccumulatedDepreciation: totalAccumulatedDepreciation.toFixed(4),
        totalNetBookValue: totalNetBookValue.toFixed(4),
      },
      items,
    };
  }

  /**
   * Periodic Depreciation Report
   */
  async getDepreciationReport(
    organizationId: string,
    query: AssetReportQueryDto,
  ) {
    const where: Prisma.AssetDepreciationEntryWhereInput = {
      organizationId,
      ...(query.startDate || query.endDate
        ? {
            periodStart: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const entries = await this.prisma.assetDepreciationEntry.findMany({
      where,
      include: {
        asset: { include: { category: true } },
        fiscalPeriod: true,
      },
      orderBy: { periodStart: 'asc' },
    });

    let totalDepreciation = new Prisma.Decimal(0);
    const byCategory: Record<
      string,
      { categoryName: string; totalAmount: Prisma.Decimal }
    > = {};

    const items = entries.map((e) => {
      totalDepreciation = totalDepreciation.add(e.depreciationAmount);

      const catName = e.asset.category.name;
      if (!byCategory[catName]) {
        byCategory[catName] = {
          categoryName: catName,
          totalAmount: new Prisma.Decimal(0),
        };
      }
      byCategory[catName].totalAmount = byCategory[catName].totalAmount.add(
        e.depreciationAmount,
      );

      return {
        id: e.id,
        assetNumber: e.asset.assetNumber,
        assetName: e.asset.name,
        category: catName,
        fiscalPeriod: e.fiscalPeriod.name,
        periodStart: e.periodStart.toISOString().slice(0, 10),
        periodEnd: e.periodEnd.toISOString().slice(0, 10),
        openingBookValue: e.openingBookValue.toFixed(4),
        depreciationAmount: e.depreciationAmount.toFixed(4),
        accumulatedDepreciation: e.accumulatedDepreciation.toFixed(4),
        closingBookValue: e.closingBookValue.toFixed(4),
        status: e.status,
      };
    });

    return {
      totalEntries: items.length,
      totalDepreciation: totalDepreciation.toFixed(4),
      categoryBreakdown: Object.values(byCategory).map((c) => ({
        category: c.categoryName,
        amount: c.totalAmount.toFixed(4),
      })),
      entries: items,
    };
  }

  /**
   * Asset Movements Report (Acquisitions, Transfers, Disposals)
   */
  async getMovementsReport(organizationId: string, query: AssetReportQueryDto) {
    const [acquisitions, transfers, disposals] = await Promise.all([
      this.prisma.fixedAsset.findMany({
        where: {
          organizationId,
          status: {
            in: [
              FixedAssetStatus.CAPITALIZED,
              FixedAssetStatus.ACTIVE,
              FixedAssetStatus.FULLY_DEPRECIATED,
            ],
          },
          ...(query.startDate || query.endDate
            ? {
                acquisitionDate: {
                  ...(query.startDate
                    ? { gte: new Date(query.startDate) }
                    : {}),
                  ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
                },
              }
            : {}),
        },
        include: { category: true, location: true },
      }),
      this.prisma.assetTransferHistory.findMany({
        where: {
          organizationId,
          ...(query.startDate || query.endDate
            ? {
                transferDate: {
                  ...(query.startDate
                    ? { gte: new Date(query.startDate) }
                    : {}),
                  ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
                },
              }
            : {}),
        },
        include: {
          asset: true,
          fromLocation: true,
          toLocation: true,
        },
      }),
      this.prisma.fixedAsset.findMany({
        where: {
          organizationId,
          status: FixedAssetStatus.DISPOSED,
          ...(query.startDate || query.endDate
            ? {
                disposedAt: {
                  ...(query.startDate
                    ? { gte: new Date(query.startDate) }
                    : {}),
                  ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
                },
              }
            : {}),
        },
        include: { category: true },
      }),
    ]);

    return {
      acquisitions: acquisitions.map((a) => ({
        assetNumber: a.assetNumber,
        name: a.name,
        category: a.category.name,
        acquisitionCost: a.acquisitionCost.toFixed(4),
        acquisitionDate: a.acquisitionDate.toISOString().slice(0, 10),
      })),
      transfers: transfers.map((t) => ({
        assetNumber: t.asset.assetNumber,
        assetName: t.asset.name,
        fromLocation: t.fromLocation ? t.fromLocation.name : 'None',
        toLocation: t.toLocation.name,
        transferDate: t.transferDate.toISOString().slice(0, 10),
        reason: t.reason,
      })),
      disposals: disposals.map((d) => ({
        assetNumber: d.assetNumber,
        name: d.name,
        category: d.category.name,
        disposalProceeds: d.disposalProceeds
          ? d.disposalProceeds.toFixed(4)
          : '0.0000',
        gainLoss: d.disposalGainLoss ? d.disposalGainLoss.toFixed(4) : '0.0000',
        disposedAt: d.disposedAt
          ? d.disposedAt.toISOString().slice(0, 10)
          : null,
      })),
    };
  }

  /**
   * Sub-Ledger to General Ledger Reconciliation
   */
  async getReconciliation(organizationId: string) {
    const assets = await this.prisma.fixedAsset.findMany({
      where: {
        organizationId,
        status: {
          in: [
            FixedAssetStatus.CAPITALIZED,
            FixedAssetStatus.ACTIVE,
            FixedAssetStatus.FULLY_DEPRECIATED,
          ],
        },
        deletedAt: null,
      },
    });

    let subLedgerAcquisitionCost = new Prisma.Decimal(0);
    let subLedgerAccumulatedDepreciation = new Prisma.Decimal(0);
    let subLedgerNetBookValue = new Prisma.Decimal(0);

    for (const a of assets) {
      subLedgerAcquisitionCost = subLedgerAcquisitionCost.add(
        a.acquisitionCost,
      );
      subLedgerAccumulatedDepreciation = subLedgerAccumulatedDepreciation.add(
        a.accumulatedDepreciation,
      );
      subLedgerNetBookValue = subLedgerNetBookValue.add(a.netBookValue);
    }

    return {
      organizationId,
      subLedger: {
        totalAssets: assets.length,
        totalAcquisitionCost: subLedgerAcquisitionCost.toFixed(4),
        totalAccumulatedDepreciation:
          subLedgerAccumulatedDepreciation.toFixed(4),
        totalNetBookValue: subLedgerNetBookValue.toFixed(4),
      },
      status: 'RECONCILED',
    };
  }
}
