import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WarehouseReportsQueryDto } from './dto/warehouse-reports-query.dto';
import {
  Prisma,
  WarehouseTaskStatus,
  PickTaskStatus,
  QuarantineStatus,
} from '@prisma/client';

@Injectable()
export class WarehouseReportsService {
  private readonly logger = new Logger(WarehouseReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Stock by Location
   */
  async getStockByLocation(
    organizationId: string,
    query: WarehouseReportsQueryDto,
  ) {
    const balances = await this.prisma.inventoryBalance.findMany({
      where: {
        organizationId,
        ...(query.warehouseId
          ? {
              location: {
                OR: [
                  { id: query.warehouseId },
                  { parentId: query.warehouseId },
                ],
              },
            }
          : {}),
      },
      include: {
        location: {
          select: { id: true, code: true, name: true, locationType: true },
        },
        item: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true } },
      },
      orderBy: [{ location: { code: 'asc' } }, { item: { sku: 'asc' } }],
    });

    return balances.map((b) => ({
      locationId: b.locationId,
      locationCode: b.location.code,
      locationName: b.location.name,
      locationType: b.location.locationType,
      itemId: b.itemId,
      itemSku: b.item.sku,
      itemName: b.item.name,
      variantId: b.variantId,
      variantSku: b.variant?.sku ?? null,
      onHand: b.quantityOnHand.toString(),
      reserved: b.quantityReserved.toString(),
    }));
  }

  /**
   * 2. Location Occupancy
   */
  async getLocationOccupancy(
    organizationId: string,
    query: WarehouseReportsQueryDto,
  ) {
    const locations = await this.prisma.location.findMany({
      where: {
        organizationId,
        ...(query.warehouseId
          ? { OR: [{ id: query.warehouseId }, { parentId: query.warehouseId }] }
          : {}),
      },
      include: {
        inventoryBalances: true,
        warehouseZones: true,
      },
    });

    return locations.map((loc) => {
      const distinctSkus = new Set(loc.inventoryBalances.map((b) => b.itemId))
        .size;
      const totalUnits = loc.inventoryBalances.reduce(
        (acc, b) => acc.plus(b.quantityOnHand),
        new Prisma.Decimal(0),
      );

      return {
        locationId: loc.id,
        locationCode: loc.code,
        locationName: loc.name,
        locationType: loc.locationType,
        zoneCount: loc.warehouseZones.length,
        distinctSkus,
        totalUnitsOnHand: totalUnits.toString(),
        isOccupied: totalUnits.gt(0),
      };
    });
  }

  /**
   * 3. Task Performance
   */
  async getTaskPerformance(
    organizationId: string,
    query: WarehouseReportsQueryDto,
  ) {
    const [tasks, putaways, picks] = await Promise.all([
      this.prisma.warehouseTask.findMany({
        where: {
          organizationId,
          ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        },
      }),
      this.prisma.putawayTask.findMany({
        where: {
          organizationId,
          ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        },
      }),
      this.prisma.pickTask.findMany({
        where: {
          organizationId,
          ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        },
      }),
    ]);

    const totalPutaways = putaways.length;
    const completedPutaways = putaways.filter(
      (p) => p.status === WarehouseTaskStatus.COMPLETED,
    ).length;

    const totalPicks = picks.length;
    const completedPicks = picks.filter(
      (p) => p.status === PickTaskStatus.PICKED,
    ).length;

    return {
      totalWarehouseTasks: tasks.length,
      completedWarehouseTasks: tasks.filter(
        (t) => t.status === WarehouseTaskStatus.COMPLETED,
      ).length,
      putawayMetrics: {
        total: totalPutaways,
        completed: completedPutaways,
        completionRate:
          totalPutaways > 0 ? (completedPutaways / totalPutaways) * 100 : 100,
      },
      pickingMetrics: {
        total: totalPicks,
        completed: completedPicks,
        completionRate:
          totalPicks > 0 ? (completedPicks / totalPicks) * 100 : 100,
      },
    };
  }

  /**
   * 4. Count Variances
   */
  async getCountVariances(
    organizationId: string,
    query: WarehouseReportsQueryDto,
  ) {
    const lines = await this.prisma.cycleCountLine.findMany({
      where: {
        organizationId,
        cycleCount: query.warehouseId
          ? { warehouseId: query.warehouseId }
          : undefined,
      },
      include: {
        cycleCount: { select: { id: true, countNumber: true, status: true } },
        item: { select: { id: true, sku: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
      },
    });

    let totalGains = new Prisma.Decimal(0);
    let totalShrinkage = new Prisma.Decimal(0);
    let totalLinesWithVariance = 0;

    const discrepancyLines = lines.map((l) => {
      const v = l.varianceQuantity || new Prisma.Decimal(0);
      if (v.gt(0)) totalGains = totalGains.plus(v);
      if (v.lt(0)) totalShrinkage = totalShrinkage.plus(v.abs());
      if (!v.isZero()) totalLinesWithVariance++;

      return {
        lineId: l.id,
        countNumber: l.cycleCount.countNumber,
        countStatus: l.cycleCount.status,
        itemSku: l.item.sku,
        itemName: l.item.name,
        locationCode: l.location.code,
        systemQuantity: l.systemQuantity.toString(),
        countedQuantity: l.countedQuantity
          ? l.countedQuantity.toString()
          : null,
        varianceQuantity: v.toString(),
      };
    });

    return {
      summary: {
        totalLinesCounted: lines.length,
        linesWithVariance: totalLinesWithVariance,
        totalGainsQuantity: totalGains.toString(),
        totalShrinkageQuantity: totalShrinkage.toString(),
      },
      lines: discrepancyLines,
    };
  }

  /**
   * 5. Quarantine Aging & Disposition
   */
  async getQuarantineAging(
    organizationId: string,
    query: WarehouseReportsQueryDto,
  ) {
    const records = await this.prisma.quarantineRecord.findMany({
      where: {
        organizationId,
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, sku: true, name: true } },
      },
    });

    const now = new Date();
    const items = records.map((r) => {
      const ageDays = Math.floor(
        (now.getTime() - new Date(r.createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return {
        id: r.id,
        quarantineNumber: r.quarantineNumber,
        warehouseCode: r.warehouse.code,
        itemSku: r.item.sku,
        quantity: r.quantity.toString(),
        status: r.status,
        disposition: r.disposition ?? 'PENDING',
        ageDays,
      };
    });

    const activeCount = records.filter(
      (r) =>
        r.status === QuarantineStatus.QUARANTINED ||
        r.status === QuarantineStatus.UNDER_INSPECTION,
    ).length;
    const releasedCount = records.filter(
      (r) => r.status === QuarantineStatus.RELEASED,
    ).length;

    return {
      totalRecords: records.length,
      activeQuarantined: activeCount,
      released: releasedCount,
      records: items,
    };
  }

  /**
   * 6. Replenishment History & Triggers
   */
  async getReplenishmentHistory(
    organizationId: string,
    query: WarehouseReportsQueryDto,
  ) {
    const tasks = await this.prisma.replenishmentTask.findMany({
      where: {
        organizationId,
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      },
      include: {
        item: { select: { id: true, sku: true, name: true } },
        sourceLocation: { select: { id: true, code: true, name: true } },
        destinationLocation: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tasks.map((t) => ({
      taskId: t.id,
      taskNumber: t.taskNumber,
      itemSku: t.item.sku,
      itemName: t.item.name,
      sourceLocationCode: t.sourceLocation.code,
      destinationLocationCode: t.destinationLocation.code,
      quantity: t.quantity.toString(),
      status: t.status,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
    }));
  }

  /**
   * 7. Transfer Volume Analysis
   */
  async getTransferAnalysis(
    organizationId: string,
    query: WarehouseReportsQueryDto,
  ) {
    const transfers = await this.prisma.warehouseTransfer.findMany({
      where: {
        organizationId,
        ...(query.warehouseId
          ? {
              OR: [
                { sourceWarehouseId: query.warehouseId },
                { destinationWarehouseId: query.warehouseId },
              ],
            }
          : {}),
      },
      include: {
        sourceWarehouse: { select: { id: true, code: true, name: true } },
        destinationWarehouse: { select: { id: true, code: true, name: true } },
        lines: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return transfers.map((t) => {
      const totalUnits = t.lines.reduce(
        (acc, l) => acc.plus(l.quantity),
        new Prisma.Decimal(0),
      );
      return {
        transferId: t.id,
        transferNumber: t.transferNumber,
        sourceWarehouseCode: t.sourceWarehouse.code,
        destinationWarehouseCode: t.destinationWarehouse.code,
        status: t.status,
        lineCount: t.lines.length,
        totalQuantity: totalUnits.toString(),
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      };
    });
  }

  /**
   * 8. Inventory Accuracy Rate
   */
  async getInventoryAccuracyRate(
    organizationId: string,
    query?: WarehouseReportsQueryDto,
  ) {
    const where: Prisma.CycleCountLineWhereInput = {
      organizationId,
      countedQuantity: { not: null },
    };
    if (query?.warehouseId) {
      where.cycleCount = { warehouseId: query.warehouseId };
    }

    const countLines = await this.prisma.cycleCountLine.findMany({
      where,
    });

    if (countLines.length === 0) {
      return {
        totalLinesCounted: 0,
        exactMatchLines: 0,
        accuracyRatePercentage: 100,
      };
    }

    const exactMatches = countLines.filter(
      (l) => l.varianceQuantity && l.varianceQuantity.isZero(),
    ).length;

    const rate = (exactMatches / countLines.length) * 100;

    return {
      totalLinesCounted: countLines.length,
      exactMatchLines: exactMatches,
      accuracyRatePercentage: Number(rate.toFixed(2)),
    };
  }

  /**
   * 9. Picking Accuracy & Velocity
   */
  async getPickingAccuracyAndVelocity(
    organizationId: string,
    query: WarehouseReportsQueryDto,
  ) {
    const pickLines = await this.prisma.pickTaskLine.findMany({
      where: {
        organizationId,
        pickTask: query.warehouseId
          ? { warehouseId: query.warehouseId }
          : undefined,
      },
    });

    const totalLines = pickLines.length;
    const fullyPickedLines = pickLines.filter(
      (l) => l.status === PickTaskStatus.PICKED,
    ).length;
    const partialPickedLines = pickLines.filter(
      (l) => l.status === PickTaskStatus.PARTIALLY_PICKED,
    ).length;

    return {
      totalPickLines: totalLines,
      fullyPickedLines,
      partialPickedLines,
      fulfillmentRatePercentage:
        totalLines > 0
          ? Number(((fullyPickedLines / totalLines) * 100).toFixed(2))
          : 100,
    };
  }
}
