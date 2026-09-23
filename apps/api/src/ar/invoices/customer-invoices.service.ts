import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../../ap/account-mapping/ap-account-mapping.service';
import {
  CreateCustomerInvoiceDto,
  CreateCustomerInvoiceLineDto,
} from './dto/create-customer-invoice.dto';
import { UpdateCustomerInvoiceDto } from './dto/update-customer-invoice.dto';
import { CustomerInvoiceQueryDto } from './dto/customer-invoice-query.dto';
import {
  CustomerInvoice,
  CustomerInvoiceStatus,
  JournalEntryStatus,
  FiscalPeriodStatus,
  SalesOrderStatus,
  DeliveryOrderStatus,
  Prisma,
} from '@prisma/client';

export type CustomerInvoiceWithDetails = Prisma.CustomerInvoiceGetPayload<{
  include: {
    customer: {
      select: {
        id: true;
        code: true;
        name: true;
        paymentTermsDays: true;
        currencyId: true;
      };
    };
    currency: {
      select: { id: true; code: true; name: true; symbol: true };
    };
    salesOrder: {
      select: { id: true; orderNumber: true; status: true };
    };
    deliveryOrder: {
      select: { id: true; deliveryNumber: true; status: true };
    };
    lines: {
      include: {
        item: { select: { id: true; sku: true; name: true } };
        variant: { select: { id: true; sku: true; name: true } };
        salesOrderLine: {
          select: { id: true; quantity: true; unitPrice: true };
        };
      };
    };
  };
}>;

