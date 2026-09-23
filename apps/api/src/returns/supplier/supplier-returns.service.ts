import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SupplierReturnsService {
  private readonly logger = new Logger(SupplierReturnsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate and calculate supplier return eligibility.
   */
  async validateEligibility(
    organizationId: string,
    params: {
      supplierId: string;
      purchaseOrderId?: string;
      goodsReceiptId?: string;
      supplierInvoiceId?: string;
      lines: Array<{
        itemId: string;
        variantId?: string | null;
        sourceLineId?: string | null;
        requestedQuantity: number | Prisma.Decimal;
      }>;
    },
  ): Promise<{
    isValid: boolean;
    validatedLines: Array<{
      itemId: string;
      variantId?: string | null;
      sourceLineId?: string | null;
      requestedQuantity: Prisma.Decimal;
      receivedQuantity: Prisma.Decimal;
      previouslyReturnedQuantity: Prisma.Decimal;
      eligibleReturnQuantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      lineAmount: Prisma.Decimal;
    }>;
  }> {
    // 1. Validate Supplier
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: params.supplierId, organizationId, deletedAt: null },
    });
    if (!supplier) {
      throw new NotFoundException(
        `Supplier with ID ${params.supplierId} not found in this organization.`,
      );
    }
    if (!supplier.isActive) {
      throw new BadRequestException(`Supplier '${supplier.name}' is inactive.`);
    }

    // 2. Validate Purchase Order if provided
    if (params.purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findFirst({
        where: {
          id: params.purchaseOrderId,
          organizationId,
          supplierId: params.supplierId,
        },
      });
      if (!po) {
        throw new BadRequestException(
          `Purchase Order ${params.purchaseOrderId} not found for this supplier and organization.`,
        );
      }
    }

    // 3. Validate Goods Receipt if provided
    if (params.goodsReceiptId) {
      const gr = await this.prisma.goodsReceipt.findFirst({
        where: {
          id: params.goodsReceiptId,
          organizationId,
          supplierId: params.supplierId,
        },
      });
      if (!gr) {
        throw new BadRequestException(
          `Goods Receipt ${params.goodsReceiptId} not found for this supplier and organization.`,
        );
      }
    }

    // 4. Validate Line Items and Returnable Quantities
    const validatedLines = [];

    for (const line of params.lines) {
      const item = await this.prisma.item.findFirst({
        where: { id: line.itemId, organizationId, deletedAt: null },
      });
      if (!item) {
        throw new NotFoundException(
          `Item with ID ${line.itemId} not found in this organization.`,
        );
      }

      const reqQty = new Prisma.Decimal(line.requestedQuantity);
      if (reqQty.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          `Requested return quantity must be strictly positive for item ${item.sku}.`,
        );
      }

      // Calculate received quantity from Goods Receipts or PO lines
      let receivedQty = new Prisma.Decimal(0);
      let unitPrice = new Prisma.Decimal(0);
      let taxAmount = new Prisma.Decimal(0);

      if (params.goodsReceiptId) {
        const grLine = await this.prisma.goodsReceiptLine.findFirst({
          where: {
            organizationId,
            goodsReceiptId: params.goodsReceiptId,
            itemId: line.itemId,
            variantId: line.variantId ?? undefined,
            ...(line.sourceLineId ? { id: line.sourceLineId } : {}),
          },
          include: { purchaseOrderLine: true },
        });

        if (grLine) {
          receivedQty = new Prisma.Decimal(grLine.quantity);
          unitPrice = new Prisma.Decimal(grLine.purchaseOrderLine.unitPrice);
          taxAmount = new Prisma.Decimal(grLine.purchaseOrderLine.taxAmount);
        }
      } else if (params.purchaseOrderId) {
        const poLine = await this.prisma.purchaseOrderLine.findFirst({
          where: {
            organizationId,
            purchaseOrderId: params.purchaseOrderId,
            itemId: line.itemId,
            variantId: line.variantId ?? undefined,
            ...(line.sourceLineId ? { id: line.sourceLineId } : {}),
          },
        });

        if (poLine) {
          receivedQty = new Prisma.Decimal(poLine.receivedQuantity);
          unitPrice = new Prisma.Decimal(poLine.unitPrice);
          taxAmount = new Prisma.Decimal(poLine.taxAmount);
        }
      } else {
        receivedQty = reqQty;
      }

      // Calculate previously returned quantities for this supplier/item
      const previousReturns = await this.prisma.returnRequestLine.findMany({
        where: {
          organizationId,
          itemId: line.itemId,
          variantId: line.variantId ?? undefined,
          sourceLineId: line.sourceLineId ?? undefined,
          returnRequest: {
            supplierId: params.supplierId,
            status: { notIn: ['REJECTED', 'CANCELLED', 'VOIDED'] },
          },
        },
      });

      const previouslyReturned = previousReturns.reduce(
        (sum, r) =>
          sum.plus(
            new Prisma.Decimal(r.authorizedQuantity || r.requestedQuantity),
          ),
        new Prisma.Decimal(0),
      );

      if (params.goodsReceiptId || params.purchaseOrderId) {
        const eligibleQty = receivedQty.minus(previouslyReturned);
        if (reqQty.greaterThan(eligibleQty)) {
          throw new BadRequestException(
            `Requested return quantity (${reqQty.toString()}) exceeds eligible returnable quantity (${eligibleQty.toString()}) for item ${item.sku}. Received: ${receivedQty.toString()}, Prior Returns: ${previouslyReturned.toString()}.`,
          );
        }
      }

      const lineAmount = reqQty.times(unitPrice).plus(taxAmount);

      validatedLines.push({
        itemId: line.itemId,
        variantId: line.variantId ?? null,
        sourceLineId: line.sourceLineId ?? null,
        requestedQuantity: reqQty,
        receivedQuantity: receivedQty,
        previouslyReturnedQuantity: previouslyReturned,
        eligibleReturnQuantity: receivedQty.minus(previouslyReturned),
        unitPrice,
        taxAmount,
        lineAmount,
      });
    }

    return {
      isValid: true,
      validatedLines,
    };
  }
}
