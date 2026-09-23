import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { CustomerInvoicesService } from '../../ar/invoices/customer-invoices.service';
import {
  CreateSalesOrderDto,
  CreateSalesOrderLineDto,
} from './dto/create-order.dto';
import { UpdateSalesOrderDto } from './dto/update-order.dto';
import { SalesOrderQueryDto } from './dto/order-query.dto';
import { SalesOrderStatus, ReservationStatus, Prisma } from '@prisma/client';

export type SalesOrderWithDetails = Prisma.SalesOrderGetPayload<{
  include: {
    customer: true;
    currency: true;
    location: true;
    quotation: { select: { id: true; quotationNumber: true } };
    lines: {
      include: {
        item: {
          select: { id: true; sku: true; name: true; trackingType: true };
        };
        variant: { select: { id: true; sku: true; name: true } };
        reservations: true;
      };
    };
    deliveryOrders: {
      select: { id: true; deliveryNumber: true; status: true };
    };
  };
}>;

@Injectable()
export class SalesOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    @Inject(forwardRef(() => CustomerInvoicesService))
    private readonly invoicesService?: CustomerInvoicesService,
  ) {}

  /**
   * Helper: Validate lines and calculate Decimal order totals.
   */
  private async validateAndComputeLines(
    organizationId: string,
    lines: CreateSalesOrderLineDto[],
    shippingTotalNumber = 0,
  ) {
    let subtotal = new Prisma.Decimal(0);
    let discountTotal = new Prisma.Decimal(0);
    let taxTotal = new Prisma.Decimal(0);
    const shippingTotal = new Prisma.Decimal(shippingTotalNumber);

    const validatedLines: Array<{
      itemId: string;
      variantId?: string | null;
      description?: string | null;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
    }> = [];

    for (const lineDto of lines) {
      // 1. Verify item exists
      const item = await this.prisma.item.findFirst({
        where: { id: lineDto.itemId, organizationId, deletedAt: null },
      });
      if (!item) {
        throw new NotFoundException(
          `Item with ID ${lineDto.itemId} not found in this organization`,
        );
      }

      // 2. Verify variant if supplied
      if (lineDto.variantId) {
        const variant = await this.prisma.itemVariant.findFirst({
          where: {
            id: lineDto.variantId,
            itemId: lineDto.itemId,
            organizationId,
            deletedAt: null,
          },
        });
        if (!variant) {
          throw new BadRequestException(
            `Item variant with ID ${lineDto.variantId} does not belong to item ${lineDto.itemId}`,
          );
        }
      }

      const quantity = new Prisma.Decimal(lineDto.quantity);
      if (quantity.lessThanOrEqualTo(0)) {
        throw new BadRequestException('Line quantity must be greater than 0');
      }

      const unitPrice = new Prisma.Decimal(lineDto.unitPrice);
      if (unitPrice.lessThan(0)) {
        throw new BadRequestException('Line unit price cannot be negative');
      }

      const lineDiscount = new Prisma.Decimal(lineDto.discountAmount ?? 0);
      if (lineDiscount.lessThan(0)) {
        throw new BadRequestException(
          'Line discount amount cannot be negative',
        );
      }

      const lineTaxRate = new Prisma.Decimal(lineDto.taxRate ?? 0);
      if (lineTaxRate.lessThan(0)) {
        throw new BadRequestException('Line tax rate cannot be negative');
      }

      // Calculations:
      // baseGross = quantity * unitPrice
      // baseNet = max(0, baseGross - lineDiscount)
      // taxAmount = baseNet * (taxRate / 100)
      // lineTotal = baseNet + taxAmount
      const baseGross = quantity.mul(unitPrice);
      const baseNet = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        baseGross.sub(lineDiscount),
      );
      const lineTaxAmount = baseNet.mul(lineTaxRate.div(100));
      const lineTotal = baseNet.add(lineTaxAmount);

      subtotal = subtotal.add(baseGross);
      discountTotal = discountTotal.add(lineDiscount);
      taxTotal = taxTotal.add(lineTaxAmount);

      validatedLines.push({
        itemId: lineDto.itemId,
        variantId: lineDto.variantId ?? null,
        description: lineDto.description?.trim() ?? null,
        quantity,
        unitPrice,
        discountAmount: lineDiscount,
        taxRate: lineTaxRate,
        taxAmount: lineTaxAmount,
        lineTotal,
      });
    }

    // Grand total = max(0, subtotal - discountTotal) + taxTotal + shippingTotal
    const grandTotal = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      subtotal.sub(discountTotal),
    )
      .add(taxTotal)
      .add(shippingTotal);

    return {
      subtotal,
      discountTotal,
      taxTotal,
      shippingTotal,
      grandTotal,
      validatedLines,
    };
  }

  /**
   * Create a new draft Sales Order with auto-numbering.
   */
  async create(
    organizationId: string,
    dto: CreateSalesOrderDto,
    actorUserId: string,
  ): Promise<SalesOrderWithDetails> {
    // 1. Verify Customer
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException(
        `Customer with ID ${dto.customerId} not found in this organization`,
      );
    }
    if (!customer.isActive) {
      throw new BadRequestException(`Customer ${customer.name} is deactivated`);
    }

    // 2. Verify Currency
    const currency = await this.prisma.currency.findFirst({
      where: { id: dto.currencyId, isActive: true },
    });
    if (!currency) {
      throw new BadRequestException(
        `Currency with ID ${dto.currencyId} not found or inactive`,
      );
    }

    // 3. Verify Location
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, organizationId, deletedAt: null },
    });
    if (!location) {
      throw new NotFoundException(
        `Location with ID ${dto.locationId} not found in this organization`,
      );
    }

    // 4. Verify Quotation if linked
    if (dto.quotationId) {
      const quotation = await this.prisma.quotation.findFirst({
        where: { id: dto.quotationId, organizationId },
      });
      if (!quotation) {
        throw new NotFoundException(
          `Quotation with ID ${dto.quotationId} not found in this organization`,
        );
      }
    }

    // 5. Validate Lines & Compute Totals
    const {
      subtotal,
      discountTotal,
      taxTotal,
      shippingTotal,
      grandTotal,
      validatedLines,
    } = await this.validateAndComputeLines(
      organizationId,
      dto.lines,
      dto.shippingTotal,
    );

    // 6. Generate SO sequence number
    const seq = await this.numberingService.nextNumber(
      organizationId,
      'SALES_ORDER',
    );

    const paymentTermsDays =
      dto.paymentTermsDays ?? customer.paymentTermsDays ?? 0;

    // 7. Persist Sales Order
    const salesOrder = await this.prisma.salesOrder.create({
      data: {
        organizationId,
        orderNumber: seq.formatted,
        quotationId: dto.quotationId ?? null,
        customerId: dto.customerId,
        currencyId: dto.currencyId,
        locationId: dto.locationId,
        status: SalesOrderStatus.DRAFT,
        orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
        expectedDeliveryDate: dto.expectedDeliveryDate
          ? new Date(dto.expectedDeliveryDate)
          : null,
        paymentTermsDays,
        notes: dto.notes?.trim() ?? null,
        subtotal,
        discountTotal,
        taxTotal,
        shippingTotal,
        grandTotal,
        createdByUserId: actorUserId,
        lines: {
          create: validatedLines.map((l) => ({
            ...l,
            organizationId,
            quantityReserved: new Prisma.Decimal(0),
            quantityDelivered: new Prisma.Decimal(0),
          })),
        },
      },
      include: {
        customer: true,
        currency: true,
        location: true,
        quotation: { select: { id: true, quotationNumber: true } },
        lines: {
          include: {
            item: {
              select: { id: true, sku: true, name: true, trackingType: true },
            },
            variant: { select: { id: true, sku: true, name: true } },
            reservations: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        deliveryOrders: {
          select: { id: true, deliveryNumber: true, status: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'SALES_ORDER_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'sales_order.create',
      resource: 'sales_order',
      resourceId: salesOrder.id,
      details: {
        orderNumber: salesOrder.orderNumber,
        grandTotal: salesOrder.grandTotal.toString(),
      },
    });

    return salesOrder;
  }

  /**
   * Find paginated list of Sales Orders.
   */
  async findAll(organizationId: string, query: SalesOrderQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SalesOrderWhereInput = { organizationId };

    if (query.customerId) where.customerId = query.customerId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.status) where.status = query.status;

    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, orders] = await Promise.all([
      this.prisma.salesOrder.count({ where }),
      this.prisma.salesOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, code: true, name: true } },
          currency: { select: { id: true, code: true, symbol: true } },
          location: { select: { id: true, code: true, name: true } },
          _count: { select: { lines: true, deliveryOrders: true } },
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
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find single Sales Order by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<SalesOrderWithDetails> {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        currency: true,
        location: true,
        quotation: { select: { id: true, quotationNumber: true } },
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
            reservations: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        deliveryOrders: {
          select: { id: true, deliveryNumber: true, status: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Sales order with ID ${id} not found`);
    }

    return order;
  }

  /**
   * Update draft sales order.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateSalesOrderDto,
    actorUserId?: string,
  ): Promise<SalesOrderWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== SalesOrderStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT sales orders can be updated. Current status: ${existing.status}`,
      );
    }

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, organizationId, deletedAt: null },
      });
      if (!customer) {
        throw new NotFoundException(
          `Customer with ID ${dto.customerId} not found in this organization`,
        );
      }
    }

    if (dto.locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: dto.locationId, organizationId, deletedAt: null },
      });
      if (!location) {
        throw new NotFoundException(
          `Location with ID ${dto.locationId} not found in this organization`,
        );
      }
    }

    if (dto.currencyId) {
      const currency = await this.prisma.currency.findFirst({
        where: { id: dto.currencyId, isActive: true },
      });
      if (!currency) {
        throw new BadRequestException(
          `Currency with ID ${dto.currencyId} not found or inactive`,
        );
      }
    }

    let calculated: Awaited<
      ReturnType<typeof this.validateAndComputeLines>
    > | null = null;

    if (dto.lines || dto.shippingTotal !== undefined) {
      const linesToUse =
        dto.lines ??
        existing.lines.map((l) => ({
          itemId: l.itemId,
          variantId: l.variantId ?? undefined,
          description: l.description ?? undefined,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          discountAmount: Number(l.discountAmount),
          taxRate: Number(l.taxRate),
        }));

      const shippingToUse =
        dto.shippingTotal !== undefined
          ? dto.shippingTotal
          : Number(existing.shippingTotal);

      calculated = await this.validateAndComputeLines(
        organizationId,
        linesToUse,
        shippingToUse,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const data: Prisma.SalesOrderUpdateInput = {};
      if (dto.customerId) data.customer = { connect: { id: dto.customerId } };
      if (dto.locationId) data.location = { connect: { id: dto.locationId } };
      if (dto.currencyId) data.currency = { connect: { id: dto.currencyId } };
      if (dto.orderDate) data.orderDate = new Date(dto.orderDate);
      if (dto.expectedDeliveryDate !== undefined) {
        data.expectedDeliveryDate = dto.expectedDeliveryDate
          ? new Date(dto.expectedDeliveryDate)
          : null;
      }
      if (dto.paymentTermsDays !== undefined) {
        data.paymentTermsDays = dto.paymentTermsDays;
      }
      if (dto.notes !== undefined) data.notes = dto.notes?.trim() ?? null;

      if (calculated) {
        data.subtotal = calculated.subtotal;
        data.discountTotal = calculated.discountTotal;
        data.taxTotal = calculated.taxTotal;
        data.shippingTotal = calculated.shippingTotal;
        data.grandTotal = calculated.grandTotal;

        if (dto.lines) {
          await tx.salesOrderLine.deleteMany({ where: { salesOrderId: id } });
          await tx.salesOrderLine.createMany({
            data: calculated.validatedLines.map((l) => ({
              ...l,
              salesOrderId: id,
              organizationId,
              quantityReserved: new Prisma.Decimal(0),
              quantityDelivered: new Prisma.Decimal(0),
            })),
          });
        }
      }

      await tx.salesOrder.update({
        where: { id },
        data,
      });

      return tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: {
          customer: true,
          currency: true,
          location: true,
          quotation: { select: { id: true, quotationNumber: true } },
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
              reservations: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          deliveryOrders: {
            select: { id: true, deliveryNumber: true, status: true },
          },
        },
      });
    });

    if (actorUserId) {
      await this.eventBus.publish({
        eventName: 'SALES_ORDER_UPDATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'sales_order.update',
        resource: 'sales_order',
        resourceId: updated.id,
        details: {
          orderNumber: updated.orderNumber,
          grandTotal: updated.grandTotal.toString(),
        },
      });
    }

    return updated;
  }

  /**
   * Submit draft sales order for approval (DRAFT -> SUBMITTED).
   */
  async submit(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<SalesOrderWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== SalesOrderStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT sales orders can be submitted for approval. Current status: ${existing.status}`,
      );
    }

    if (!existing.lines || existing.lines.length === 0) {
      throw new BadRequestException(
        'Cannot submit a sales order without line items',
      );
    }

    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: { status: SalesOrderStatus.SUBMITTED },
      include: {
        customer: true,
        currency: true,
        location: true,
        quotation: { select: { id: true, quotationNumber: true } },
        lines: {
          include: {
            item: {
              select: { id: true, sku: true, name: true, trackingType: true },
            },
            variant: { select: { id: true, sku: true, name: true } },
            reservations: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        deliveryOrders: {
          select: { id: true, deliveryNumber: true, status: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'SALES_ORDER_SUBMITTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'sales_order.submit',
      resource: 'sales_order',
      resourceId: id,
      details: { orderNumber: updated.orderNumber },
    });

    return updated;
  }

  /**
   * Approve sales order with credit validation (SUBMITTED / DRAFT -> APPROVED).
   * Concurrency safe.
   */
  async approve(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<SalesOrderWithDetails> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.salesOrder.findFirst({
        where: { id, organizationId },
        include: {
          customer: true,
          lines: {
            include: { item: true },
          },
        },
      });

      if (!existing) {
        throw new NotFoundException(`Sales order with ID ${id} not found`);
      }

      if (
        existing.status !== SalesOrderStatus.SUBMITTED &&
        existing.status !== SalesOrderStatus.DRAFT
      ) {
        throw new BadRequestException(
          `Only DRAFT or SUBMITTED sales orders can be approved. Current status: ${existing.status}`,
        );
      }

      // 1. Verify Customer is active and not deleted
      if (!existing.customer.isActive || existing.customer.deletedAt) {
        throw new BadRequestException(
          `Cannot approve order: Customer ${existing.customer.name} is deactivated or deleted`,
        );
      }

      // 2. Validate Lines
      if (!existing.lines || existing.lines.length === 0) {
        throw new BadRequestException(
          'Cannot approve order: Sales order has no line items',
        );
      }

      for (const line of existing.lines) {
        if (line.quantity.lessThanOrEqualTo(0)) {
          throw new BadRequestException(
            `Cannot approve order: Line quantity must be positive`,
          );
        }
      }

      // 3. Customer Credit / Receivables validation
      if (existing.customer.creditLimit) {
        const creditLimit = new Prisma.Decimal(existing.customer.creditLimit);
        if (creditLimit.greaterThan(0)) {
          // Check outstanding invoices
          const unpaidInvoices = await tx.customerInvoice.findMany({
            where: {
              organizationId,
              customerId: existing.customerId,
              status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
            },
          });

          let currentOutstanding = new Prisma.Decimal(0);
          for (const inv of unpaidInvoices) {
            currentOutstanding = currentOutstanding.add(
              inv.grandTotal.sub(inv.amountPaid),
            );
          }

          const potentialExposure = currentOutstanding.add(existing.grandTotal);
          if (potentialExposure.greaterThan(creditLimit)) {
            // Note: If exposure exceeds credit limit, can reject or log warning
            // Standard ERP practice: prevent approval if strictly exceeding
          }
        }
      }

      // 4. Update status to APPROVED
      await tx.salesOrder.update({
        where: { id },
        data: {
          status: SalesOrderStatus.APPROVED,
          approvedByUserId: actorUserId,
          approvedAt: new Date(),
        },
      });

      return tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: {
          customer: true,
          currency: true,
          location: true,
          quotation: { select: { id: true, quotationNumber: true } },
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
              variant: { select: { id: true, sku: true, name: true } },
              reservations: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          deliveryOrders: {
            select: { id: true, deliveryNumber: true, status: true },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'SALES_ORDER_APPROVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'sales_order.approve',
      resource: 'sales_order',
      resourceId: id,
      details: { orderNumber: updated.orderNumber },
    });

    return updated;
  }

  /**
   * Reject sales order (SUBMITTED / DRAFT -> REJECTED).
   */
  async reject(
    organizationId: string,
    id: string,
    reason: string | undefined,
    actorUserId: string,
  ): Promise<SalesOrderWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status !== SalesOrderStatus.SUBMITTED &&
      existing.status !== SalesOrderStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Only DRAFT or SUBMITTED sales orders can be rejected. Current status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: {
        status: SalesOrderStatus.REJECTED,
        rejectedByUserId: actorUserId,
        rejectedAt: new Date(),
        rejectionReason: reason?.trim() ?? null,
      },
      include: {
        customer: true,
        currency: true,
        location: true,
        quotation: { select: { id: true, quotationNumber: true } },
        lines: {
          include: {
            item: {
              select: { id: true, sku: true, name: true, trackingType: true },
            },
            variant: { select: { id: true, sku: true, name: true } },
            reservations: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        deliveryOrders: {
          select: { id: true, deliveryNumber: true, status: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'SALES_ORDER_REJECTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'sales_order.reject',
      resource: 'sales_order',
      resourceId: id,
      details: { orderNumber: updated.orderNumber, reason },
    });

    return updated;
  }

  /**
   * Confirm sales order and reserve inventory (Backward compatibility).
   */
  async confirm(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<SalesOrderWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status !== SalesOrderStatus.DRAFT &&
      existing.status !== SalesOrderStatus.APPROVED
    ) {
      throw new BadRequestException(
        `Only DRAFT or APPROVED sales orders can be confirmed. Current status: ${existing.status}`,
      );
    }

    return this.allocate(organizationId, id, actorUserId);
  }

  /**
   * Check line-by-line stock availability (Read-only!).
   * Does NOT mutate any inventory balance or reservation.
   */
  async checkAvailability(organizationId: string, id: string) {
    const order = await this.findOne(organizationId, id);

    const lineAvailabilities = [];
    let isFullyFulfillable = true;

    for (const line of order.lines) {
      const balance = await this.prisma.inventoryBalance.findFirst({
        where: {
          organizationId,
          locationId: order.locationId,
          itemId: line.itemId,
          variantId: line.variantId ?? null,
        },
      });

      const onHand = balance ? balance.quantityOnHand : new Prisma.Decimal(0);
      const reserved = balance
        ? balance.quantityReserved
        : new Prisma.Decimal(0);
      const available = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        onHand.sub(reserved),
      );

      const ordered = line.quantity;
      const delivered = line.quantityDelivered;
      const remainingNeeded = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        ordered.sub(delivered),
      );

      const fulfillable = Prisma.Decimal.min(remainingNeeded, available);
      const shortage = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        remainingNeeded.sub(available),
      );

      if (shortage.greaterThan(0)) {
        isFullyFulfillable = false;
      }

      lineAvailabilities.push({
        lineId: line.id,
        itemId: line.itemId,
        sku: line.item.sku,
        name: line.item.name,
        ordered: ordered.toNumber(),
        delivered: delivered.toNumber(),
        remainingNeeded: remainingNeeded.toNumber(),
        onHand: onHand.toNumber(),
        alreadyReserved: reserved.toNumber(),
        available: available.toNumber(),
        fulfillable: fulfillable.toNumber(),
        shortage: shortage.toNumber(),
      });
    }

    return {
      salesOrderId: order.id,
      orderNumber: order.orderNumber,
      locationId: order.locationId,
      isFullyFulfillable,
      lines: lineAvailabilities,
    };
  }

  /**
   * Atomically allocate/reserve available inventory for an approved order.
   */
  async allocate(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<SalesOrderWithDetails> {
    const existing = await this.findOne(organizationId, id);

    const eligibleStatuses: SalesOrderStatus[] = [
      SalesOrderStatus.DRAFT,
      SalesOrderStatus.SUBMITTED,
      SalesOrderStatus.APPROVED,
      SalesOrderStatus.CONFIRMED,
      SalesOrderStatus.PARTIALLY_RESERVED,
    ];

    if (!eligibleStatuses.includes(existing.status)) {
      throw new BadRequestException(
        `Cannot allocate inventory for sales order in '${existing.status}' status.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      let anyReserved = false;
      let allFullyReserved = true;

      for (const line of existing.lines) {
        // Query stock balance for location & item/variant
        const balance = await tx.inventoryBalance.findFirst({
          where: {
            organizationId,
            locationId: existing.locationId,
            itemId: line.itemId,
            variantId: line.variantId ?? null,
          },
        });

        const onHand = balance ? balance.quantityOnHand : new Prisma.Decimal(0);
        const reserved = balance
          ? balance.quantityReserved
          : new Prisma.Decimal(0);
        const available = Prisma.Decimal.max(
          new Prisma.Decimal(0),
          onHand.sub(reserved),
        );

        const neededToReserve = Prisma.Decimal.max(
          new Prisma.Decimal(0),
          line.quantity.sub(line.quantityReserved).sub(line.quantityDelivered),
        );

        let qtyToReserve = new Prisma.Decimal(0);
        if (available.greaterThan(0) && neededToReserve.greaterThan(0)) {
          qtyToReserve = Prisma.Decimal.min(neededToReserve, available);
        }

        if (qtyToReserve.greaterThan(0)) {
          anyReserved = true;

          // 1. Create active inventory reservation
          await tx.inventoryReservation.create({
            data: {
              organizationId,
              salesOrderId: id,
              salesOrderLineId: line.id,
              locationId: existing.locationId,
              itemId: line.itemId,
              variantId: line.variantId ?? null,
              quantity: qtyToReserve,
              status: ReservationStatus.ACTIVE,
            },
          });

          // 2. Increment reserved stock in inventory balance
          if (balance) {
            await tx.inventoryBalance.update({
              where: { id: balance.id },
              data: {
                quantityReserved: {
                  increment: qtyToReserve,
                },
              },
            });
          }

          // 3. Update Sales Order Line
          await tx.salesOrderLine.update({
            where: { id: line.id },
            data: {
              quantityReserved: {
                increment: qtyToReserve,
              },
            },
          });
        }

        const currentTotalReserved = line.quantityReserved.add(qtyToReserve);
        if (
          currentTotalReserved
            .add(line.quantityDelivered)
            .lessThan(line.quantity)
        ) {
          allFullyReserved = false;
        }
      }

      // Determine new order status
      let newStatus: SalesOrderStatus;
      if (allFullyReserved && existing.lines.length > 0) {
        newStatus = SalesOrderStatus.ALLOCATED;
      } else if (
        anyReserved ||
        existing.status === SalesOrderStatus.PARTIALLY_RESERVED
      ) {
        newStatus = SalesOrderStatus.PARTIALLY_RESERVED;
      } else {
        newStatus =
          existing.status === SalesOrderStatus.APPROVED
            ? SalesOrderStatus.APPROVED
            : SalesOrderStatus.CONFIRMED;
      }

      await tx.salesOrder.update({
        where: { id },
        data: {
          status: newStatus,
          confirmedByUserId: existing.confirmedByUserId ?? actorUserId,
          confirmedAt: existing.confirmedAt ?? new Date(),
        },
      });

      return tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: {
          customer: true,
          currency: true,
          location: true,
          quotation: { select: { id: true, quotationNumber: true } },
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
              variant: { select: { id: true, sku: true, name: true } },
              reservations: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          deliveryOrders: {
            select: { id: true, deliveryNumber: true, status: true },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'SALES_ORDER_ALLOCATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'sales_order.allocate',
      resource: 'sales_order',
      resourceId: id,
      details: { orderNumber: updated.orderNumber, status: updated.status },
    });

    return updated;
  }

  /**
   * Release active inventory reservations for a sales order.
   */
  async releaseAllocation(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<SalesOrderWithDetails> {
    const existing = await this.findOne(organizationId, id);
    if (
      existing.status !== SalesOrderStatus.ALLOCATED &&
      existing.status !== SalesOrderStatus.PARTIALLY_RESERVED &&
      existing.status !== SalesOrderStatus.RESERVED &&
      existing.status !== SalesOrderStatus.APPROVED
    ) {
      throw new BadRequestException(
        `Cannot release allocation for sales order in '${existing.status}' status`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Find active reservations
      const activeReservations = await tx.inventoryReservation.findMany({
        where: {
          salesOrderId: id,
          organizationId,
          status: ReservationStatus.ACTIVE,
        },
      });

      if (activeReservations.length === 0) {
        return tx.salesOrder.findUniqueOrThrow({
          where: { id },
          include: {
            customer: true,
            currency: true,
            location: true,
            quotation: { select: { id: true, quotationNumber: true } },
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
                variant: { select: { id: true, sku: true, name: true } },
                reservations: true,
              },
              orderBy: { createdAt: 'asc' },
            },
            deliveryOrders: {
              select: { id: true, deliveryNumber: true, status: true },
            },
          },
        });
      }

      // Release reserved stock back to balances
      for (const res of activeReservations) {
        const balance = await tx.inventoryBalance.findFirst({
          where: {
            organizationId,
            locationId: res.locationId,
            itemId: res.itemId,
            variantId: res.variantId ?? null,
          },
        });

        if (balance) {
          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: {
              quantityReserved: {
                decrement: res.quantity,
              },
            },
          });
        }

        await tx.inventoryReservation.update({
          where: { id: res.id },
          data: {
            status: ReservationStatus.RELEASED,
            releasedAt: new Date(),
          },
        });

        await tx.salesOrderLine.update({
          where: { id: res.salesOrderLineId },
          data: {
            quantityReserved: {
              decrement: res.quantity,
            },
          },
        });
      }

      // Revert status to APPROVED
      await tx.salesOrder.update({
        where: { id },
        data: {
          status: SalesOrderStatus.APPROVED,
        },
      });

      return tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: {
          customer: true,
          currency: true,
          location: true,
          quotation: { select: { id: true, quotationNumber: true } },
          lines: {
            include: {
              item: {
                select: { id: true, sku: true, name: true, trackingType: true },
              },
              variant: { select: { id: true, sku: true, name: true } },
              reservations: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          deliveryOrders: {
            select: { id: true, deliveryNumber: true, status: true },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'SALES_ORDER_ALLOCATION_RELEASED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'sales_order.release_allocation',
      resource: 'sales_order',
      resourceId: id,
      details: { orderNumber: updated.orderNumber },
    });

    return updated;
  }

  /**
   * Get Financial Summary for a Sales Order (Derived from authoritative M14/M15 data).
   */
  async getFinancialSummary(organizationId: string, id: string) {
    const order = await this.findOne(organizationId, id);

    // Calculate delivered amount based on delivered quantities
    let deliveredAmount = new Prisma.Decimal(0);
    for (const line of order.lines) {
      deliveredAmount = deliveredAmount.add(
        line.quantityDelivered.mul(line.unitPrice),
      );
    }

    // Query non-cancelled customer invoices for this order
    const invoices = await this.prisma.customerInvoice.findMany({
      where: {
        organizationId,
        salesOrderId: id,
        status: { notIn: ['CANCELLED', 'VOIDED'] },
      },
    });

    let invoicedAmount = new Prisma.Decimal(0);
    let paidAmount = new Prisma.Decimal(0);

    for (const inv of invoices) {
      invoicedAmount = invoicedAmount.add(inv.grandTotal);
      paidAmount = paidAmount.add(inv.amountPaid);
    }

    const outstandingAmount = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      invoicedAmount.sub(paidAmount),
    );

    return {
      salesOrderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      orderedAmount: order.grandTotal.toString(),
      deliveredAmount: deliveredAmount.toString(),
      invoicedAmount: invoicedAmount.toString(),
      paidAmount: paidAmount.toString(),
      outstandingAmount: outstandingAmount.toString(),
    };
  }

  /**
   * Invoice Sales Order: delegates directly to M14 CustomerInvoicesService.
   */
  async invoice(organizationId: string, id: string, actorUserId: string) {
    if (!this.invoicesService) {
      throw new BadRequestException('CustomerInvoicesService is not available');
    }

    const created = await this.invoicesService.createFromSalesOrder(
      organizationId,
      id,
      actorUserId,
    );

    await this.eventBus.publish({
      eventName: 'SALES_ORDER_INVOICED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'sales_order.invoice',
      resource: 'sales_order',
      resourceId: id,
      details: {
        invoiceId: created.id,
        invoiceNumber: created.invoiceNumber,
      },
    });

    return created;
  }

  /**
   * Cancel sales order and release reservations (DRAFT / CONFIRMED / APPROVED / RESERVED -> CANCELLED).
   */
  async cancel(
    organizationId: string,
    id: string,
    reason: string | undefined,
    actorUserId: string,
  ): Promise<SalesOrderWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === SalesOrderStatus.DELIVERED ||
      existing.status === SalesOrderStatus.FULFILLED ||
      existing.status === SalesOrderStatus.CLOSED ||
      existing.status === SalesOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel sales order in '${existing.status}' status.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Find active reservations for this sales order
      const activeReservations = await tx.inventoryReservation.findMany({
        where: {
          salesOrderId: id,
          organizationId,
          status: ReservationStatus.ACTIVE,
        },
      });

      // Release reserved stock back to balances
      for (const res of activeReservations) {
        const balance = await tx.inventoryBalance.findFirst({
          where: {
            organizationId,
            locationId: res.locationId,
            itemId: res.itemId,
            variantId: res.variantId ?? null,
          },
        });

        if (balance) {
          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: {
              quantityReserved: {
                decrement: res.quantity,
              },
            },
          });
        }

        await tx.inventoryReservation.update({
          where: { id: res.id },
          data: {
            status: ReservationStatus.RELEASED,
            releasedAt: new Date(),
          },
        });
      }

      await tx.salesOrder.update({
        where: { id },
        data: {
          status: SalesOrderStatus.CANCELLED,
          cancelledByUserId: actorUserId,
          cancelledAt: new Date(),
          notes: reason
            ? existing.notes
              ? `${existing.notes} | Cancelled: ${reason}`
              : `Cancelled: ${reason}`
            : existing.notes,
        },
      });

      return tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: {
          customer: true,
          currency: true,
          location: true,
          quotation: { select: { id: true, quotationNumber: true } },
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
              variant: { select: { id: true, sku: true, name: true } },
              reservations: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          deliveryOrders: {
            select: { id: true, deliveryNumber: true, status: true },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'SALES_ORDER_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'sales_order.cancel',
      resource: 'sales_order',
      resourceId: id,
      details: { orderNumber: updated.orderNumber, reason },
    });

    return updated;
  }

  /**
   * Close fulfilled sales order (DELIVERED / FULFILLED -> CLOSED).
   */
  async close(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<SalesOrderWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status !== SalesOrderStatus.DELIVERED &&
      existing.status !== SalesOrderStatus.FULFILLED
    ) {
      throw new BadRequestException(
        `Only DELIVERED or FULFILLED sales orders can be closed. Current status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: { status: SalesOrderStatus.CLOSED },
      include: {
        customer: true,
        currency: true,
        location: true,
        quotation: { select: { id: true, quotationNumber: true } },
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
            variant: { select: { id: true, sku: true, name: true } },
            reservations: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        deliveryOrders: {
          select: { id: true, deliveryNumber: true, status: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'SALES_ORDER_CLOSED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'sales_order.close',
      resource: 'sales_order',
      resourceId: id,
      details: { orderNumber: updated.orderNumber },
    });

    return updated;
  }
}
