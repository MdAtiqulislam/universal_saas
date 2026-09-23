/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReturnsReportsQueryDto } from './dto/returns-reports.dto';
import { Prisma, ReturnStatus, ReturnDispositionType } from '@prisma/client';

@Injectable()
export class ReturnsReportsService {
  private readonly logger = new Logger(ReturnsReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Return Summary
   */
  async getSummaryReport(
    organizationId: string,
    query?: ReturnsReportsQueryDto,
  ) {
    const where: Prisma.ReturnRequestWhereInput = { organizationId };

    if (query?.startDate || query?.endDate) {
      where.requestedAt = {};
      if (query.startDate) where.requestedAt.gte = new Date(query.startDate);
      if (query.endDate) where.requestedAt.lte = new Date(query.endDate);
    }
    if (query?.customerId) where.customerId = query.customerId;
    if (query?.supplierId) where.supplierId = query.supplierId;

    const [
      totalRmas,
      draftCount,
      authorizedCount,
      receivedCount,
      inspectingCount,
      resolvedCount,
      closedCount,
      rejectedCount,
    ] = await Promise.all([
      this.prisma.returnRequest.count({ where }),
      this.prisma.returnRequest.count({
        where: { ...where, status: ReturnStatus.DRAFT },
      }),
      this.prisma.returnRequest.count({
        where: { ...where, status: ReturnStatus.AUTHORIZED },
      }),
      this.prisma.returnRequest.count({
        where: { ...where, status: ReturnStatus.RECEIVED },
      }),
      this.prisma.returnRequest.count({
        where: { ...where, status: ReturnStatus.INSPECTING },
      }),
      this.prisma.returnRequest.count({
        where: { ...where, status: ReturnStatus.RESOLVED },
      }),
      this.prisma.returnRequest.count({
        where: { ...where, status: ReturnStatus.CLOSED },
      }),
      this.prisma.returnRequest.count({
        where: { ...where, status: ReturnStatus.REJECTED },
      }),
    ]);

    const lines = await this.prisma.returnRequestLine.findMany({
      where: {
        organizationId,
        returnRequest: where,
      },
    });

    const totalRequestedQty = lines.reduce(
      (sum, l) => sum.plus(new Prisma.Decimal(l.requestedQuantity)),
      new Prisma.Decimal(0),
    );
    const totalAuthorizedQty = lines.reduce(
      (sum, l) => sum.plus(new Prisma.Decimal(l.authorizedQuantity)),
      new Prisma.Decimal(0),
    );
    const totalReceivedQty = lines.reduce(
      (sum, l) => sum.plus(new Prisma.Decimal(l.receivedQuantity)),
      new Prisma.Decimal(0),
    );
    const totalInspectedQty = lines.reduce(
      (sum, l) => sum.plus(new Prisma.Decimal(l.inspectedQuantity)),
      new Prisma.Decimal(0),
    );
    const totalAcceptedQty = lines.reduce(
      (sum, l) => sum.plus(new Prisma.Decimal(l.acceptedQuantity)),
      new Prisma.Decimal(0),
    );
    const totalRejectedQty = lines.reduce(
      (sum, l) => sum.plus(new Prisma.Decimal(l.rejectedQuantity)),
      new Prisma.Decimal(0),
    );
    const totalValue = lines.reduce(
      (sum, l) => sum.plus(new Prisma.Decimal(l.lineAmount)),
      new Prisma.Decimal(0),
    );

    return {
      totalRmas,
      statusCounts: {
        draft: draftCount,
        authorized: authorizedCount,
        received: receivedCount,
        inspecting: inspectingCount,
        resolved: resolvedCount,
        closed: closedCount,
        rejected: rejectedCount,
      },
      quantities: {
        requested: totalRequestedQty.toNumber(),
        authorized: totalAuthorizedQty.toNumber(),
        received: totalReceivedQty.toNumber(),
        inspected: totalInspectedQty.toNumber(),
        accepted: totalAcceptedQty.toNumber(),
        rejected: totalRejectedQty.toNumber(),
      },
      totalFinancialValue: totalValue.toNumber(),
    };
  }

  /**
   * 2. Customer Returns Report
   */
  async getCustomerReturnsReport(
    organizationId: string,
    query?: ReturnsReportsQueryDto,
  ) {
    const where: Prisma.ReturnRequestWhereInput = {
      organizationId,
      customerId: query?.customerId ?? { not: null },
    };

    if (query?.startDate || query?.endDate) {
      where.requestedAt = {};
      if (query.startDate) where.requestedAt.gte = new Date(query.startDate);
      if (query.endDate) where.requestedAt.lte = new Date(query.endDate);
    }

    const returns = await this.prisma.returnRequest.findMany({
      where,
      include: {
        customer: true,
        salesOrder: true,
        deliveryOrder: true,
        shipment: true,
        reason: true,
        lines: { include: { item: true, variant: true } },
        resolutions: true,
      },
      orderBy: { requestedAt: 'desc' },
      take: 100,
    });

    return returns.map((r) => ({
      id: r.id,
      returnNumber: r.returnNumber,
      returnType: r.returnType,
      status: r.status,
      customer: r.customer
        ? { id: r.customer.id, name: r.customer.name, code: r.customer.code }
        : null,
      salesOrderNumber: r.salesOrder?.orderNumber ?? null,
      shipmentNumber: r.shipment?.shipmentNumber ?? null,
      reason: r.reason.name,
      requestedAt: r.requestedAt,
      lineCount: r.lines.length,
      totalRequestedQty: r.lines
        .reduce(
          (sum, l) => sum.plus(new Prisma.Decimal(l.requestedQuantity)),
          new Prisma.Decimal(0),
        )
        .toNumber(),
      totalReceivedQty: r.lines
        .reduce(
          (sum, l) => sum.plus(new Prisma.Decimal(l.receivedQuantity)),
          new Prisma.Decimal(0),
        )
        .toNumber(),
      totalValue: r.lines
        .reduce(
          (sum, l) => sum.plus(new Prisma.Decimal(l.lineAmount)),
          new Prisma.Decimal(0),
        )
        .toNumber(),
      resolutionCount: r.resolutions.length,
    }));
  }

  /**
   * 3. Supplier Returns Report
   */
  async getSupplierReturnsReport(
    organizationId: string,
    query?: ReturnsReportsQueryDto,
  ) {
    const where: Prisma.ReturnRequestWhereInput = {
      organizationId,
      supplierId: query?.supplierId ?? { not: null },
    };

    if (query?.startDate || query?.endDate) {
      where.requestedAt = {};
      if (query.startDate) where.requestedAt.gte = new Date(query.startDate);
      if (query.endDate) where.requestedAt.lte = new Date(query.endDate);
    }

    const returns = await this.prisma.returnRequest.findMany({
      where,
      include: {
        supplier: true,
        purchaseOrder: true,
        goodsReceipt: true,
        reason: true,
        lines: { include: { item: true, variant: true } },
        resolutions: true,
      },
      orderBy: { requestedAt: 'desc' },
      take: 100,
    });

    return returns.map((r) => ({
      id: r.id,
      returnNumber: r.returnNumber,
      returnType: r.returnType,
      status: r.status,
      supplier: r.supplier
        ? { id: r.supplier.id, name: r.supplier.name, code: r.supplier.code }
        : null,
      poNumber: r.purchaseOrder?.poNumber ?? null,
      receiptNumber: r.goodsReceipt?.receiptNumber ?? null,
      reason: r.reason.name,
      requestedAt: r.requestedAt,
      lineCount: r.lines.length,
      totalRequestedQty: r.lines
        .reduce(
          (sum, l) => sum.plus(new Prisma.Decimal(l.requestedQuantity)),
          new Prisma.Decimal(0),
        )
        .toNumber(),
      totalReceivedQty: r.lines
        .reduce(
          (sum, l) => sum.plus(new Prisma.Decimal(l.receivedQuantity)),
          new Prisma.Decimal(0),
        )
        .toNumber(),
      totalValue: r.lines
        .reduce(
          (sum, l) => sum.plus(new Prisma.Decimal(l.lineAmount)),
          new Prisma.Decimal(0),
        )
        .toNumber(),
      resolutionCount: r.resolutions.length,
    }));
  }

  /**
   * 4. Return Reason Analysis
   */
  async getReasonAnalysisReport(
    organizationId: string,
    _query?: ReturnsReportsQueryDto,
  ) {
    const reasons = await this.prisma.returnReason.findMany({
      where: { organizationId },
      include: {
        returns: {
          include: { lines: true },
        },
      },
    });

    const totalRmaCount = reasons.reduce((sum, r) => sum + r.returns.length, 0);

    return reasons.map((reason) => {
      const count = reason.returns.length;
      let totalQty = new Prisma.Decimal(0);
      let totalValue = new Prisma.Decimal(0);

      for (const ret of reason.returns) {
        for (const line of ret.lines) {
          totalQty = totalQty.plus(new Prisma.Decimal(line.requestedQuantity));
          totalValue = totalValue.plus(new Prisma.Decimal(line.lineAmount));
        }
      }

      const percentage = totalRmaCount > 0 ? (count / totalRmaCount) * 100 : 0;

      return {
        id: reason.id,
        code: reason.code,
        name: reason.name,
        count,
        percentage: Number(percentage.toFixed(2)),
        totalQuantity: totalQty.toNumber(),
        totalFinancialValue: totalValue.toNumber(),
      };
    });
  }

  /**
   * 5. Disposition Analysis
   */
  async getDispositionAnalysisReport(
    organizationId: string,
    _query?: ReturnsReportsQueryDto,
  ) {
    const dispositions = await this.prisma.returnDispositionRecord.findMany({
      where: { organizationId },
    });

    const dispositionTypes = Object.values(ReturnDispositionType);

    return dispositionTypes.map((type) => {
      const matches = dispositions.filter((d) => d.dispositionType === type);
      const totalQty = matches.reduce(
        (sum, d) => sum.plus(new Prisma.Decimal(d.quantity)),
        new Prisma.Decimal(0),
      );

      return {
        dispositionType: type,
        count: matches.length,
        totalQuantity: totalQty.toNumber(),
      };
    });
  }

  /**
   * 6. Financial Impact Report
   */
  async getFinancialImpactReport(
    organizationId: string,
    _query?: ReturnsReportsQueryDto,
  ) {
    const resolutions = await this.prisma.returnResolution.findMany({
      where: { organizationId },
    });

    let creditNoteTotal = new Prisma.Decimal(0);
    let refundTotal = new Prisma.Decimal(0);
    let debitNoteTotal = new Prisma.Decimal(0);
    let replacementTotal = new Prisma.Decimal(0);

    for (const res of resolutions) {
      const amt = new Prisma.Decimal(res.amount);
      if (
        res.resolutionType === 'CREDIT_NOTE' ||
        res.resolutionType === 'PARTIAL_CREDIT'
      ) {
        creditNoteTotal = creditNoteTotal.plus(amt);
      } else if (
        res.resolutionType === 'REFUND' ||
        res.resolutionType === 'PARTIAL_REFUND'
      ) {
        refundTotal = refundTotal.plus(amt);
      } else if (res.resolutionType === 'DEBIT_NOTE') {
        debitNoteTotal = debitNoteTotal.plus(amt);
      } else if (res.resolutionType === 'REPLACEMENT') {
        replacementTotal = replacementTotal.plus(amt);
      }
    }

    const scrapDispositions =
      await this.prisma.returnDispositionRecord.findMany({
        where: { organizationId, dispositionType: 'SCRAP' },
        include: { returnLine: true },
      });

    const scrapCostTotal = scrapDispositions.reduce((sum, d) => {
      const lineCost = new Prisma.Decimal(d.returnLine.unitPrice).times(
        new Prisma.Decimal(d.quantity),
      );
      return sum.plus(lineCost);
    }, new Prisma.Decimal(0));

    return {
      creditNotesIssuedTotal: creditNoteTotal.toNumber(),
      refundsPaidTotal: refundTotal.toNumber(),
      supplierDebitNotesTotal: debitNoteTotal.toNumber(),
      replacementValueTotal: replacementTotal.toNumber(),
      scrapLossTotal: scrapCostTotal.toNumber(),
      netCustomerFinancialImpact: creditNoteTotal
        .plus(refundTotal)
        .plus(replacementTotal)
        .toNumber(),
      netSupplierFinancialRecovery: debitNoteTotal.toNumber(),
    };
  }

  /**
   * 7. RMA Aging Report
   */
  async getAgingReport(
    organizationId: string,
    _query?: ReturnsReportsQueryDto,
  ) {
    const activeReturns = await this.prisma.returnRequest.findMany({
      where: {
        organizationId,
        status: {
          notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'CANCELLED', 'VOIDED'],
        },
      },
      include: {
        customer: true,
        supplier: true,
        reason: true,
      },
    });

    const now = Date.now();
    const buckets = {
      current: 0, // < 1 day
      days1To7: 0,
      days8To15: 0,
      days16To30: 0,
      days31To60: 0,
      days60Plus: 0,
    };

    const details = [];

    for (const r of activeReturns) {
      const ageDays = Math.floor(
        (now - r.requestedAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (ageDays < 1) buckets.current++;
      else if (ageDays <= 7) buckets.days1To7++;
      else if (ageDays <= 15) buckets.days8To15++;
      else if (ageDays <= 30) buckets.days16To30++;
      else if (ageDays <= 60) buckets.days31To60++;
      else buckets.days60Plus++;

      details.push({
        id: r.id,
        returnNumber: r.returnNumber,
        status: r.status,
        customerOrSupplier: r.customer?.name ?? r.supplier?.name ?? 'Internal',
        requestedAt: r.requestedAt,
        ageDays,
      });
    }

    return {
      activeRmaCount: activeReturns.length,
      buckets,
      details: details.sort((a, b) => b.ageDays - a.ageDays).slice(0, 50),
    };
  }

  /**
   * 8. Quality-Linked Returns
   */
  async getQualityLinkedReturnsReport(
    organizationId: string,
    _query?: ReturnsReportsQueryDto,
  ) {
    const returns = await this.prisma.returnRequest.findMany({
      where: {
        organizationId,
        inspectionLotId: { not: null },
      },
      include: {
        customer: true,
        inspectionLot: {
          include: {
            nonConformances: true,
          },
        },
        reason: true,
        lines: { include: { item: true } },
      },
      orderBy: { requestedAt: 'desc' },
      take: 50,
    });

    return returns.map((r) => ({
      id: r.id,
      returnNumber: r.returnNumber,
      status: r.status,
      customerName: r.customer?.name ?? null,
      inspectionLot: r.inspectionLot
        ? {
            id: r.inspectionLot.id,
            lotNumber: r.inspectionLot.lotNumber,
            status: r.inspectionLot.status,
            decision: r.inspectionLot.decision,
            passedQuantity: Number(r.inspectionLot.passedQuantity),
            failedQuantity: Number(r.inspectionLot.failedQuantity),
            ncrCount: r.inspectionLot.nonConformances.length,
          }
        : null,
      reason: r.reason.name,
      requestedAt: r.requestedAt,
    }));
  }

  /**
   * 9. Return Trend Analysis
   */
  async getTrendsReport(
    organizationId: string,
    _query?: ReturnsReportsQueryDto,
  ) {
    const returns = await this.prisma.returnRequest.findMany({
      where: { organizationId },
      select: {
        id: true,
        requestedAt: true,
        status: true,
        returnType: true,
        lines: { select: { requestedQuantity: true, lineAmount: true } },
      },
      orderBy: { requestedAt: 'asc' },
    });

    const monthlyMap = new Map<
      string,
      {
        month: string;
        totalReturns: number;
        customerReturns: number;
        supplierReturns: number;
        totalQuantity: number;
        totalValue: number;
      }
    >();

    for (const r of returns) {
      const monthKey = r.requestedAt.toISOString().substring(0, 7); // "2026-08"
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          month: monthKey,
          totalReturns: 0,
          customerReturns: 0,
          supplierReturns: 0,
          totalQuantity: 0,
          totalValue: 0,
        });
      }

      const entry = monthlyMap.get(monthKey)!;
      entry.totalReturns++;
      if (r.returnType === 'CUSTOMER_RETURN') entry.customerReturns++;
      if (r.returnType === 'SUPPLIER_RETURN') entry.supplierReturns++;

      for (const line of r.lines) {
        entry.totalQuantity += Number(line.requestedQuantity);
        entry.totalValue += Number(line.lineAmount);
      }
    }

    return Array.from(monthlyMap.values());
  }
}
