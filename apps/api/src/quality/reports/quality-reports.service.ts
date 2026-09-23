import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QualityReportsQueryDto } from './dto/quality-reports.dto';
import {
  InspectionLotStatus,
  InspectionDecision,
  QualityHoldStatus,
  NonConformanceStatus,
  CapaStatus,
  Prisma,
} from '@prisma/client';

interface ItemPassFailAccumulator {
  itemId: string;
  itemSku: string;
  itemName: string;
  totalLots: number;
  passedLots: number;
  failedLots: number;
  totalInspectedQty: number;
  totalPassedQty: number;
  totalFailedQty: number;
}

interface SupplierQualityAccumulator {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  totalLots: number;
  acceptedLots: number;
  rejectedLots: number;
  inspectedQty: number;
  failedQty: number;
}

@Injectable()
export class QualityReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Quality Inspection Summary
   */
  async getInspectionSummary(
    organizationId: string,
    query?: QualityReportsQueryDto,
  ) {
    const lots = await this.prisma.qualityInspectionLot.findMany({
      where: {
        organizationId,
        ...(query?.itemId && { itemId: query.itemId }),
        ...(query?.supplierId && { supplierId: query.supplierId }),
        ...(query?.inspectionType && { inspectionType: query.inspectionType }),
        ...(query?.from && { createdAt: { gte: new Date(query.from) } }),
        ...(query?.to && { createdAt: { lte: new Date(query.to) } }),
      },
    });

    const totalLots = lots.length;
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let decided = 0;
    let accepted = 0;
    let rejected = 0;
    let totalSampleQty = new Prisma.Decimal(0);
    let totalInspectedQty = new Prisma.Decimal(0);
    let totalPassedQty = new Prisma.Decimal(0);
    let totalFailedQty = new Prisma.Decimal(0);

    for (const lot of lots) {
      if (lot.status === InspectionLotStatus.PENDING) pending++;
      if (lot.status === InspectionLotStatus.IN_PROGRESS) inProgress++;
      if (lot.status === InspectionLotStatus.COMPLETED) completed++;
      if (lot.status === InspectionLotStatus.DECIDED) decided++;

      if (
        lot.decision === InspectionDecision.ACCEPT ||
        lot.decision === InspectionDecision.ACCEPT_WITH_DEVIATION
      ) {
        accepted++;
      } else if (
        lot.decision === InspectionDecision.REJECT ||
        lot.decision === InspectionDecision.SCRAP ||
        lot.decision === InspectionDecision.RETURN_TO_SUPPLIER
      ) {
        rejected++;
      }

      totalSampleQty = totalSampleQty.add(lot.sampleQuantity);
      totalInspectedQty = totalInspectedQty.add(lot.inspectedQuantity);
      totalPassedQty = totalPassedQty.add(lot.passedQuantity);
      totalFailedQty = totalFailedQty.add(lot.failedQuantity);
    }

    const overallPassRate =
      totalInspectedQty.toNumber() > 0
        ? Number(
            (
              (totalPassedQty.toNumber() / totalInspectedQty.toNumber()) *
              100
            ).toFixed(2),
          )
        : 100;

    return {
      totalLots,
      pendingLots: pending,
      inProgressLots: inProgress,
      completedLots: completed,
      decidedLots: decided,
      acceptedLots: accepted,
      rejectedLots: rejected,
      totalSampleQuantity: totalSampleQty.toNumber(),
      totalInspectedQuantity: totalInspectedQty.toNumber(),
      totalPassedQuantity: totalPassedQty.toNumber(),
      totalFailedQuantity: totalFailedQty.toNumber(),
      overallPassRate,
    };
  }

  /**
   * 2. Inspection Pass / Fail Report
   */
  async getPassFailReport(
    organizationId: string,
    query?: QualityReportsQueryDto,
  ) {
    const lots = await this.prisma.qualityInspectionLot.findMany({
      where: {
        organizationId,
        ...(query?.itemId && { itemId: query.itemId }),
        ...(query?.inspectionType && { inspectionType: query.inspectionType }),
        ...(query?.from && { createdAt: { gte: new Date(query.from) } }),
        ...(query?.to && { createdAt: { lte: new Date(query.to) } }),
      },
      include: {
        item: { select: { id: true, sku: true, name: true } },
      },
    });

    const itemMap = new Map<string, ItemPassFailAccumulator>();

    for (const lot of lots) {
      if (!itemMap.has(lot.itemId)) {
        itemMap.set(lot.itemId, {
          itemId: lot.itemId,
          itemSku: lot.item.sku,
          itemName: lot.item.name,
          totalLots: 0,
          passedLots: 0,
          failedLots: 0,
          totalInspectedQty: 0,
          totalPassedQty: 0,
          totalFailedQty: 0,
        });
      }

      const rec = itemMap.get(lot.itemId)!;
      rec.totalLots++;
      rec.totalInspectedQty += lot.inspectedQuantity.toNumber();
      rec.totalPassedQty += lot.passedQuantity.toNumber();
      rec.totalFailedQty += lot.failedQuantity.toNumber();

      if (
        lot.decision === InspectionDecision.ACCEPT ||
        lot.decision === InspectionDecision.ACCEPT_WITH_DEVIATION
      ) {
        rec.passedLots++;
      } else if (
        lot.decision === InspectionDecision.REJECT ||
        lot.decision === InspectionDecision.SCRAP ||
        lot.decision === InspectionDecision.RETURN_TO_SUPPLIER
      ) {
        rec.failedLots++;
      }
    }

    return Array.from(itemMap.values()).map((row) => ({
      ...row,
      passRate:
        row.totalInspectedQty > 0
          ? Number(
              ((row.totalPassedQty / row.totalInspectedQty) * 100).toFixed(2),
            )
          : 100,
    }));
  }

  /**
   * 3. Inspection Lot Aging
   */
  async getInspectionLotAging(organizationId: string) {
    const openLots = await this.prisma.qualityInspectionLot.findMany({
      where: {
        organizationId,
        status: {
          in: [
            InspectionLotStatus.PENDING,
            InspectionLotStatus.IN_PROGRESS,
            InspectionLotStatus.COMPLETED,
          ],
        },
      },
      include: {
        item: { select: { id: true, sku: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const now = new Date();
    const buckets = {
      '0-3 days': [] as any[],
      '4-7 days': [] as any[],
      '8-14 days': [] as any[],
      '15+ days': [] as any[],
    };

    for (const lot of openLots) {
      const ageDays = Math.floor(
        (now.getTime() - new Date(lot.createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const entry = {
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        itemSku: lot.item.sku,
        itemName: lot.item.name,
        warehouseCode: lot.warehouse.code,
        status: lot.status,
        ageDays,
        createdAt: lot.createdAt,
      };

      if (ageDays <= 3) {
        buckets['0-3 days'].push(entry);
      } else if (ageDays <= 7) {
        buckets['4-7 days'].push(entry);
      } else if (ageDays <= 14) {
        buckets['8-14 days'].push(entry);
      } else {
        buckets['15+ days'].push(entry);
      }
    }

    return {
      totalOpenLots: openLots.length,
      buckets: {
        '0-3 days': {
          count: buckets['0-3 days'].length,
          lots: buckets['0-3 days'],
        },
        '4-7 days': {
          count: buckets['4-7 days'].length,
          lots: buckets['4-7 days'],
        },
        '8-14 days': {
          count: buckets['8-14 days'].length,
          lots: buckets['8-14 days'],
        },
        '15+ days': {
          count: buckets['15+ days'].length,
          lots: buckets['15+ days'],
        },
      },
    };
  }

  /**
   * 4. Quality Hold Report
   */
  async getQualityHoldReport(
    organizationId: string,
    query?: QualityReportsQueryDto,
  ) {
    const holds = await this.prisma.qualityHold.findMany({
      where: {
        organizationId,
        ...(query?.warehouseId && { warehouseId: query.warehouseId }),
        ...(query?.itemId && { itemId: query.itemId }),
      },
      include: {
        item: { select: { id: true, sku: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    let activeHoldsCount = 0;
    let activeHeldQuantity = new Prisma.Decimal(0);

    for (const hold of holds) {
      if (hold.status === QualityHoldStatus.ACTIVE) {
        activeHoldsCount++;
        activeHeldQuantity = activeHeldQuantity.add(hold.holdQuantity);
      }
    }

    return {
      totalHolds: holds.length,
      activeHoldsCount,
      activeHeldQuantity: activeHeldQuantity.toNumber(),
      holds,
    };
  }

  /**
   * 5. Quarantine Aging Report
   */
  async getQuarantineAgingReport(organizationId: string) {
    const holds = await this.prisma.qualityHold.findMany({
      where: { organizationId, status: QualityHoldStatus.ACTIVE },
      include: {
        item: { select: { id: true, sku: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const now = new Date();
    return holds.map((h) => {
      const ageDays = Math.floor(
        (now.getTime() - new Date(h.createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return {
        holdId: h.id,
        holdNumber: h.holdNumber,
        itemSku: h.item.sku,
        itemName: h.item.name,
        warehouseCode: h.warehouse.code,
        holdQuantity: h.holdQuantity.toNumber(),
        reason: h.reason,
        ageDays,
        createdAt: h.createdAt,
      };
    });
  }

  /**
   * 6. Non-Conformance Report
   */
  async getNonConformanceReport(
    organizationId: string,
    query?: QualityReportsQueryDto,
  ) {
    const ncrs = await this.prisma.nonConformance.findMany({
      where: {
        organizationId,
        ...(query?.itemId && { itemId: query.itemId }),
        ...(query?.supplierId && { supplierId: query.supplierId }),
        ...(query?.from && { createdAt: { gte: new Date(query.from) } }),
        ...(query?.to && { createdAt: { lte: new Date(query.to) } }),
      },
      include: {
        item: { select: { id: true, sku: true, name: true } },
        supplier: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const bySeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    const byStatus = {
      OPEN: 0,
      CONTAINED: 0,
      INVESTIGATING: 0,
      ROOT_CAUSE_IDENTIFIED: 0,
      DISPOSITIONED: 0,
      CAPA_REQUIRED: 0,
      CLOSED: 0,
      CANCELLED: 0,
    };

    for (const ncr of ncrs) {
      if (bySeverity[ncr.severity] !== undefined) bySeverity[ncr.severity]++;
      if (byStatus[ncr.status] !== undefined) byStatus[ncr.status]++;
    }

    return {
      totalNcrs: ncrs.length,
      bySeverity,
      byStatus,
      records: ncrs,
    };
  }

  /**
   * 7. NCR Aging Report
   */
  async getNcrAgingReport(organizationId: string) {
    const openNcrs = await this.prisma.nonConformance.findMany({
      where: {
        organizationId,
        status: {
          notIn: [NonConformanceStatus.CLOSED, NonConformanceStatus.CANCELLED],
        },
      },
      include: {
        item: { select: { id: true, sku: true, name: true } },
        supplier: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const now = new Date();
    return openNcrs.map((n) => {
      const ageDays = Math.floor(
        (now.getTime() - new Date(n.createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return {
        ncrId: n.id,
        ncrNumber: n.ncrNumber,
        title: n.title,
        itemSku: n.item.sku,
        supplierName: n.supplier?.name,
        severity: n.severity,
        status: n.status,
        ageDays,
        createdAt: n.createdAt,
      };
    });
  }

  /**
   * 8. CAPA Status Report
   */
  async getCapaStatusReport(organizationId: string) {
    const capas = await this.prisma.cAPA.findMany({
      where: { organizationId },
      include: {
        nonConformance: {
          select: { id: true, ncrNumber: true, severity: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const byStatus = {
      DRAFT: 0,
      OPEN: 0,
      IN_PROGRESS: 0,
      PENDING_VERIFICATION: 0,
      VERIFIED: 0,
      CLOSED: 0,
      CANCELLED: 0,
    };

    for (const c of capas) {
      if (byStatus[c.status] !== undefined) byStatus[c.status]++;
    }

    return {
      totalCapas: capas.length,
      openCapas: capas.filter(
        (c) =>
          c.status !== CapaStatus.CLOSED && c.status !== CapaStatus.CANCELLED,
      ).length,
      verifiedCapas: byStatus.VERIFIED,
      closedCapas: byStatus.CLOSED,
      byStatus,
      records: capas,
    };
  }

  /**
   * 9. Supplier Quality Report
   */
  async getSupplierQualityReport(
    organizationId: string,
    query?: QualityReportsQueryDto,
  ) {
    const lots = await this.prisma.qualityInspectionLot.findMany({
      where: {
        organizationId,
        supplierId: { not: null },
        ...(query?.supplierId && { supplierId: query.supplierId }),
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
      },
    });

    const supplierMap = new Map<string, SupplierQualityAccumulator>();
    for (const lot of lots) {
      if (!lot.supplier) continue;
      if (!supplierMap.has(lot.supplier.id)) {
        supplierMap.set(lot.supplier.id, {
          supplierId: lot.supplier.id,
          supplierCode: lot.supplier.code,
          supplierName: lot.supplier.name,
          totalLots: 0,
          acceptedLots: 0,
          rejectedLots: 0,
          inspectedQty: 0,
          failedQty: 0,
        });
      }

      const row = supplierMap.get(lot.supplier.id)!;
      row.totalLots++;
      row.inspectedQty += lot.inspectedQuantity.toNumber();
      row.failedQty += lot.failedQuantity.toNumber();

      if (
        lot.decision === InspectionDecision.ACCEPT ||
        lot.decision === InspectionDecision.ACCEPT_WITH_DEVIATION
      ) {
        row.acceptedLots++;
      } else if (
        lot.decision === InspectionDecision.REJECT ||
        lot.decision === InspectionDecision.SCRAP ||
        lot.decision === InspectionDecision.RETURN_TO_SUPPLIER
      ) {
        row.rejectedLots++;
      }
    }

    return Array.from(supplierMap.values()).map((s) => ({
      ...s,
      rejectionRate:
        s.totalLots > 0
          ? Number(((s.rejectedLots / s.totalLots) * 100).toFixed(2))
          : 0,
      defectRate:
        s.inspectedQty > 0
          ? Number(((s.failedQty / s.inspectedQty) * 100).toFixed(2))
          : 0,
    }));
  }

  /**
   * 10. Customer Quality Issues Report
   */
  async getCustomerQualityReport(organizationId: string) {
    const issues = await this.prisma.customerQualityIssue.findMany({
      where: { organizationId },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, sku: true, name: true } },
      },
      orderBy: { reportedAt: 'desc' },
    });

    const bySeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const i of issues) {
      if (bySeverity[i.severity] !== undefined) bySeverity[i.severity]++;
    }

    return {
      totalIssues: issues.length,
      bySeverity,
      records: issues,
    };
  }

  /**
   * 11. Rework & Scrap Quality Report
   */
  async getReworkAndScrapReport(organizationId: string) {
    const lots = await this.prisma.qualityInspectionLot.findMany({
      where: {
        organizationId,
        decision: { in: [InspectionDecision.REWORK, InspectionDecision.SCRAP] },
      },
      include: {
        item: { select: { id: true, sku: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalReworkQty = new Prisma.Decimal(0);
    let totalScrapQty = new Prisma.Decimal(0);

    for (const lot of lots) {
      if (lot.decision === InspectionDecision.REWORK) {
        totalReworkQty = totalReworkQty.add(lot.totalQuantity);
      } else if (lot.decision === InspectionDecision.SCRAP) {
        totalScrapQty = totalScrapQty.add(lot.totalQuantity);
      }
    }

    return {
      totalReworkLots: lots.filter(
        (l) => l.decision === InspectionDecision.REWORK,
      ).length,
      totalScrapLots: lots.filter(
        (l) => l.decision === InspectionDecision.SCRAP,
      ).length,
      totalReworkQuantity: totalReworkQty.toNumber(),
      totalScrapQuantity: totalScrapQty.toNumber(),
      records: lots,
    };
  }

  /**
   * 12. Quality Trend Analysis
   */
  async getQualityTrendAnalysis(organizationId: string) {
    const lots = await this.prisma.qualityInspectionLot.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });

    const monthlyMap = new Map<
      string,
      { total: number; passed: number; failed: number }
    >();

    for (const lot of lots) {
      const month = new Date(lot.createdAt).toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { total: 0, passed: 0, failed: 0 });
      }
      const data = monthlyMap.get(month)!;
      data.total++;
      if (
        lot.decision === InspectionDecision.ACCEPT ||
        lot.decision === InspectionDecision.ACCEPT_WITH_DEVIATION
      ) {
        data.passed++;
      } else if (
        lot.decision === InspectionDecision.REJECT ||
        lot.decision === InspectionDecision.SCRAP ||
        lot.decision === InspectionDecision.RETURN_TO_SUPPLIER
      ) {
        data.failed++;
      }
    }

    return Array.from(monthlyMap.entries()).map(([month, stats]) => ({
      month,
      totalLots: stats.total,
      passedLots: stats.passed,
      failedLots: stats.failed,
      passRate:
        stats.total > 0
          ? Number(((stats.passed / stats.total) * 100).toFixed(2))
          : 100,
    }));
  }
}
