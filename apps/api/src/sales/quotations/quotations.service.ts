import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import {
  CreateQuotationDto,
  CreateQuotationLineDto,
} from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationQueryDto } from './dto/quotation-query.dto';
import {
  Quotation,
  QuotationStatus,
  SalesOrderStatus,
  Prisma,
} from '@prisma/client';

export type QuotationWithDetails = Prisma.QuotationGetPayload<{
  include: {
    customer: true;
    currency: true;
    location: true;
    lines: {
      include: {
        item: {
          select: { id: true; sku: true; name: true; trackingType: true };
        };
        variant: { select: { id: true; sku: true; name: true } };
      };
    };
    salesOrders: {
      select: { id: true; orderNumber: true; status: true; grandTotal: true };
    };
  };
}>;

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * Helper: Calculate quotation totals with precise Decimal arithmetic.
   */
  private async validateAndComputeLines(
    organizationId: string,
    lines: CreateQuotationLineDto[],
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
        throw new BadRequestException('Line unit price must be non-negative');
      }

      const discountAmount = new Prisma.Decimal(lineDto.discountAmount ?? 0);
      if (discountAmount.lessThan(0)) {
        throw new BadRequestException(
          'Line discount amount must be non-negative',
        );
      }

      const taxRate = new Prisma.Decimal(lineDto.taxRate ?? 0);
      if (taxRate.lessThan(0)) {
        throw new BadRequestException('Line tax rate must be non-negative');
      }

      const lineGross = quantity.mul(unitPrice);
      const lineTaxable = lineGross.sub(discountAmount);
      const lineTax = lineTaxable.mul(taxRate);
      const lineTotal = lineTaxable.add(lineTax);

      subtotal = subtotal.add(lineGross);
      discountTotal = discountTotal.add(discountAmount);
      taxTotal = taxTotal.add(lineTax);

      validatedLines.push({
        itemId: lineDto.itemId,
        variantId: lineDto.variantId ?? null,
        description: lineDto.description?.trim() ?? null,
        quantity,
        unitPrice,
        discountAmount,
        taxRate,
        taxAmount: lineTax,
        lineTotal,
      });
    }

    const grandTotal = subtotal
      .sub(discountTotal)
      .add(taxTotal)
      .add(shippingTotal);

    return {
      validatedLines,
      subtotal,
      discountTotal,
      taxTotal,
      shippingTotal,
      grandTotal,
    };
  }

  /**
   * Create a new draft quotation.
   */
  async create(
    organizationId: string,
    dto: CreateQuotationDto,
    actorUserId: string,
  ): Promise<QuotationWithDetails> {
    // 1. Verify Customer
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException(
        `Customer with ID ${dto.customerId} not found in this organization`,
      );
    }

    // 2. Verify Location
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, organizationId, deletedAt: null },
    });
    if (!location) {
      throw new NotFoundException(
        `Location with ID ${dto.locationId} not found in this organization`,
      );
    }

    // 3. Verify Currency
    const currency = await this.prisma.currency.findFirst({
      where: { id: dto.currencyId, isActive: true },
    });
    if (!currency) {
      throw new BadRequestException(
        `Currency with ID ${dto.currencyId} not found or inactive`,
      );
    }

    // 4. Validate Lines & Compute Totals
    const {
      validatedLines,
      subtotal,
      discountTotal,
      taxTotal,
      shippingTotal,
      grandTotal,
    } = await this.validateAndComputeLines(
      organizationId,
      dto.lines,
      dto.shippingTotal ?? 0,
    );

    // 5. Generate Quotation Number
    let quotationNumber: string;
    try {
      const generated = await this.numberingService.nextNumber(
        organizationId,
        'QUOTATION',
        actorUserId,
      );
      quotationNumber = generated.formatted;
    } catch {
      const count = await this.prisma.quotation.count({
        where: { organizationId },
      });
      quotationNumber = `QT-${String(count + 1).padStart(6, '0')}`;
    }

    // 6. Create in transaction
    const quotation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.quotation.create({
        data: {
          organizationId,
          quotationNumber,
          customerId: dto.customerId,
          currencyId: dto.currencyId,
          locationId: dto.locationId,
          status: QuotationStatus.DRAFT,
          quotationDate: dto.quotationDate
            ? new Date(dto.quotationDate)
            : new Date(),
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          notes: dto.notes ? dto.notes.trim() : null,
          subtotal,
          discountTotal,
          taxTotal,
          shippingTotal,
          grandTotal,
          createdByUserId: actorUserId,
        },
      });

      await tx.quotationLine.createMany({
        data: validatedLines.map((l) => ({
          ...l,
          quotationId: created.id,
          organizationId,
        })),
      });

      return tx.quotation.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          customer: true,
          currency: true,
          location: true,
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
          salesOrders: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              grandTotal: true,
            },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'QUOTATION_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'quotation.create',
      resource: 'quotation',
      resourceId: quotation.id,
      details: {
        quotationNumber: quotation.quotationNumber,
        grandTotal: quotation.grandTotal.toString(),
      },
    });

    return quotation;
  }

  /**
   * List quotations with pagination and search.
   */
  async findAll(
    organizationId: string,
    query: QuotationQueryDto,
  ): Promise<{
    quotations: Quotation[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.QuotationWhereInput = { organizationId };

    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.search) {
      where.OR = [
        { quotationNumber: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, quotations] = await Promise.all([
      this.prisma.quotation.count({ where }),
      this.prisma.quotation.findMany({
        where,
        include: {
          customer: {
            select: { id: true, code: true, name: true },
          },
          currency: {
            select: { id: true, code: true, symbol: true },
          },
          location: {
            select: { id: true, code: true, name: true },
          },
          _count: {
            select: { lines: true, salesOrders: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      quotations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find single quotation by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<QuotationWithDetails> {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        currency: true,
        location: true,
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
        salesOrders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            grandTotal: true,
          },
        },
      },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation with ID ${id} not found`);
    }

    return quotation;
  }

  /**
   * Update draft quotation.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateQuotationDto,
    actorUserId: string,
  ): Promise<QuotationWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== QuotationStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT quotations can be updated. Current status: ${existing.status}`,
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
      const data: Prisma.QuotationUpdateInput = {};
      if (dto.customerId) data.customer = { connect: { id: dto.customerId } };
      if (dto.locationId) data.location = { connect: { id: dto.locationId } };
      if (dto.currencyId) data.currency = { connect: { id: dto.currencyId } };
      if (dto.quotationDate) data.quotationDate = new Date(dto.quotationDate);
      if (dto.validUntil !== undefined) {
        data.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
      }
      if (dto.notes !== undefined) data.notes = dto.notes?.trim() ?? null;

      if (calculated) {
        data.subtotal = calculated.subtotal;
        data.discountTotal = calculated.discountTotal;
        data.taxTotal = calculated.taxTotal;
        data.shippingTotal = calculated.shippingTotal;
        data.grandTotal = calculated.grandTotal;

        if (dto.lines) {
          await tx.quotationLine.deleteMany({ where: { quotationId: id } });
          await tx.quotationLine.createMany({
            data: calculated.validatedLines.map((l) => ({
              ...l,
              quotationId: id,
              organizationId,
            })),
          });
        }
      }

      await tx.quotation.update({
        where: { id },
        data,
      });

      return tx.quotation.findUniqueOrThrow({
        where: { id },
        include: {
          customer: true,
          currency: true,
          location: true,
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
          salesOrders: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              grandTotal: true,
            },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'QUOTATION_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'quotation.update',
      resource: 'quotation',
      resourceId: updated.id,
      details: {
        quotationNumber: updated.quotationNumber,
        grandTotal: updated.grandTotal.toString(),
      },
    });

    return updated;
  }

  /**
   * Send quotation (DRAFT -> SENT).
   */
  async send(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<QuotationWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== QuotationStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT quotations can be sent. Current status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: { status: QuotationStatus.SENT },
      include: {
        customer: true,
        currency: true,
        location: true,
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
        salesOrders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            grandTotal: true,
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'QUOTATION_SENT',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'quotation.send',
      resource: 'quotation',
      resourceId: id,
      details: { quotationNumber: updated.quotationNumber },
    });

    return updated;
  }

  /**
   * Accept quotation (SENT -> ACCEPTED).
   */
  async accept(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<QuotationWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== QuotationStatus.SENT) {
      throw new BadRequestException(
        `Only SENT quotations can be accepted. Current status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: { status: QuotationStatus.ACCEPTED },
      include: {
        customer: true,
        currency: true,
        location: true,
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
        salesOrders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            grandTotal: true,
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'QUOTATION_ACCEPTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'quotation.accept',
      resource: 'quotation',
      resourceId: id,
      details: { quotationNumber: updated.quotationNumber },
    });

    return updated;
  }

  /**
   * Reject quotation (SENT -> REJECTED).
   */
  async reject(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<QuotationWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== QuotationStatus.SENT) {
      throw new BadRequestException(
        `Only SENT quotations can be rejected. Current status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: { status: QuotationStatus.REJECTED },
      include: {
        customer: true,
        currency: true,
        location: true,
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
        salesOrders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            grandTotal: true,
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'QUOTATION_REJECTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'quotation.reject',
      resource: 'quotation',
      resourceId: id,
      details: { quotationNumber: updated.quotationNumber },
    });

    return updated;
  }

  /**
   * Cancel quotation (DRAFT | SENT -> CANCELLED).
   */
  async cancel(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<QuotationWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status !== QuotationStatus.DRAFT &&
      existing.status !== QuotationStatus.SENT
    ) {
      throw new BadRequestException(
        `Only DRAFT or SENT quotations can be cancelled. Current status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: { status: QuotationStatus.CANCELLED },
      include: {
        customer: true,
        currency: true,
        location: true,
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
        salesOrders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            grandTotal: true,
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'QUOTATION_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'quotation.cancel',
      resource: 'quotation',
      resourceId: id,
      details: { quotationNumber: updated.quotationNumber },
    });

    return updated;
  }

  /**
   * Convert accepted quotation to Sales Order (ACCEPTED -> CONVERTED).
   * Idempotent: once CONVERTED, cannot convert again.
   */
  async convert(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<any> {
    const quotation = await this.findOne(organizationId, id);

    if (quotation.status !== QuotationStatus.ACCEPTED) {
      throw new BadRequestException(
        `Only ACCEPTED quotations can be converted to a Sales Order. Current status: ${quotation.status}`,
      );
    }

    // Generate Sales Order Number
    let orderNumber: string;
    try {
      const generated = await this.numberingService.nextNumber(
        organizationId,
        'SALES_ORDER',
        actorUserId,
      );
      orderNumber = generated.formatted;
    } catch {
      const count = await this.prisma.salesOrder.count({
        where: { organizationId },
      });
      orderNumber = `SO-${String(count + 1).padStart(6, '0')}`;
    }

    const salesOrder = await this.prisma.$transaction(async (tx) => {
      // 1. Create Sales Order
      const createdOrder = await tx.salesOrder.create({
        data: {
          organizationId,
          orderNumber,
          quotationId: quotation.id,
          customerId: quotation.customerId,
          currencyId: quotation.currencyId,
          locationId: quotation.locationId,
          status: SalesOrderStatus.DRAFT,
          orderDate: new Date(),
          paymentTermsDays: quotation.customer.paymentTermsDays,
          notes: quotation.notes
            ? `Converted from quotation ${quotation.quotationNumber}. ${quotation.notes}`
            : `Converted from quotation ${quotation.quotationNumber}`,
          subtotal: quotation.subtotal,
          discountTotal: quotation.discountTotal,
          taxTotal: quotation.taxTotal,
          shippingTotal: quotation.shippingTotal,
          grandTotal: quotation.grandTotal,
          createdByUserId: actorUserId,
        },
      });

      // 2. Create Sales Order Lines
      await tx.salesOrderLine.createMany({
        data: quotation.lines.map((l) => ({
          salesOrderId: createdOrder.id,
          organizationId,
          itemId: l.itemId,
          variantId: l.variantId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountAmount: l.discountAmount,
          taxRate: l.taxRate,
          taxAmount: l.taxAmount,
          lineTotal: l.lineTotal,
          quantityReserved: new Prisma.Decimal(0),
          quantityDelivered: new Prisma.Decimal(0),
        })),
      });

      // 3. Mark Quotation as CONVERTED
      await tx.quotation.update({
        where: { id },
        data: { status: QuotationStatus.CONVERTED },
      });

      return tx.salesOrder.findUniqueOrThrow({
        where: { id: createdOrder.id },
        include: {
          customer: true,
          currency: true,
          location: true,
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
      eventName: 'QUOTATION_CONVERTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'quotation.convert',
      resource: 'quotation',
      resourceId: id,
      details: {
        quotationNumber: quotation.quotationNumber,
        salesOrderId: salesOrder.id,
        salesOrderNumber: salesOrder.orderNumber,
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
        quotationId: quotation.id,
        grandTotal: salesOrder.grandTotal.toString(),
      },
    });

    return salesOrder;
  }
}
