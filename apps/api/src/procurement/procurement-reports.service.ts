import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProcurementReportsQueryDto } from './dto/procurement-reports-query.dto';
import {
  PurchaseOrderStatus,
  PurchaseRequisitionStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class ProcurementReportsService {
  private readonly logger = new Logger(ProcurementReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Purchase Order Summary
   */
  async getPurchaseOrderSummary(organizationId: string) {
    const orders = await this.prisma.purchaseOrder.findMany({
      where: { organizationId },
      select: { status: true, grandTotal: true },
    });

    const summary = {
      totalCount: orders.length,
      draftCount: 0,
      submittedCount: 0,
      approvedCount: 0,
      sentCount: 0,
      acknowledgedCount: 0,
      partiallyReceivedCount: 0,
      receivedCount: 0,
      closedCount: 0,
      cancelledCount: 0,
      rejectedCount: 0,
      totalSpend: new Prisma.Decimal(0),
      openSpend: new Prisma.Decimal(0),
      receivedSpend: new Prisma.Decimal(0),
    };

    for (const po of orders) {
      summary.totalSpend = summary.totalSpend.plus(po.grandTotal);

      switch (po.status) {
        case PurchaseOrderStatus.DRAFT:
          summary.draftCount++;
          break;
        case PurchaseOrderStatus.SUBMITTED:
          summary.submittedCount++;
          break;
        case PurchaseOrderStatus.APPROVED:
          summary.approvedCount++;
          summary.openSpend = summary.openSpend.plus(po.grandTotal);
          break;
        case PurchaseOrderStatus.SENT:
          summary.sentCount++;
          summary.openSpend = summary.openSpend.plus(po.grandTotal);
          break;
        case PurchaseOrderStatus.ACKNOWLEDGED:
          summary.acknowledgedCount++;
          summary.openSpend = summary.openSpend.plus(po.grandTotal);
          break;
        case PurchaseOrderStatus.PARTIALLY_RECEIVED:
          summary.partiallyReceivedCount++;
          summary.openSpend = summary.openSpend.plus(po.grandTotal);
          break;
        case PurchaseOrderStatus.RECEIVED:
          summary.receivedCount++;
          summary.receivedSpend = summary.receivedSpend.plus(po.grandTotal);
          break;
        case PurchaseOrderStatus.CLOSED:
          summary.closedCount++;
          summary.receivedSpend = summary.receivedSpend.plus(po.grandTotal);
          break;
        case PurchaseOrderStatus.CANCELLED:
          summary.cancelledCount++;
          break;
        case PurchaseOrderStatus.REJECTED:
          summary.rejectedCount++;
          break;
      }
    }

    return summary;
  }

  /**
   * 2. Open Purchase Orders Report
   */
  async getOpenOrders(
    organizationId: string,
    query: ProcurementReportsQueryDto,
  ) {
    const where: Prisma.PurchaseOrderWhereInput = {
      organizationId,
      status: {
        in: [
          PurchaseOrderStatus.APPROVED,
          PurchaseOrderStatus.SENT,
          PurchaseOrderStatus.ACKNOWLEDGED,
          PurchaseOrderStatus.PARTIALLY_RECEIVED,
        ],
      },
    };

    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.startDate || query.endDate) {
      where.orderDate = {};
      if (query.startDate) where.orderDate.gte = new Date(query.startDate);
      if (query.endDate) where.orderDate.lte = new Date(query.endDate);
    }

    const openOrders = await this.prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        location: { select: { id: true, name: true, code: true } },
        currency: { select: { code: true, symbol: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true, name: true } },
          },
        },
      },
      orderBy: { orderDate: 'desc' },
    });

    return openOrders.map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      status: po.status,
      orderDate: po.orderDate,
      expectedDate: po.expectedDate,
      supplier: po.supplier,
      location: po.location,
      currency: po.currency.code,
      grandTotal: po.grandTotal.toString(),
      lines: po.lines.map((l) => ({
        itemId: l.itemId,
        itemSku: l.item.sku,
        itemName: l.item.name,
        variantSku: l.variant?.sku,
        orderedQuantity: l.quantity.toString(),
        receivedQuantity: l.receivedQuantity.toString(),
        cancelledQuantity: l.cancelledQuantity.toString(),
        remainingQuantity: l.remainingQuantity.toString(),
        unitPrice: l.unitPrice.toString(),
        lineTotal: l.lineTotal.toString(),
      })),
    }));
  }

  /**
   * 3. Supplier Purchase Report
   */
  async getSupplierPurchases(
    organizationId: string,
    query: ProcurementReportsQueryDto,
  ) {
    const where: Prisma.PurchaseOrderWhereInput = {
      organizationId,
      status: {
        notIn: [PurchaseOrderStatus.CANCELLED, PurchaseOrderStatus.REJECTED],
      },
    };

    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.startDate || query.endDate) {
      where.orderDate = {};
      if (query.startDate) where.orderDate.gte = new Date(query.startDate);
      if (query.endDate) where.orderDate.lte = new Date(query.endDate);
    }

    const pos = await this.prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        lines: true,
      },
    });

    const supplierMap = new Map<
      string,
      {
        supplierId: string;
        supplierCode: string;
        supplierName: string;
        orderCount: number;
        totalPurchaseValue: Prisma.Decimal;
        receivedValue: Prisma.Decimal;
        outstandingValue: Prisma.Decimal;
      }
    >();

    for (const po of pos) {
      let entry = supplierMap.get(po.supplierId);
      if (!entry) {
        entry = {
          supplierId: po.supplierId,
          supplierCode: po.supplier.code,
          supplierName: po.supplier.name,
          orderCount: 0,
          totalPurchaseValue: new Prisma.Decimal(0),
          receivedValue: new Prisma.Decimal(0),
          outstandingValue: new Prisma.Decimal(0),
        };
        supplierMap.set(po.supplierId, entry);
      }

      entry.orderCount++;
      entry.totalPurchaseValue = entry.totalPurchaseValue.plus(po.grandTotal);

      let poReceived = new Prisma.Decimal(0);
      let poOutstanding = new Prisma.Decimal(0);

      for (const line of po.lines) {
        const lineReceived = line.receivedQuantity.times(line.unitPrice);
        const lineOutstanding = line.remainingQuantity.times(line.unitPrice);
        poReceived = poReceived.plus(lineReceived);
        poOutstanding = poOutstanding.plus(lineOutstanding);
      }

      entry.receivedValue = entry.receivedValue.plus(poReceived);
      entry.outstandingValue = entry.outstandingValue.plus(poOutstanding);
    }

    return Array.from(supplierMap.values()).map((e) => ({
      supplierId: e.supplierId,
      supplierCode: e.supplierCode,
      supplierName: e.supplierName,
      orderCount: e.orderCount,
      totalPurchaseValue: e.totalPurchaseValue.toFixed(4),
      receivedValue: e.receivedValue.toFixed(4),
      outstandingValue: e.outstandingValue.toFixed(4),
    }));
  }

  /**
   * 4. Purchase Requisition Report
   */
  async getRequisitionReport(
    organizationId: string,
    query: ProcurementReportsQueryDto,
  ) {
    const where: Prisma.PurchaseRequisitionWhereInput = { organizationId };

    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.startDate || query.endDate) {
      where.requiredDate = {};
      if (query.startDate) where.requiredDate.gte = new Date(query.startDate);
      if (query.endDate) where.requiredDate.lte = new Date(query.endDate);
    }

    const prs = await this.prisma.purchaseRequisition.findMany({
      where,
      include: {
        department: { select: { code: true, name: true } },
        supplier: { select: { code: true, name: true } },
        location: { select: { code: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const counts = {
      draft: 0,
      submitted: 0,
      approved: 0,
      converted: 0,
      cancelled: 0,
      rejected: 0,
      total: prs.length,
    };

    for (const pr of prs) {
      switch (pr.status) {
        case PurchaseRequisitionStatus.DRAFT:
          counts.draft++;
          break;
        case PurchaseRequisitionStatus.SUBMITTED:
          counts.submitted++;
          break;
        case PurchaseRequisitionStatus.APPROVED:
          counts.approved++;
          break;
        case PurchaseRequisitionStatus.CONVERTED:
          counts.converted++;
          break;
        case PurchaseRequisitionStatus.CANCELLED:
          counts.cancelled++;
          break;
        case PurchaseRequisitionStatus.REJECTED:
          counts.rejected++;
          break;
      }
    }

    return {
      summary: counts,
      requisitions: prs.map((pr) => ({
        id: pr.id,
        requisitionNumber: pr.requisitionNumber,
        status: pr.status,
        requiredDate: pr.requiredDate,
        department: pr.department?.name,
        supplier: pr.supplier?.name,
        location: pr.location?.name,
        lineCount: pr._count.lines,
        createdAt: pr.createdAt,
      })),
    };
  }

  /**
   * 5. Goods Receipt Report
   */
  async getGoodsReceiptReport(
    organizationId: string,
    query: ProcurementReportsQueryDto,
  ) {
    const where: Prisma.GoodsReceiptWhereInput = { organizationId };

    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.startDate || query.endDate) {
      where.receivedAt = {};
      if (query.startDate) where.receivedAt.gte = new Date(query.startDate);
      if (query.endDate) where.receivedAt.lte = new Date(query.endDate);
    }

    const receipts = await this.prisma.goodsReceipt.findMany({
      where,
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
        purchaseOrder: { select: { id: true, poNumber: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true, name: true } },
          },
        },
      },
      orderBy: { receivedAt: 'desc' },
    });

    return receipts.map((gr) => ({
      id: gr.id,
      receiptNumber: gr.receiptNumber,
      status: gr.status,
      receivedAt: gr.receivedAt,
      poNumber: gr.purchaseOrder.poNumber,
      supplier: gr.supplier?.name,
      location: gr.location.name,
      lines: gr.lines.map((l) => ({
        itemId: l.itemId,
        sku: l.item.sku,
        name: l.item.name,
        quantity: l.quantity.toString(),
        unitCost: l.unitCost.toString(),
        totalCost: l.quantity.times(l.unitCost).toFixed(4),
      })),
    }));
  }

  /**
   * 6. Procurement Spend Report
   */
  async getSpendReport(
    organizationId: string,
    query: ProcurementReportsQueryDto,
  ) {
    const where: Prisma.PurchaseOrderWhereInput = {
      organizationId,
      status: {
        in: [
          PurchaseOrderStatus.APPROVED,
          PurchaseOrderStatus.SENT,
          PurchaseOrderStatus.ACKNOWLEDGED,
          PurchaseOrderStatus.PARTIALLY_RECEIVED,
          PurchaseOrderStatus.RECEIVED,
          PurchaseOrderStatus.CLOSED,
        ],
      },
    };

    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.startDate || query.endDate) {
      where.orderDate = {};
      if (query.startDate) where.orderDate.gte = new Date(query.startDate);
      if (query.endDate) where.orderDate.lte = new Date(query.endDate);
    }

    const pos = await this.prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        location: true,
        lines: {
          include: {
            item: { include: { category: true } },
          },
        },
      },
    });

    let totalSpend = new Prisma.Decimal(0);
    const groupMap = new Map<
      string,
      { key: string; spend: Prisma.Decimal; lineCount: number }
    >();

    for (const po of pos) {
      for (const line of po.lines) {
        const lineTotal = line.lineTotal;
        totalSpend = totalSpend.plus(lineTotal);

        let groupKey = 'All';
        if (query.groupBy === 'supplier') {
          groupKey = po.supplier.name;
        } else if (query.groupBy === 'item') {
          groupKey = line.item.name;
        } else if (query.groupBy === 'category') {
          groupKey = line.item.category?.name ?? 'Uncategorized';
        } else if (query.groupBy === 'location') {
          groupKey = po.location.name;
        } else if (query.groupBy === 'month') {
          groupKey = po.orderDate.toISOString().substring(0, 7);
        }

        let entry = groupMap.get(groupKey);
        if (!entry) {
          entry = { key: groupKey, spend: new Prisma.Decimal(0), lineCount: 0 };
          groupMap.set(groupKey, entry);
        }
        entry.spend = entry.spend.plus(lineTotal);
        entry.lineCount++;
      }
    }

    return {
      totalSpend: totalSpend.toFixed(4),
      breakdown: Array.from(groupMap.values()).map((e) => ({
        group: e.key,
        spend: e.spend.toFixed(4),
        lineCount: e.lineCount,
        percentage: totalSpend.greaterThan(0)
          ? e.spend.dividedBy(totalSpend).times(100).toNumber()
          : 0,
      })),
    };
  }
}
