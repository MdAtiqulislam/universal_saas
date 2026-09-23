import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { Prisma, SupplierInvoiceStatus } from '@prisma/client';

export type MatchingStatus =
  | 'MATCHED'
  | 'QUANTITY_VARIANCE'
  | 'PRICE_VARIANCE'
  | 'OVER_INVOICED'
  | 'UNLINKED';

export interface LineMatchingDetail {
  invoiceLineId: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  invoiceQuantity: number;
  invoiceUnitPrice: number;
  orderedQuantity?: number;
  poUnitPrice?: number;
  receivedQuantity?: number;
  previouslyInvoicedQuantity: number;
  availableToInvoiceQuantity?: number;
  quantityVariance: number;
  priceVariance: number;
  status: MatchingStatus;
  message?: string;
}

export interface MatchingReport {
  invoiceId: string;
  invoiceNumber: string;
  purchaseOrderId?: string | null;
  goodsReceiptId?: string | null;
  overallStatus: MatchingStatus;
  canApprove: boolean;
  lines: LineMatchingDetail[];
}

@Injectable()
export class AccountsPayableMatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Perform 3-way matching between Supplier Invoice, Purchase Order, and Goods Receipt.
   */
  async matchInvoice(
    organizationId: string,
    invoiceId: string,
    actorUserId?: string,
  ): Promise<MatchingReport> {
    const invoice = await this.prisma.supplierInvoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: {
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            purchaseOrderLine: true,
            goodsReceiptLine: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        purchaseOrder: {
          include: {
            lines: true,
          },
        },
        goodsReceipt: {
          include: {
            lines: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(
        `Supplier invoice with ID ${invoiceId} not found in this organization.`,
      );
    }

    const lineReports: LineMatchingDetail[] = [];
    let hasOverInvoicing = false;
    let hasQuantityVariance = false;
    let hasPriceVariance = false;
    let hasUnlinked = false;

    for (const line of invoice.lines) {
      const invQty = new Prisma.Decimal(line.quantity);
      const invPrice = new Prisma.Decimal(line.unitPrice);

      if (!line.purchaseOrderLineId) {
        hasUnlinked = true;
        lineReports.push({
          invoiceLineId: line.id,
          itemId: line.itemId,
          itemSku: line.item.sku,
          itemName: line.item.name,
          invoiceQuantity: invQty.toNumber(),
          invoiceUnitPrice: invPrice.toNumber(),
          previouslyInvoicedQuantity: 0,
          quantityVariance: 0,
          priceVariance: 0,
          status: 'UNLINKED',
          message: 'Invoice line is not linked to a Purchase Order line.',
        });
        continue;
      }

      // Calculate previously invoiced quantity from other non-cancelled/non-voided invoices
      const otherInvoicedLines = await this.prisma.supplierInvoiceLine.findMany(
        {
          where: {
            organizationId,
            purchaseOrderLineId: line.purchaseOrderLineId,
            supplierInvoiceId: { not: invoiceId },
            supplierInvoice: {
              status: {
                notIn: [
                  SupplierInvoiceStatus.CANCELLED,
                  SupplierInvoiceStatus.VOIDED,
                ],
              },
            },
          },
          select: { quantity: true },
        },
      );

      const previouslyInvoiced = otherInvoicedLines.reduce(
        (sum, l) => sum.add(new Prisma.Decimal(l.quantity)),
        new Prisma.Decimal(0),
      );

      const poLine = line.purchaseOrderLine;
      const grLine = line.goodsReceiptLine;

      const orderedQty = poLine
        ? new Prisma.Decimal(poLine.quantity)
        : undefined;
      const poPrice = poLine ? new Prisma.Decimal(poLine.unitPrice) : undefined;
      const receivedQty = grLine
        ? new Prisma.Decimal(grLine.quantity)
        : poLine
          ? new Prisma.Decimal(poLine.receivedQuantity)
          : undefined;

      // Available to invoice is bounded by ordered quantity (or received if GR is linked)
      const maxAllowed =
        receivedQty !== undefined ? receivedQty : (orderedQty ?? invQty);
      const availableToInvoice = Prisma.Decimal.max(
        0,
        maxAllowed.sub(previouslyInvoiced),
      );

      let lineStatus: MatchingStatus = 'MATCHED';
      let message: string | undefined;

      const totalInvoicedCandidate = previouslyInvoiced.add(invQty);

      if (totalInvoicedCandidate.greaterThan(maxAllowed)) {
        lineStatus = 'OVER_INVOICED';
        hasOverInvoicing = true;
        message = `Invoiced quantity (${invQty.toString()}) exceeds remaining allowable quantity (${availableToInvoice.toString()}). Max allowed: ${maxAllowed.toString()}, previously invoiced: ${previouslyInvoiced.toString()}.`;
      } else if (
        receivedQty !== undefined &&
        invQty.greaterThan(receivedQty.sub(previouslyInvoiced))
      ) {
        lineStatus = 'QUANTITY_VARIANCE';
        hasQuantityVariance = true;
        message = `Invoiced quantity (${invQty.toString()}) exceeds received quantity (${receivedQty.toString()}).`;
      } else if (poPrice && !invPrice.equals(poPrice)) {
        lineStatus = 'PRICE_VARIANCE';
        hasPriceVariance = true;
        message = `Invoice unit price (${invPrice.toString()}) does not match PO unit price (${poPrice.toString()}).`;
      }

      lineReports.push({
        invoiceLineId: line.id,
        itemId: line.itemId,
        itemSku: line.item.sku,
        itemName: line.item.name,
        invoiceQuantity: invQty.toNumber(),
        invoiceUnitPrice: invPrice.toNumber(),
        orderedQuantity: orderedQty?.toNumber(),
        poUnitPrice: poPrice?.toNumber(),
        receivedQuantity: receivedQty?.toNumber(),
        previouslyInvoicedQuantity: previouslyInvoiced.toNumber(),
        availableToInvoiceQuantity: availableToInvoice.toNumber(),
        quantityVariance: orderedQty ? invQty.sub(orderedQty).toNumber() : 0,
        priceVariance: poPrice ? invPrice.sub(poPrice).toNumber() : 0,
        status: lineStatus,
        message,
      });
    }

    let overallStatus: MatchingStatus = 'MATCHED';
    if (hasOverInvoicing) overallStatus = 'OVER_INVOICED';
    else if (hasQuantityVariance) overallStatus = 'QUANTITY_VARIANCE';
    else if (hasPriceVariance) overallStatus = 'PRICE_VARIANCE';
    else if (hasUnlinked) overallStatus = 'UNLINKED';

    const report: MatchingReport = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      purchaseOrderId: invoice.purchaseOrderId,
      goodsReceiptId: invoice.goodsReceiptId,
      overallStatus,
      canApprove: !hasOverInvoicing,
      lines: lineReports,
    };

    await this.eventBus.publish({
      eventName: 'AP_MATCHING_PERFORMED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'ap_matching.evaluate',
      resource: 'supplier_invoice',
      resourceId: invoice.id,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        overallStatus,
        canApprove: report.canApprove,
      },
    });

    return report;
  }
}
