import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface CustomerReturnEligibilityItem {
  itemId: string;
  variantId?: string | null;
  sourceLineId?: string | null;
  deliveredQuantity: DecimalValue;
  previouslyReturnedQuantity: DecimalValue;
  eligibleReturnQuantity: DecimalValue;
  unitPrice: DecimalValue;
  taxAmount: DecimalValue;
}

type DecimalValue = Prisma.Decimal | number | string;

@Injectable()
export class CustomerReturnsService {
  private readonly logger = new Logger(CustomerReturnsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate and calculate customer return eligibility.
   */
  async validateEligibility(
    organizationId: string,
    params: {
      customerId: string;
      salesOrderId?: string;
      deliveryOrderId?: string;
      shipmentId?: string;
      customerInvoiceId?: string;
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
      deliveredQuantity: Prisma.Decimal;
      previouslyReturnedQuantity: Prisma.Decimal;
      eligibleReturnQuantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      lineAmount: Prisma.Decimal;
    }>;
  }> {
    // 1. Validate Customer
    const customer = await this.prisma.customer.findFirst({
      where: { id: params.customerId, organizationId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException(
        `Customer with ID ${params.customerId} not found in this organization.`,
      );
    }
    if (!customer.isActive) {
      throw new BadRequestException(`Customer '${customer.name}' is inactive.`);
    }

    // 2. Validate Sales Order if provided
    if (params.salesOrderId) {
      const salesOrder = await this.prisma.salesOrder.findFirst({
        where: {
          id: params.salesOrderId,
          organizationId,
          customerId: params.customerId,
        },
      });
      if (!salesOrder) {
        throw new BadRequestException(
          `Sales Order ${params.salesOrderId} not found for this customer and organization.`,
        );
      }
    }

    // 3. Validate Delivery Order if provided
    if (params.deliveryOrderId) {
      const deliveryOrder = await this.prisma.deliveryOrder.findFirst({
        where: {
          id: params.deliveryOrderId,
          organizationId,
          customerId: params.customerId,
        },
      });
      if (!deliveryOrder) {
        throw new BadRequestException(
          `Delivery Order ${params.deliveryOrderId} not found for this customer and organization.`,
        );
      }
    }

    // 4. Validate Shipment if provided
    if (params.shipmentId) {
      const shipment = await this.prisma.shipment.findFirst({
        where: {
          id: params.shipmentId,
          organizationId,
          customerId: params.customerId,
        },
      });
      if (!shipment) {
        throw new BadRequestException(
          `Shipment ${params.shipmentId} not found for this customer and organization.`,
        );
      }
    }

    // 5. Validate Line Items and Returnable Quantities
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

      // Calculate delivered quantity from Delivery Orders or Sales Orders
      let deliveredQty = new Prisma.Decimal(0);
      let unitPrice = new Prisma.Decimal(0);
      let taxAmount = new Prisma.Decimal(0);

      if (params.deliveryOrderId) {
        const doLine = await this.prisma.deliveryOrderLine.findFirst({
          where: {
            organizationId,
            deliveryOrderId: params.deliveryOrderId,
            ...(line.sourceLineId ? { id: line.sourceLineId } : {}),
            salesOrderLine: {
              itemId: line.itemId,
              variantId: line.variantId ?? undefined,
            },
          },
          include: { salesOrderLine: true },
        });

        if (doLine) {
          deliveredQty = new Prisma.Decimal(doLine.quantity);
          unitPrice = new Prisma.Decimal(doLine.salesOrderLine.unitPrice);
          taxAmount = new Prisma.Decimal(doLine.salesOrderLine.taxAmount);
        }
      } else if (params.salesOrderId) {
        const soLine = await this.prisma.salesOrderLine.findFirst({
          where: {
            organizationId,
            salesOrderId: params.salesOrderId,
            itemId: line.itemId,
            variantId: line.variantId ?? undefined,
            ...(line.sourceLineId ? { id: line.sourceLineId } : {}),
          },
        });

        if (soLine) {
          deliveredQty = new Prisma.Decimal(soLine.quantityDelivered);
          unitPrice = new Prisma.Decimal(soLine.unitPrice);
          taxAmount = new Prisma.Decimal(soLine.taxAmount);
        }
      } else {
        // Direct item return: delivered qty is bounded by reqQty if no source document is strictly mandated
        deliveredQty = reqQty;
      }

      // Calculate previously authorized or returned quantities for this customer/item/source
      const previousReturns = await this.prisma.returnRequestLine.findMany({
        where: {
          organizationId,
          itemId: line.itemId,
          variantId: line.variantId ?? undefined,
          sourceLineId: line.sourceLineId ?? undefined,
          returnRequest: {
            customerId: params.customerId,
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

      // If source document is provided, enforce delivered quantity boundary
      if (params.deliveryOrderId || params.salesOrderId) {
        const eligibleQty = deliveredQty.minus(previouslyReturned);
        if (reqQty.greaterThan(eligibleQty)) {
          throw new BadRequestException(
            `Requested return quantity (${reqQty.toString()}) exceeds eligible returnable quantity (${eligibleQty.toString()}) for item ${item.sku}. Delivered: ${deliveredQty.toString()}, Prior Returns: ${previouslyReturned.toString()}.`,
          );
        }
      }

      const lineAmount = reqQty.times(unitPrice).plus(taxAmount);

      validatedLines.push({
        itemId: line.itemId,
        variantId: line.variantId ?? null,
        sourceLineId: line.sourceLineId ?? null,
        requestedQuantity: reqQty,
        deliveredQuantity: deliveredQty,
        previouslyReturnedQuantity: previouslyReturned,
        eligibleReturnQuantity: deliveredQty.minus(previouslyReturned),
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