@Injectable()
export class CustomerInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly accountMappingService: ApAccountMappingService,
  ) {}

  /**
   * Calculate due date from invoice date and payment terms days.
   */
  private computeDueDate(invoiceDate: Date, paymentTermsDays: number): Date {
    const due = new Date(invoiceDate);
    due.setDate(due.getDate() + paymentTermsDays);
    return due;
  }

  /**
   * Helper: Validate and compute exact monetary totals for invoice lines.
   */
  private async validateAndComputeLines(
    organizationId: string,
    lines: CreateCustomerInvoiceLineDto[],
  ) {
    let subtotal = new Prisma.Decimal(0);
    let discountTotal = new Prisma.Decimal(0);
    let taxTotal = new Prisma.Decimal(0);

    const validatedLines: Array<{
      itemId: string;
      variantId?: string | null;
      salesOrderLineId?: string | null;
      description?: string | null;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
    }> = [];

    for (let i = 0; i < lines.length; i++) {
      const lineDto = lines[i];
      const quantity = new Prisma.Decimal(lineDto.quantity);
      const unitPrice = new Prisma.Decimal(lineDto.unitPrice);
      const discountAmount = new Prisma.Decimal(lineDto.discountAmount ?? 0);
      const taxRate = new Prisma.Decimal(lineDto.taxRate ?? 0);

      if (quantity.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          `Line ${i + 1}: Quantity must be greater than 0.`,
        );
      }
      if (unitPrice.lessThan(0)) {
        throw new BadRequestException(
          `Line ${i + 1}: Unit price cannot be negative.`,
        );
      }
      if (discountAmount.lessThan(0)) {
        throw new BadRequestException(
          `Line ${i + 1}: Discount amount cannot be negative.`,
        );
      }
      if (taxRate.lessThan(0)) {
        throw new BadRequestException(
          `Line ${i + 1}: Tax rate cannot be negative.`,
        );
      }

      // Verify item exists in organization
      const item = await this.prisma.item.findFirst({
        where: { id: lineDto.itemId, organizationId, deletedAt: null },
      });
      if (!item) {
        throw new NotFoundException(
          `Line ${i + 1}: Item with ID ${lineDto.itemId} not found in this organization.`,
        );
      }

      // Verify variant if provided
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
          throw new NotFoundException(
            `Line ${i + 1}: Item variant with ID ${lineDto.variantId} not found for this item.`,
          );
        }
      }

      const gross = quantity.mul(unitPrice);
      const net = gross.sub(discountAmount);
      const taxAmount = net.mul(taxRate.div(100));
      const lineTotal = net.add(taxAmount);

      subtotal = subtotal.add(gross);
      discountTotal = discountTotal.add(discountAmount);
      taxTotal = taxTotal.add(taxAmount);

      validatedLines.push({
        itemId: lineDto.itemId,
        variantId: lineDto.variantId ?? null,
        salesOrderLineId: lineDto.salesOrderLineId ?? null,
        description: lineDto.description?.trim() ?? null,
        quantity,
        unitPrice,
        discountAmount,
        taxRate,
        taxAmount,
        lineTotal,
      });
    }

    const grandTotal = subtotal.sub(discountTotal).add(taxTotal);

    return {
      validatedLines,
      subtotal,
      discountAmount: discountTotal,
      taxAmount: taxTotal,
      grandTotal,
    };
  }

  /**
   * Create a new draft customer invoice.
   */
  async create(
    organizationId: string,
    dto: CreateCustomerInvoiceDto,
    actorUserId: string,
  ): Promise<CustomerInvoiceWithDetails> {
    // 1. Verify customer
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException(
        `Customer with ID ${dto.customerId} not found in this organization.`,
      );
    }
    if (!customer.isActive) {
      throw new BadRequestException(`Customer '${customer.name}' is inactive.`);
    }

    // 2. Resolve currency
    const currencyId = dto.currencyId ?? customer.currencyId;
    if (!currencyId) {
      throw new BadRequestException(
        'Currency ID must be provided or configured on the customer profile.',
      );
    }
    const currency = await this.prisma.currency.findFirst({
      where: { id: currencyId, isActive: true },
    });
    if (!currency) {
      throw new BadRequestException(
        `Currency with ID ${currencyId} not found or inactive.`,
      );
    }

    // 3. Resolve dates & payment terms
    const invoiceDate = new Date(dto.invoiceDate);
    const paymentTermsDays =
      dto.paymentTermsDays !== undefined
        ? dto.paymentTermsDays
        : customer.paymentTermsDays;
    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : this.computeDueDate(invoiceDate, paymentTermsDays);

    // 4. Validate Sales Order if provided
    if (dto.salesOrderId) {
      const so = await this.prisma.salesOrder.findFirst({
        where: {
          id: dto.salesOrderId,
          organizationId,
          customerId: dto.customerId,
        },
      });
      if (!so) {
        throw new BadRequestException(
          `Sales Order with ID ${dto.salesOrderId} not found for this customer.`,
        );
      }
    }

    // 5. Validate Delivery Order if provided
    if (dto.deliveryOrderId) {
      const doRecord = await this.prisma.deliveryOrder.findFirst({
        where: {
          id: dto.deliveryOrderId,
          organizationId,
          customerId: dto.customerId,
        },
      });
      if (!doRecord) {
        throw new BadRequestException(
          `Delivery Order with ID ${dto.deliveryOrderId} not found for this customer.`,
        );
      }
    }

    // 6. Compute Lines
    const { validatedLines, subtotal, discountAmount, taxAmount, grandTotal } =
      await this.validateAndComputeLines(organizationId, dto.lines);

    // 7. Allocate invoice number
    let invoiceNumber: string;
    try {
      const generated = await this.numberingService.nextNumber(
        organizationId,
        'CUSTOMER_INVOICE',
        actorUserId,
      );
      invoiceNumber = generated.formatted;
    } catch {
      const count = await this.prisma.customerInvoice.count({
        where: { organizationId },
      });
      invoiceNumber = `CI-${String(count + 1).padStart(6, '0')}`;
    }

    // 8. Create in transaction
    const invoice = await this.prisma.$transaction(async (tx) => {
      const created = await tx.customerInvoice.create({
        data: {
          organizationId,
          customerId: dto.customerId,
          invoiceNumber,
          invoiceDate,
          dueDate,
          paymentTermsDays,
          currencyId,
          status: CustomerInvoiceStatus.DRAFT,
          subtotal,
          discountAmount,
          taxAmount,
          grandTotal,
          amountPaid: new Prisma.Decimal(0),
          amountDue: grandTotal,
          salesOrderId: dto.salesOrderId ?? null,
          deliveryOrderId: dto.deliveryOrderId ?? null,
          notes: dto.notes?.trim() ?? null,
          createdByUserId: actorUserId,
        },
      });

      await tx.customerInvoiceLine.createMany({
        data: validatedLines.map((l) => ({
          ...l,
          customerInvoiceId: created.id,
          organizationId,
        })),
      });

      return tx.customerInvoice.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              name: true,
              paymentTermsDays: true,
              currencyId: true,
            },
          },
          currency: {
            select: { id: true, code: true, name: true, symbol: true },
          },
          salesOrder: {
            select: { id: true, orderNumber: true, status: true },
          },
          deliveryOrder: {
            select: { id: true, deliveryNumber: true, status: true },
          },
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true } },
              variant: { select: { id: true, sku: true, name: true } },
              salesOrderLine: {
                select: { id: true, quantity: true, unitPrice: true },
              },
            },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_INVOICE_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_invoice.create',
      resource: 'customer_invoice',
      resourceId: invoice.id,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        grandTotal: invoice.grandTotal.toString(),
      },
    });

    return invoice;
  }

  /**
   * Create draft invoice from a confirmed/delivered Sales Order.
   */
  async createFromSalesOrder(
    organizationId: string,
    salesOrderId: string,
    actorUserId: string,
  ): Promise<CustomerInvoiceWithDetails> {
    const so = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, organizationId },
      include: {
        customer: true,
        lines: true,
      },
    });

    if (!so) {
      throw new NotFoundException(
        `Sales Order with ID ${salesOrderId} not found in this organization.`,
      );
    }

    if (
      so.status === SalesOrderStatus.CANCELLED ||
      so.status === SalesOrderStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Cannot create invoice from Sales Order in status: ${so.status}. Sales Order must be confirmed.`,
      );
    }

    // Check previously invoiced quantities
    const existingInvoices = await this.prisma.customerInvoice.findMany({
      where: {
        organizationId,
        salesOrderId,
        status: {
          notIn: [
            CustomerInvoiceStatus.CANCELLED,
            CustomerInvoiceStatus.VOIDED,
          ],
        },
      },
      include: {
        lines: true,
      },
    });

    const invoicedQtyMap = new Map<string, Prisma.Decimal>();
    for (const inv of existingInvoices) {
      for (const line of inv.lines) {
        if (line.salesOrderLineId) {
          const current =
            invoicedQtyMap.get(line.salesOrderLineId) ?? new Prisma.Decimal(0);
          invoicedQtyMap.set(
            line.salesOrderLineId,
            current.add(new Prisma.Decimal(line.quantity)),
          );
        }
      }
    }

    const eligibleLines: CreateCustomerInvoiceLineDto[] = [];
    for (const line of so.lines) {
      const alreadyInvoiced =
        invoicedQtyMap.get(line.id) ?? new Prisma.Decimal(0);
      const remaining = new Prisma.Decimal(line.quantity).sub(alreadyInvoiced);

      if (remaining.greaterThan(0)) {
        eligibleLines.push({
          itemId: line.itemId,
          variantId: line.variantId ?? undefined,
          salesOrderLineId: line.id,
          description: line.description ?? undefined,
          quantity: remaining.toNumber(),
          unitPrice: new Prisma.Decimal(line.unitPrice).toNumber(),
          discountAmount: new Prisma.Decimal(line.discountAmount).toNumber(),
          taxRate: new Prisma.Decimal(line.taxRate).toNumber(),
        });
      }
    }

    if (eligibleLines.length === 0) {
      throw new BadRequestException(
        `Sales Order ${so.orderNumber} is already fully invoiced.`,
      );
    }

    const created = await this.create(
      organizationId,
      {
        customerId: so.customerId,
        salesOrderId: so.id,
        currencyId: so.currencyId,
        invoiceDate: new Date().toISOString().slice(0, 10),
        paymentTermsDays: so.paymentTermsDays,
        lines: eligibleLines,
      },
      actorUserId,
    );

    await this.eventBus.publish({
      eventName: 'CUSTOMER_INVOICE_SOURCE_LINKED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_invoice.source_linked',
      resource: 'customer_invoice',
      resourceId: created.id,
      details: {
        salesOrderId: so.id,
        salesOrderNumber: so.orderNumber,
      },
    });

    return created;
  }

  /**
   * Create draft invoice from a completed/shipped Delivery Order.
   */
  async createFromDeliveryOrder(
    organizationId: string,
    deliveryOrderId: string,
    actorUserId: string,
  ): Promise<CustomerInvoiceWithDetails> {
    const doRecord = await this.prisma.deliveryOrder.findFirst({
      where: { id: deliveryOrderId, organizationId },
      include: {
        customer: true,
        salesOrder: {
          include: {
            lines: true,
          },
        },
        lines: {
          include: {
            salesOrderLine: true,
          },
        },
      },
    });

    if (!doRecord) {
      throw new NotFoundException(
        `Delivery Order with ID ${deliveryOrderId} not found in this organization.`,
      );
    }

    if (
      doRecord.status !== DeliveryOrderStatus.DELIVERED &&
      doRecord.status !== DeliveryOrderStatus.SHIPPED
    ) {
      throw new BadRequestException(
        `Cannot create invoice from Delivery Order in status: ${doRecord.status}. Delivery Order must be SHIPPED or DELIVERED.`,
      );
    }

    const eligibleLines: CreateCustomerInvoiceLineDto[] = [];
    for (const doLine of doRecord.lines) {
      const soLine = doLine.salesOrderLine;
      const deliveredQty = new Prisma.Decimal(doLine.quantity);

      if (deliveredQty.greaterThan(0)) {
        eligibleLines.push({
          itemId: doLine.itemId,
          variantId: doLine.variantId ?? undefined,
          salesOrderLineId: soLine?.id,
          quantity: deliveredQty.toNumber(),
          unitPrice: soLine
            ? new Prisma.Decimal(soLine.unitPrice).toNumber()
            : 0,
          discountAmount: soLine
            ? new Prisma.Decimal(soLine.discountAmount).toNumber()
            : 0,
          taxRate: soLine ? new Prisma.Decimal(soLine.taxRate).toNumber() : 0,
        });
      }
    }

    if (eligibleLines.length === 0) {
      throw new BadRequestException(
        `Delivery Order ${doRecord.deliveryNumber} has no delivered lines to invoice.`,
      );
    }

    const created = await this.create(
      organizationId,
      {
        customerId: doRecord.customerId,
        salesOrderId: doRecord.salesOrderId,
        deliveryOrderId: doRecord.id,
        currencyId: doRecord.salesOrder.currencyId,
        invoiceDate: new Date().toISOString().slice(0, 10),
        paymentTermsDays: doRecord.salesOrder.paymentTermsDays,
        lines: eligibleLines,
      },
      actorUserId,
    );

    await this.eventBus.publish({
      eventName: 'CUSTOMER_INVOICE_SOURCE_LINKED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_invoice.source_linked',
      resource: 'customer_invoice',
      resourceId: created.id,
      details: {
        deliveryOrderId: doRecord.id,
        deliveryOrderNumber: doRecord.deliveryNumber,
      },
    });

    return created;
  }

  /**
   * List customer invoices with pagination and filters.
   */
  async findAll(
    organizationId: string,
    query: CustomerInvoiceQueryDto,
  ): Promise<{
    invoices: CustomerInvoice[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerInvoiceWhereInput = { organizationId };

    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
    if (query.salesOrderId) where.salesOrderId = query.salesOrderId;
    if (query.deliveryOrderId) where.deliveryOrderId = query.deliveryOrderId;

    if (query.fromDate || query.toDate) {
      where.invoiceDate = {};
      if (query.fromDate) where.invoiceDate.gte = new Date(query.fromDate);
      if (query.toDate) where.invoiceDate.lte = new Date(query.toDate);
    }

    if (query.search) {
      where.invoiceNumber = { contains: query.search, mode: 'insensitive' };
    }

    const [total, invoices] = await Promise.all([
      this.prisma.customerInvoice.count({ where }),
      this.prisma.customerInvoice.findMany({
        where,
        include: {
          customer: { select: { id: true, code: true, name: true } },
          currency: { select: { code: true, symbol: true } },
          _count: { select: { lines: true } },
        },
        orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find single customer invoice by ID with full relations.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<CustomerInvoiceWithDetails> {
    const invoice = await this.prisma.customerInvoice.findFirst({
      where: { id, organizationId },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
            paymentTermsDays: true,
            currencyId: true,
          },
        },
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
        salesOrder: {
          select: { id: true, orderNumber: true, status: true },
        },
        deliveryOrder: {
          select: { id: true, deliveryNumber: true, status: true },
        },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true, name: true } },
            salesOrderLine: {
              select: { id: true, quantity: true, unitPrice: true },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(
        `Customer invoice with ID ${id} not found in this organization.`,
      );
    }

    return invoice;
  }

  /**
   * Update draft customer invoice.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateCustomerInvoiceDto,
    actorUserId: string,
  ): Promise<CustomerInvoiceWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== CustomerInvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT customer invoices can be edited. Current status: ${existing.status}`,
      );
    }

    let subtotal = existing.subtotal;
    let discountAmount = existing.discountAmount;
    let taxAmount = existing.taxAmount;
    let grandTotal = existing.grandTotal;
    let validatedLines: Array<{
      itemId: string;
      variantId?: string | null;
      salesOrderLineId?: string | null;
      description?: string | null;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
    }> | null = null;

    if (dto.lines) {
      const computed = await this.validateAndComputeLines(
        organizationId,
        dto.lines,
      );
      validatedLines = computed.validatedLines;
      subtotal = computed.subtotal;
      discountAmount = computed.discountAmount;
      taxAmount = computed.taxAmount;
      grandTotal = computed.grandTotal;
    }

    const invoiceDate = dto.invoiceDate
      ? new Date(dto.invoiceDate)
      : existing.invoiceDate;
    const paymentTermsDays =
      dto.paymentTermsDays !== undefined
        ? dto.paymentTermsDays
        : existing.paymentTermsDays;
    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : dto.invoiceDate
        ? this.computeDueDate(invoiceDate, paymentTermsDays)
        : existing.dueDate;

    const updated = await this.prisma.$transaction(async (tx) => {
      const data: Prisma.CustomerInvoiceUpdateInput = {};
      if (dto.invoiceDate) data.invoiceDate = invoiceDate;
      if (dto.dueDate || dto.invoiceDate) data.dueDate = dueDate;
      if (dto.paymentTermsDays !== undefined) {
        data.paymentTermsDays = paymentTermsDays;
      }
      if (dto.currencyId) {
        data.currency = { connect: { id: dto.currencyId } };
      }
      if (dto.salesOrderId !== undefined) {
        data.salesOrder = dto.salesOrderId
          ? { connect: { id: dto.salesOrderId } }
          : { disconnect: true };
      }
      if (dto.deliveryOrderId !== undefined) {
        data.deliveryOrder = dto.deliveryOrderId
          ? { connect: { id: dto.deliveryOrderId } }
          : { disconnect: true };
      }
      if (dto.notes !== undefined) data.notes = dto.notes?.trim() ?? null;

      if (validatedLines) {
        data.subtotal = subtotal;
        data.discountAmount = discountAmount;
        data.taxAmount = taxAmount;
        data.grandTotal = grandTotal;
        data.amountDue = grandTotal.sub(existing.amountPaid);

        await tx.customerInvoiceLine.deleteMany({
          where: { customerInvoiceId: id },
        });
        await tx.customerInvoiceLine.createMany({
          data: validatedLines.map((l) => ({
            ...l,
            customerInvoiceId: id,
            organizationId,
          })),
        });
      }

      await tx.customerInvoice.update({
        where: { id },
        data,
      });

      return tx.customerInvoice.findUniqueOrThrow({
        where: { id },
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              name: true,
              paymentTermsDays: true,
              currencyId: true,
            },
          },
          currency: {
            select: { id: true, code: true, name: true, symbol: true },
          },
          salesOrder: {
            select: { id: true, orderNumber: true, status: true },
          },
          deliveryOrder: {
            select: { id: true, deliveryNumber: true, status: true },
          },
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true } },
              variant: { select: { id: true, sku: true, name: true } },
              salesOrderLine: {
                select: { id: true, quantity: true, unitPrice: true },
              },
            },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_INVOICE_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_invoice.update',
      resource: 'customer_invoice',
      resourceId: updated.id,
      details: { invoiceNumber: updated.invoiceNumber },
    });

    return updated;
  }

  /**
   * Delete draft customer invoice.
   */
  async remove(
    organizationId: string,
    id: string,
  ): Promise<{ success: boolean }> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== CustomerInvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT customer invoices can be deleted. Current status: ${existing.status}`,
      );
    }

    await this.prisma.customerInvoice.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Issue draft customer invoice to customer and post to General Ledger (DRAFT -> ISSUED).
   */
  async issue(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<CustomerInvoiceWithDetails> {
    const invoice = await this.findOne(organizationId, id);

    if (invoice.status !== CustomerInvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT customer invoices can be issued. Current status: ${invoice.status}`,
      );
    }

    // 1. Resolve active fiscal period for invoice date
    const fiscalPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: {
        organizationId,
        status: FiscalPeriodStatus.OPEN,
        startDate: { lte: invoice.invoiceDate },
        endDate: { gte: invoice.invoiceDate },
      },
    });

    if (!fiscalPeriod) {
      throw new BadRequestException(
        `No OPEN fiscal period found covering invoice date (${invoice.invoiceDate.toISOString().slice(0, 10)}).`,
      );
    }

    // 2. Resolve account mappings
    const arAccountId = await this.accountMappingService.resolveAccount(
      organizationId,
      'ACCOUNTS_RECEIVABLE',
    );
    const revenueAccountId = await this.accountMappingService.resolveAccount(
      organizationId,
      'SALES_REVENUE',
    );

    let outputTaxAccountId: string | null = null;
    if (invoice.taxAmount.greaterThan(0)) {
      outputTaxAccountId = await this.accountMappingService.resolveAccount(
        organizationId,
        'OUTPUT_TAX',
      );
    }

    // 3. Generate journal entry number
    let journalNumber: string;
    try {
      const generated = await this.numberingService.nextNumber(
        organizationId,
        'JOURNAL_ENTRY',
        actorUserId,
      );
      journalNumber = generated.formatted;
    } catch {
      const count = await this.prisma.journalEntry.count({
        where: { organizationId },
      });
      journalNumber = `JE-${String(count + 1).padStart(6, '0')}`;
    }

    // 4. Construct balanced journal lines
    // Debit: Accounts Receivable (grandTotal)
    const journalLinesData: Array<{
      organizationId: string;
      accountId: string;
      description: string;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
      lineNumber: number;
    }> = [
      {
        organizationId,
        accountId: arAccountId,
        description: `AR Invoice ${invoice.invoiceNumber} - ${invoice.customer.name}`,
        debit: invoice.grandTotal,
        credit: new Prisma.Decimal(0),
        lineNumber: 1,
      },
    ];

    // Credit: Sales Revenue (subtotal - discount)
    const netRevenue = invoice.subtotal.sub(invoice.discountAmount);
    let lineCounter = 2;

    journalLinesData.push({
      organizationId,
      accountId: revenueAccountId,
      description: `AR Invoice ${invoice.invoiceNumber} - Sales Revenue`,
      debit: new Prisma.Decimal(0),
      credit: netRevenue,
      lineNumber: lineCounter++,
    });

    // Credit: Output Tax (taxAmount, if > 0)
    if (invoice.taxAmount.greaterThan(0) && outputTaxAccountId) {
      journalLinesData.push({
        organizationId,
        accountId: outputTaxAccountId,
        description: `AR Invoice ${invoice.invoiceNumber} - Output Tax`,
        debit: new Prisma.Decimal(0),
        credit: invoice.taxAmount,
        lineNumber: lineCounter,
      });
    }

    // 5. Execute invoice issuing & GL journal creation atomically
    const issued = await this.prisma.$transaction(async (tx) => {
      // Create posted journal entry
      const glEntry = await tx.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber: journalNumber,
          entryDate: invoice.invoiceDate,
          description: `Customer Invoice: ${invoice.invoiceNumber} (${invoice.customer.name})`,
          status: JournalEntryStatus.POSTED,
          sourceType: 'CUSTOMER_INVOICE',
          sourceId: invoice.id,
          createdByUserId: actorUserId,
          postedByUserId: actorUserId,
          postedAt: new Date(),
        },
      });

      await tx.journalLine.createMany({
        data: journalLinesData.map((l) => ({
          ...l,
          journalEntryId: glEntry.id,
        })),
      });

      // Update invoice status to ISSUED
      return tx.customerInvoice.update({
        where: { id },
        data: {
          status: CustomerInvoiceStatus.ISSUED,
          issuedAt: new Date(),
          issuedByUserId: actorUserId,
        },
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              name: true,
              paymentTermsDays: true,
              currencyId: true,
            },
          },
          currency: {
            select: { id: true, code: true, name: true, symbol: true },
          },
          salesOrder: { select: { id: true, orderNumber: true, status: true } },
          deliveryOrder: {
            select: { id: true, deliveryNumber: true, status: true },
          },
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true } },
              variant: { select: { id: true, sku: true, name: true } },
              salesOrderLine: {
                select: { id: true, quantity: true, unitPrice: true },
              },
            },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_INVOICE_ISSUED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_invoice.issue',
      resource: 'customer_invoice',
      resourceId: id,
      details: {
        invoiceNumber: issued.invoiceNumber,
        grandTotal: issued.grandTotal.toString(),
        glJournalNumber: journalNumber,
      },
    });

    return issued;
  }

  /**
   * Cancel draft customer invoice (DRAFT -> CANCELLED).
   */
  async cancel(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<CustomerInvoiceWithDetails> {
    const invoice = await this.findOne(organizationId, id);

    if (invoice.status !== CustomerInvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot cancel customer invoice with status: ${invoice.status}. Only DRAFT invoices can be cancelled.`,
      );
    }

    const updated = await this.prisma.customerInvoice.update({
      where: { id },
      data: { status: CustomerInvoiceStatus.CANCELLED },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
            paymentTermsDays: true,
            currencyId: true,
          },
        },
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
        salesOrder: { select: { id: true, orderNumber: true, status: true } },
        deliveryOrder: {
          select: { id: true, deliveryNumber: true, status: true },
        },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true, name: true } },
            salesOrderLine: {
              select: { id: true, quantity: true, unitPrice: true },
            },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_INVOICE_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_invoice.cancel',
      resource: 'customer_invoice',
      resourceId: id,
      details: { invoiceNumber: updated.invoiceNumber },
    });

    return updated;
  }

  /**
   * Void issued customer invoice with compensating GL reversal (ISSUED -> VOIDED).
   */
  async void(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<CustomerInvoiceWithDetails> {
    const invoice = await this.findOne(organizationId, id);

    if (invoice.status !== CustomerInvoiceStatus.ISSUED) {
      throw new BadRequestException(
        `Only ISSUED customer invoices can be voided. Current status: ${invoice.status}`,
      );
    }

    if (invoice.amountPaid.greaterThan(0)) {
      throw new BadRequestException(
        `Cannot void customer invoice ${invoice.invoiceNumber} because payments have already been collected (Amount Paid: ${invoice.amountPaid.toString()}).`,
      );
    }

    // Find GL journal entry for this invoice
    const glEntry = await this.prisma.journalEntry.findFirst({
      where: {
        organizationId,
        sourceType: 'CUSTOMER_INVOICE',
        sourceId: invoice.id,
        status: JournalEntryStatus.POSTED,
      },
      include: {
        lines: true,
      },
    });

    // Reversal journal entry number
    let reversalNumber: string;
    try {
      const generated = await this.numberingService.nextNumber(
        organizationId,
        'JOURNAL_ENTRY',
        actorUserId,
      );
      reversalNumber = generated.formatted;
    } catch {
      const count = await this.prisma.journalEntry.count({
        where: { organizationId },
      });
      reversalNumber = `JE-${String(count + 1).padStart(6, '0')}`;
    }

    const voided = await this.prisma.$transaction(async (tx) => {
      if (glEntry) {
        // Create compensating reversal journal entry
        const reversal = await tx.journalEntry.create({
          data: {
            organizationId,
            fiscalPeriodId: glEntry.fiscalPeriodId,
            entryNumber: reversalNumber,
            entryDate: new Date(),
            description: `Reversal of ${invoice.invoiceNumber} (${glEntry.entryNumber})`,
            status: JournalEntryStatus.POSTED,
            sourceType: 'REVERSAL',
            sourceId: glEntry.id,
            createdByUserId: actorUserId,
            postedByUserId: actorUserId,
            postedAt: new Date(),
          },
        });

        await tx.journalLine.createMany({
          data: glEntry.lines.map((l) => ({
            journalEntryId: reversal.id,
            organizationId,
            accountId: l.accountId,
            description: `Reversal: ${l.description ?? ''}`.trim() || null,
            debit: l.credit, // Inverted!
            credit: l.debit, // Inverted!
            lineNumber: l.lineNumber,
          })),
        });

        await tx.journalEntry.update({
          where: { id: glEntry.id },
          data: { status: JournalEntryStatus.VOIDED },
        });
      }

      return tx.customerInvoice.update({
        where: { id },
        data: {
          status: CustomerInvoiceStatus.VOIDED,
          voidedAt: new Date(),
        },
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              name: true,
              paymentTermsDays: true,
              currencyId: true,
            },
          },
          currency: {
            select: { id: true, code: true, name: true, symbol: true },
          },
          salesOrder: { select: { id: true, orderNumber: true, status: true } },
          deliveryOrder: {
            select: { id: true, deliveryNumber: true, status: true },
          },
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true } },
              variant: { select: { id: true, sku: true, name: true } },
              salesOrderLine: {
                select: { id: true, quantity: true, unitPrice: true },
              },
            },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_INVOICE_VOIDED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_invoice.void',
      resource: 'customer_invoice',
      resourceId: id,
      details: {
        invoiceNumber: voided.invoiceNumber,
      },
    });

    return voided;
  }
}
