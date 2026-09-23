import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import {
  CreatePurchaseOrderDto,
  CreatePurchaseOrderLineDto,
} from './dto/create-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-order.dto';
import { PurchaseOrderQueryDto } from './dto/order-query.dto';
import { PurchaseOrderStatus, Prisma } from '@prisma/client';

export type PurchaseOrderWithDetails = Prisma.PurchaseOrderGetPayload<{
  include: {
    supplier: { select: { id: true; code: true; name: true; email: true } };
    location: { select: { id: true; code: true; name: true } };
    currency: { select: { id: true; code: true; name: true; symbol: true } };
    lines: {
      include: {
        item: {
          select: { id: true; sku: true; name: true; trackingType: true };
        };
        variant: { select: { id: true; sku: true; name: true } };
      };
    };
  };
}>;

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * List purchase orders with filters and pagination.
   */
  async findAll(organizationId: string, query: PurchaseOrderQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseOrderWhereInput = {
      organizationId,
    };

    if (query.status) {
      where.status = query.status;
    }
    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }
    if (query.locationId) {
      where.locationId = query.locationId;
    }
    if (query.search) {
      const searchNormalized = query.search.trim();
      where.OR = [
        { poNumber: { contains: searchNormalized, mode: 'insensitive' } },
        { notes: { contains: searchNormalized, mode: 'insensitive' } },
      ];
    }

    const [total, orders] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: {
            select: { id: true, code: true, name: true, email: true },
          },
          location: {
            select: { id: true, code: true, name: true },
          },
          currency: {
            select: { id: true, code: true, name: true, symbol: true },
          },
          _count: {
            select: { lines: true, goodsReceipts: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find single purchase order by ID with complete lines and tracking relations.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<PurchaseOrderWithDetails> {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        supplier: {
          select: { id: true, code: true, name: true, email: true },
        },
        location: {
          select: { id: true, code: true, name: true },
        },
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
        lines: {
          include: {
            item: {
              select: {
                id: true,
                sku: true,
                name: true,
                trackingType: true,
              },
            },
            variant: {
              select: { id: true, sku: true, name: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Purchase order with ID ${id} not found in organization`,
      );
    }

    return order;
  }

  /**
   * Create a new draft purchase order.
   */
  async create(
    organizationId: string,
    dto: CreatePurchaseOrderDto,
    actorUserId: string,
  ): Promise<PurchaseOrderWithDetails> {
    // 1. Validate Supplier
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: dto.supplierId,
        organizationId,
        isActive: true,
        deletedAt: null,
      },
    });
    if (!supplier) {
      throw new NotFoundException(
        `Supplier with ID ${dto.supplierId} not found or inactive`,
      );
    }

    // 2. Validate Location
    const location = await this.prisma.location.findFirst({
      where: {
        id: dto.locationId,
        organizationId,
        isActive: true,
        deletedAt: null,
      },
    });
    if (!location) {
      throw new NotFoundException(
        `Location with ID ${dto.locationId} not found or inactive`,
      );
    }

    // 3. Validate Currency
    const currency = await this.prisma.currency.findFirst({
      where: {
        id: dto.currencyId,
        isActive: true,
      },
    });
    if (!currency) {
      throw new NotFoundException(
        `Currency with ID ${dto.currencyId} not found or inactive`,
      );
    }

    // 4. Validate and calculate Lines
    const { validatedLines, subtotal, discountTotal, taxTotal, grandTotal } =
      await this.calculateLines(
        organizationId,
        dto.lines,
        dto.shippingTotal ?? 0,
      );

    // 5. Generate PO Number
    let poNumber: string;
    try {
      const generated = await this.numberingService.nextNumber(
        organizationId,
        'PURCHASE_ORDER',
        actorUserId,
      );
      poNumber = generated.formatted;
    } catch {
      const count = await this.prisma.purchaseOrder.count({
        where: { organizationId },
      });
      poNumber = `PO-${String(count + 1).padStart(6, '0')}`;
    }

    // 6. Create in transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.purchaseOrder.create({
        data: {
          organizationId,
          poNumber,
          supplierId: dto.supplierId,
          locationId: dto.locationId,
          currencyId: dto.currencyId,
          status: PurchaseOrderStatus.DRAFT,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
          paymentTermsDays:
            dto.paymentTermsDays ?? supplier.paymentTermsDays ?? 0,
          shippingTotal: new Prisma.Decimal(dto.shippingTotal ?? 0),
          subtotal,
          discountTotal,
          taxTotal,
          grandTotal,
          notes: dto.notes ? dto.notes.trim() : null,
          createdByUserId: actorUserId,
        },
      });

      await tx.purchaseOrderLine.createMany({
        data: validatedLines.map((l) => ({
          ...l,
          purchaseOrderId: created.id,
          organizationId,
        })),
      });

      return tx.purchaseOrder.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          supplier: {
            select: { id: true, code: true, name: true, email: true },
          },
          location: {
            select: { id: true, code: true, name: true },
          },
          currency: {
            select: { id: true, code: true, name: true, symbol: true },
          },
          lines: {
            include: {
              item: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  trackingType: true,
                },
              },
              variant: {
                select: { id: true, sku: true, name: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_ORDER_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'purchase_order.create',
      resource: 'purchase_order',
      resourceId: order.id,
      details: {
        poNumber: order.poNumber,
        grandTotal: order.grandTotal.toString(),
      },
    });

    return order;
  }

  /**
   * Update draft purchase order.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdatePurchaseOrderDto,
    actorUserId: string,
  ): Promise<PurchaseOrderWithDetails> {
    const existing = await this.prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: { lines: true },
    });

    if (!existing) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }

    if (existing.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT purchase orders can be modified. Current status: ${existing.status}`,
      );
    }

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: {
          id: dto.supplierId,
          organizationId,
          isActive: true,
          deletedAt: null,
        },
      });
      if (!supplier) {
        throw new NotFoundException(
          `Supplier with ID ${dto.supplierId} not found or inactive`,
        );
      }
    }

    if (dto.locationId) {
      const location = await this.prisma.location.findFirst({
        where: {
          id: dto.locationId,
          organizationId,
          isActive: true,
          deletedAt: null,
        },
      });
      if (!location) {
        throw new NotFoundException(
          `Location with ID ${dto.locationId} not found or inactive`,
        );
      }
    }

    if (dto.currencyId) {
      const currency = await this.prisma.currency.findFirst({
        where: { id: dto.currencyId, isActive: true },
      });
      if (!currency) {
        throw new NotFoundException(
          `Currency with ID ${dto.currencyId} not found or inactive`,
        );
      }
    }

    const shippingTotal =
      dto.shippingTotal !== undefined
        ? new Prisma.Decimal(dto.shippingTotal)
        : existing.shippingTotal;

    const updated = await this.prisma.$transaction(async (tx) => {
      let subtotal = existing.subtotal;
      let discountTotal = existing.discountTotal;
      let taxTotal = existing.taxTotal;
      let grandTotal = existing.grandTotal;

      if (dto.lines && dto.lines.length > 0) {
        const calc = await this.calculateLines(
          organizationId,
          dto.lines,
          shippingTotal,
        );
        subtotal = calc.subtotal;
        discountTotal = calc.discountTotal;
        taxTotal = calc.taxTotal;
        grandTotal = calc.grandTotal;

        // Replace lines
        await tx.purchaseOrderLine.deleteMany({
          where: { purchaseOrderId: id, organizationId },
        });

        await tx.purchaseOrderLine.createMany({
          data: calc.validatedLines.map((l) => ({
            ...l,
            purchaseOrderId: id,
            organizationId,
          })),
        });
      } else if (dto.shippingTotal !== undefined) {
        grandTotal = subtotal
          .minus(discountTotal)
          .plus(taxTotal)
          .plus(shippingTotal);
      }

      await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: dto.supplierId,
          locationId: dto.locationId,
          currencyId: dto.currencyId,
          expectedDate:
            dto.expectedDate !== undefined
              ? dto.expectedDate
                ? new Date(dto.expectedDate)
                : null
              : undefined,
          paymentTermsDays: dto.paymentTermsDays,
          shippingTotal,
          subtotal,
          discountTotal,
          taxTotal,
          grandTotal,
          notes:
            dto.notes !== undefined
              ? dto.notes
                ? dto.notes.trim()
                : null
              : undefined,
        },
      });

      return tx.purchaseOrder.findUniqueOrThrow({
        where: { id },
        include: {
          supplier: {
            select: { id: true, code: true, name: true, email: true },
          },
          location: {
            select: { id: true, code: true, name: true },
          },
          currency: {
            select: { id: true, code: true, name: true, symbol: true },
          },
          lines: {
            include: {
              item: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  trackingType: true,
                },
              },
              variant: {
                select: { id: true, sku: true, name: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_ORDER_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'purchase_order.update',
      resource: 'purchase_order',
      resourceId: updated.id,
      details: {
        poNumber: updated.poNumber,
        grandTotal: updated.grandTotal.toString(),
      },
    });

    return updated;
  }

  /**
   * Submit purchase order (DRAFT -> SUBMITTED).
   */
  async submit(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<PurchaseOrderWithDetails> {
    const existing = await this.prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }

    if (existing.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT purchase orders can be submitted. Current status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.SUBMITTED },
      include: {
        supplier: {
          select: { id: true, code: true, name: true, email: true },
        },
        location: {
          select: { id: true, code: true, name: true },
        },
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
        lines: {
          include: {
            item: {
              select: {
                id: true,
                sku: true,
                name: true,
                trackingType: true,
              },
            },
            variant: {
              select: { id: true, sku: true, name: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_ORDER_SUBMITTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'purchase_order.submit',
      resource: 'purchase_order',
      resourceId: updated.id,
      details: { poNumber: updated.poNumber },
    });

    return updated;
  }

  /**
   * Approve purchase order (SUBMITTED -> APPROVED).
   */
  async approve(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<PurchaseOrderWithDetails> {
    const existing = await this.prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }

    if (existing.status !== PurchaseOrderStatus.SUBMITTED) {
      throw new BadRequestException(
        `Only SUBMITTED purchase orders can be approved. Current status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.APPROVED,
        approvedByUserId: actorUserId,
        approvedAt: new Date(),
      },
      include: {
        supplier: {
          select: { id: true, code: true, name: true, email: true },
        },
        location: {
          select: { id: true, code: true, name: true },
        },
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
        lines: {
          include: {
            item: {
              select: {
                id: true,
                sku: true,
                name: true,
                trackingType: true,
              },
            },
            variant: {
              select: { id: true, sku: true, name: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_ORDER_APPROVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'purchase_order.approve',
      resource: 'purchase_order',
      resourceId: updated.id,
      details: { poNumber: updated.poNumber },
    });

    return updated;
  }

  /**
   * Cancel purchase order (from SUBMITTED, APPROVED, or PARTIALLY_RECEIVED).
   */
  async cancel(
    organizationId: string,
    id: string,
    reason?: string,
    actorUserId?: string,
  ): Promise<PurchaseOrderWithDetails> {
    const existing = await this.prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }

    const cancellableStatuses: PurchaseOrderStatus[] = [
      PurchaseOrderStatus.DRAFT,
      PurchaseOrderStatus.SUBMITTED,
      PurchaseOrderStatus.APPROVED,
      PurchaseOrderStatus.PARTIALLY_RECEIVED,
    ];

    if (!cancellableStatuses.includes(existing.status)) {
      throw new BadRequestException(
        `Cannot cancel purchase order with status: ${existing.status}`,
      );
    }

    const notes = reason
      ? existing.notes
        ? `${existing.notes} | Cancel reason: ${reason.trim()}`
        : `Cancel reason: ${reason.trim()}`
      : existing.notes;

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.CANCELLED,
        notes,
      },
      include: {
        supplier: {
          select: { id: true, code: true, name: true, email: true },
        },
        location: {
          select: { id: true, code: true, name: true },
        },
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
        lines: {
          include: {
            item: {
              select: {
                id: true,
                sku: true,
                name: true,
                trackingType: true,
              },
            },
            variant: {
              select: { id: true, sku: true, name: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_ORDER_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'purchase_order.cancel',
      resource: 'purchase_order',
      resourceId: updated.id,
      details: { poNumber: updated.poNumber, reason },
    });

    return updated;
  }

  /**
   * Close purchase order (from RECEIVED -> CLOSED).
   */
  async close(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<PurchaseOrderWithDetails> {
    const existing = await this.prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }

    if (existing.status !== PurchaseOrderStatus.RECEIVED) {
      throw new BadRequestException(
        `Only fully RECEIVED purchase orders can be closed. Current status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.CLOSED },
      include: {
        supplier: {
          select: { id: true, code: true, name: true, email: true },
        },
        location: {
          select: { id: true, code: true, name: true },
        },
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
        lines: {
          include: {
            item: {
              select: {
                id: true,
                sku: true,
                name: true,
                trackingType: true,
              },
            },
            variant: {
              select: { id: true, sku: true, name: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_ORDER_CLOSED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'purchase_order.close',
      resource: 'purchase_order',
      resourceId: updated.id,
      details: { poNumber: updated.poNumber },
    });

    return updated;
  }

  /**
   * Helper: Validate and calculate line totals and header financial totals with high Decimal precision.
   */
  private async calculateLines(
    organizationId: string,
    lines: CreatePurchaseOrderLineDto[],
    shippingTotalInput: string | number | Prisma.Decimal,
  ) {
    let subtotal = new Prisma.Decimal(0);
    let discountTotal = new Prisma.Decimal(0);
    let taxTotal = new Prisma.Decimal(0);
    const shippingTotal = new Prisma.Decimal(shippingTotalInput);

    if (shippingTotal.isNegative()) {
      throw new BadRequestException('Shipping total cannot be negative');
    }

    const validatedLines: Array<{
      itemId: string;
      variantId: string | null;
      description: string | null;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
    }> = [];

    for (const line of lines) {
      const quantity = new Prisma.Decimal(line.quantity);
      const unitPrice = new Prisma.Decimal(line.unitPrice);
      const discountAmount = new Prisma.Decimal(line.discountAmount ?? 0);
      const taxRate = new Prisma.Decimal(line.taxRate ?? 0);

      if (quantity.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          'Line item quantity must be strictly greater than 0',
        );
      }
      if (unitPrice.isNegative()) {
        throw new BadRequestException(
          'Line item unit price cannot be negative',
        );
      }
      if (discountAmount.isNegative()) {
        throw new BadRequestException('Line item discount cannot be negative');
      }
      if (taxRate.isNegative()) {
        throw new BadRequestException('Line item tax rate cannot be negative');
      }

      // Verify item in tenant
      const item = await this.prisma.item.findFirst({
        where: {
          id: line.itemId,
          organizationId,
          isActive: true,
          deletedAt: null,
        },
      });

      if (!item) {
        throw new NotFoundException(
          `Item with ID ${line.itemId} not found or inactive in organization`,
        );
      }

      // Verify variant if provided
      if (line.variantId) {
        const variant = await this.prisma.itemVariant.findFirst({
          where: {
            id: line.variantId,
            itemId: line.itemId,
            organizationId,
            isActive: true,
            deletedAt: null,
          },
        });

        if (!variant) {
          throw new BadRequestException(
            `Variant '${line.variantId}' does not belong to item '${line.itemId}' or is inactive`,
          );
        }
      }

      const baseAmount = quantity.times(unitPrice);
      const taxableAmount = Prisma.Decimal.max(
        0,
        baseAmount.minus(discountAmount),
      );
      const taxAmount = taxableAmount.times(taxRate);
      const lineTotal = baseAmount.minus(discountAmount).plus(taxAmount);

      subtotal = subtotal.plus(baseAmount);
      discountTotal = discountTotal.plus(discountAmount);
      taxTotal = taxTotal.plus(taxAmount);

      validatedLines.push({
        itemId: line.itemId,
        variantId: line.variantId ?? null,
        description: line.description?.trim() ?? null,
        quantity,
        unitPrice,
        discountAmount,
        taxRate,
        taxAmount,
        lineTotal,
      });
    }

    const grandTotal = subtotal
      .minus(discountTotal)
      .plus(taxTotal)
      .plus(shippingTotal);

    return {
      validatedLines,
      subtotal,
      discountTotal,
      taxTotal,
      grandTotal,
    };
  }
}
