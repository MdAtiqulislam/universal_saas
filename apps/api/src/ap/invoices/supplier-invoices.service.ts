import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { AccountsPayableMatchingService } from '../matching/accounts-payable-matching.service';
import { ApAccountMappingService } from '../account-mapping/ap-account-mapping.service';
import {
  CreateSupplierInvoiceDto,
  CreateSupplierInvoiceLineDto,
} from './dto/create-supplier-invoice.dto';
import { UpdateSupplierInvoiceDto } from './dto/update-supplier-invoice.dto';
import { SupplierInvoiceQueryDto } from './dto/supplier-invoice-query.dto';
import {
  SupplierInvoice,
  SupplierInvoiceStatus,
  JournalEntryStatus,
  FiscalPeriodStatus,
  Prisma,
} from '@prisma/client';

export type SupplierInvoiceWithDetails = Prisma.SupplierInvoiceGetPayload<{
  include: {
    supplier: {
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
    purchaseOrder: {
      select: { id: true; poNumber: true; status: true };
    };
    goodsReceipt: {
      select: { id: true; receiptNumber: true; status: true };
    };
    lines: {
      include: {
        item: { select: { id: true; sku: true; name: true } };
        variant: { select: { id: true; sku: true; name: true } };
        purchaseOrderLine: {
          select: { id: true; quantity: true; unitPrice: true };
        };
        goodsReceiptLine: {
          select: { id: true; quantity: true; unitCost: true };
        };
      };
    };
  };
}>;

@Injectable()
export class SupplierInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly matchingService: AccountsPayableMatchingService,
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
    lines: CreateSupplierInvoiceLineDto[],
  ) {
    let subtotal = new Prisma.Decimal(0);
    let discountTotal = new Prisma.Decimal(0);
    let taxTotal = new Prisma.Decimal(0);

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
      purchaseOrderLineId?: string | null;
      goodsReceiptLineId?: string | null;
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
        description: lineDto.description?.trim() ?? null,
        quantity,
        unitPrice,
        discountAmount,
        taxRate,
        taxAmount,
        lineTotal,
        purchaseOrderLineId: lineDto.purchaseOrderLineId ?? null,
        goodsReceiptLineId: lineDto.goodsReceiptLineId ?? null,
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
   * Create a new draft supplier invoice.
   */
  async create(
    organizationId: string,
    dto: CreateSupplierInvoiceDto,
    actorUserId: string,
  ): Promise<SupplierInvoiceWithDetails> {
    // 1. Verify supplier
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, organizationId, deletedAt: null },
    });
    if (!supplier) {
      throw new NotFoundException(
        `Supplier with ID ${dto.supplierId} not found in this organization.`,
      );
    }
    if (!supplier.isActive) {
      throw new BadRequestException(`Supplier '${supplier.name}' is inactive.`);
    }

    // 2. Resolve currency
    const currencyId = dto.currencyId ?? supplier.currencyId;
    if (!currencyId) {
      throw new BadRequestException(
        'Currency ID must be provided or configured on the supplier profile.',
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

    // 3. Resolve dates
    const invoiceDate = new Date(dto.invoiceDate);
    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : this.computeDueDate(invoiceDate, supplier.paymentTermsDays);

    // 4. Validate PO if supplied
    if (dto.purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findFirst({
        where: {
          id: dto.purchaseOrderId,
          organizationId,
          supplierId: dto.supplierId,
        },
      });
      if (!po) {
        throw new BadRequestException(
          `Purchase Order with ID ${dto.purchaseOrderId} not found for this supplier.`,
        );
      }
    }

    // 5. Validate Goods Receipt if supplied
    if (dto.goodsReceiptId) {
      const gr = await this.prisma.goodsReceipt.findFirst({
        where: { id: dto.goodsReceiptId, organizationId },
      });
      if (!gr) {
        throw new BadRequestException(
          `Goods Receipt with ID ${dto.goodsReceiptId} not found in this organization.`,
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
        'SUPPLIER_INVOICE',
        actorUserId,
      );
      invoiceNumber = generated.formatted;
    } catch {
      const count = await this.prisma.supplierInvoice.count({
        where: { organizationId },
      });
      invoiceNumber = `SI-${String(count + 1).padStart(6, '0')}`;
    }

    // 8. Create in transaction
    const invoice = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supplierInvoice.create({
        data: {
          organizationId,
          supplierId: dto.supplierId,
          invoiceNumber,
          invoiceDate,
          dueDate,
          currencyId,
          status: SupplierInvoiceStatus.DRAFT,
          subtotal,
          discountAmount,
          taxAmount,
          grandTotal,
          amountPaid: new Prisma.Decimal(0),
          amountDue: grandTotal,
          purchaseOrderId: dto.purchaseOrderId ?? null,
          goodsReceiptId: dto.goodsReceiptId ?? null,
          notes: dto.notes?.trim() ?? null,
          sourceReference: dto.sourceReference?.trim() ?? null,
          createdByUserId: actorUserId,
        },
      });

      await tx.supplierInvoiceLine.createMany({
        data: validatedLines.map((l) => ({
          ...l,
          supplierInvoiceId: created.id,
          organizationId,
        })),
      });

      return tx.supplierInvoice.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          supplier: {
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
          purchaseOrder: {
            select: { id: true, poNumber: true, status: true },
          },
          goodsReceipt: {
            select: { id: true, receiptNumber: true, status: true },
          },
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true } },
              variant: { select: { id: true, sku: true, name: true } },
              purchaseOrderLine: {
                select: { id: true, quantity: true, unitPrice: true },
              },
              goodsReceiptLine: {
                select: { id: true, quantity: true, unitCost: true },
              },
            },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_INVOICE_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'supplier_invoice.create',
      resource: 'supplier_invoice',
      resourceId: invoice.id,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        grandTotal: invoice.grandTotal.toString(),
      },
    });

    return invoice;
  }

  /**
   * List supplier invoices with pagination and filters.
   */
  async findAll(
    organizationId: string,
    query: SupplierInvoiceQueryDto,
  ): Promise<{
    invoices: SupplierInvoice[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierInvoiceWhereInput = { organizationId };

    if (query.status) where.status = query.status;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.purchaseOrderId) where.purchaseOrderId = query.purchaseOrderId;

    if (query.fromDate || query.toDate) {
      where.invoiceDate = {};
      if (query.fromDate) where.invoiceDate.gte = new Date(query.fromDate);
      if (query.toDate) where.invoiceDate.lte = new Date(query.toDate);
    }

    if (query.search) {
      where.OR = [
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { sourceReference: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, invoices] = await Promise.all([
      this.prisma.supplierInvoice.count({ where }),
      this.prisma.supplierInvoice.findMany({
        where,
        include: {
          supplier: { select: { id: true, code: true, name: true } },
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
   * Find single supplier invoice by ID with full relations.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<SupplierInvoiceWithDetails> {
    const invoice = await this.prisma.supplierInvoice.findFirst({
      where: { id, organizationId },
      include: {
        supplier: {
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
        purchaseOrder: {
          select: { id: true, poNumber: true, status: true },
        },
        goodsReceipt: {
          select: { id: true, receiptNumber: true, status: true },
        },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true, name: true } },
            purchaseOrderLine: {
              select: { id: true, quantity: true, unitPrice: true },
            },
            goodsReceiptLine: {
              select: { id: true, quantity: true, unitCost: true },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(
        `Supplier invoice with ID ${id} not found in this organization.`,
      );
    }

    return invoice;
  }

  /**
   * Update draft supplier invoice.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateSupplierInvoiceDto,
    actorUserId: string,
  ): Promise<SupplierInvoiceWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== SupplierInvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT supplier invoices can be edited. Current status: ${existing.status}`,
      );
    }

    let subtotal = existing.subtotal;
    let discountAmount = existing.discountAmount;
    let taxAmount = existing.taxAmount;
    let grandTotal = existing.grandTotal;
    let validatedLines: Array<{
      itemId: string;
      variantId?: string | null;
      description?: string | null;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
      purchaseOrderLineId?: string | null;
      goodsReceiptLineId?: string | null;
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
    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : dto.invoiceDate
        ? this.computeDueDate(invoiceDate, existing.supplier.paymentTermsDays)
        : existing.dueDate;

    const updated = await this.prisma.$transaction(async (tx) => {
      const data: Prisma.SupplierInvoiceUpdateInput = {};
      if (dto.invoiceDate) data.invoiceDate = invoiceDate;
      if (dto.dueDate || dto.invoiceDate) data.dueDate = dueDate;
      if (dto.currencyId) {
        data.currency = { connect: { id: dto.currencyId } };
      }
      if (dto.purchaseOrderId !== undefined) {
        data.purchaseOrder = dto.purchaseOrderId
          ? { connect: { id: dto.purchaseOrderId } }
          : { disconnect: true };
      }
      if (dto.goodsReceiptId !== undefined) {
        data.goodsReceipt = dto.goodsReceiptId
          ? { connect: { id: dto.goodsReceiptId } }
          : { disconnect: true };
      }
      if (dto.notes !== undefined) data.notes = dto.notes?.trim() ?? null;
      if (dto.sourceReference !== undefined) {
        data.sourceReference = dto.sourceReference?.trim() ?? null;
      }

      if (validatedLines) {
        data.subtotal = subtotal;
        data.discountAmount = discountAmount;
        data.taxAmount = taxAmount;
        data.grandTotal = grandTotal;
        data.amountDue = grandTotal.sub(existing.amountPaid);

        await tx.supplierInvoiceLine.deleteMany({
          where: { supplierInvoiceId: id },
        });
        await tx.supplierInvoiceLine.createMany({
          data: validatedLines.map((l) => ({
            ...l,
            supplierInvoiceId: id,
            organizationId,
          })),
        });
      }

      await tx.supplierInvoice.update({
        where: { id },
        data,
      });

      return tx.supplierInvoice.findUniqueOrThrow({
        where: { id },
        include: {
          supplier: {
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
          purchaseOrder: {
            select: { id: true, poNumber: true, status: true },
          },
          goodsReceipt: {
            select: { id: true, receiptNumber: true, status: true },
          },
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true } },
              variant: { select: { id: true, sku: true, name: true } },
              purchaseOrderLine: {
                select: { id: true, quantity: true, unitPrice: true },
              },
              goodsReceiptLine: {
                select: { id: true, quantity: true, unitCost: true },
              },
            },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_INVOICE_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'supplier_invoice.update',
      resource: 'supplier_invoice',
      resourceId: updated.id,
      details: { invoiceNumber: updated.invoiceNumber },
    });

    return updated;
  }

  /**
   * Delete draft supplier invoice.
   */
  async remove(
    organizationId: string,
    id: string,
  ): Promise<{ success: boolean }> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== SupplierInvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT supplier invoices can be deleted. Current status: ${existing.status}`,
      );
    }

    await this.prisma.supplierInvoice.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Submit draft supplier invoice for approval (DRAFT -> SUBMITTED).
   */
  async submit(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<SupplierInvoiceWithDetails> {
    const invoice = await this.findOne(organizationId, id);

    if (invoice.status !== SupplierInvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT supplier invoices can be submitted. Current status: ${invoice.status}`,
      );
    }

    const updated = await this.prisma.supplierInvoice.update({
      where: { id },
      data: { status: SupplierInvoiceStatus.SUBMITTED },
      include: {
        supplier: {
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
        purchaseOrder: { select: { id: true, poNumber: true, status: true } },
        goodsReceipt: {
          select: { id: true, receiptNumber: true, status: true },
        },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true, name: true } },
            purchaseOrderLine: {
              select: { id: true, quantity: true, unitPrice: true },
            },
            goodsReceiptLine: {
              select: { id: true, quantity: true, unitCost: true },
            },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_INVOICE_SUBMITTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'supplier_invoice.submit',
      resource: 'supplier_invoice',
      resourceId: id,
      details: { invoiceNumber: updated.invoiceNumber },
    });

    return updated;
  }

  /**
   * Approve submitted supplier invoice (SUBMITTED -> APPROVED).
   * Verifies 3-way matching and rejects if over-invoicing is detected.
   */
  async approve(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<SupplierInvoiceWithDetails> {
    const invoice = await this.findOne(organizationId, id);

    if (invoice.status !== SupplierInvoiceStatus.SUBMITTED) {
      throw new BadRequestException(
        `Only SUBMITTED supplier invoices can be approved. Current status: ${invoice.status}`,
      );
    }

    // Perform matching check
    const matchReport = await this.matchingService.matchInvoice(
      organizationId,
      id,
      actorUserId,
    );

    if (!matchReport.canApprove) {
      throw new BadRequestException(
        `Cannot approve supplier invoice ${invoice.invoiceNumber}: Over-invoicing detected during 3-way matching.`,
      );
    }

    const updated = await this.prisma.supplierInvoice.update({
      where: { id },
      data: { status: SupplierInvoiceStatus.APPROVED },
      include: {
        supplier: {
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
        purchaseOrder: { select: { id: true, poNumber: true, status: true } },
        goodsReceipt: {
          select: { id: true, receiptNumber: true, status: true },
        },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true, name: true } },
            purchaseOrderLine: {
              select: { id: true, quantity: true, unitPrice: true },
            },
            goodsReceiptLine: {
              select: { id: true, quantity: true, unitCost: true },
            },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_INVOICE_APPROVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'supplier_invoice.approve',
      resource: 'supplier_invoice',
      resourceId: id,
      details: { invoiceNumber: updated.invoiceNumber },
    });

    return updated;
  }

  /**
   * Post approved supplier invoice to General Ledger (APPROVED -> POSTED).
   * Generates and posts double-entry journal entry in M12.
   */
  async post(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<SupplierInvoiceWithDetails> {
    const invoice = await this.findOne(organizationId, id);

    if (
      invoice.status !== SupplierInvoiceStatus.APPROVED &&
      invoice.status !== SupplierInvoiceStatus.SUBMITTED &&
      invoice.status !== SupplierInvoiceStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Cannot post invoice with status: ${invoice.status}. Invoice must be DRAFT, SUBMITTED, or APPROVED.`,
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
    const apAccountId = await this.accountMappingService.resolveAccount(
      organizationId,
      'ACCOUNTS_PAYABLE',
    );
    const expenseAccountId = await this.accountMappingService.resolveAccount(
      organizationId,
      'PURCHASE_EXPENSE',
    );

    let inputTaxAccountId: string | null = null;
    if (invoice.taxAmount.greaterThan(0)) {
      inputTaxAccountId = await this.accountMappingService.resolveAccount(
        organizationId,
        'INPUT_TAX',
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
    // Debit: Expense (subtotal - discount)
    const netExpense = invoice.subtotal.sub(invoice.discountAmount);
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
        accountId: expenseAccountId,
        description: `AP Invoice ${invoice.invoiceNumber} - Purchase Expense`,
        debit: netExpense,
        credit: new Prisma.Decimal(0),
        lineNumber: 1,
      },
    ];

    let lineCounter = 2;
    if (invoice.taxAmount.greaterThan(0) && inputTaxAccountId) {
      journalLinesData.push({
        organizationId,
        accountId: inputTaxAccountId,
        description: `AP Invoice ${invoice.invoiceNumber} - Input Tax`,
        debit: invoice.taxAmount,
        credit: new Prisma.Decimal(0),
        lineNumber: lineCounter++,
      });
    }

    // Credit: Accounts Payable (grandTotal)
    journalLinesData.push({
      organizationId,
      accountId: apAccountId,
      description: `AP Invoice ${invoice.invoiceNumber} - ${invoice.supplier.name}`,
      debit: new Prisma.Decimal(0),
      credit: invoice.grandTotal,
      lineNumber: lineCounter,
    });

    // 5. Execute invoice posting & GL journal creation atomically
    const posted = await this.prisma.$transaction(async (tx) => {
      // Create posted journal entry
      const glEntry = await tx.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber: journalNumber,
          entryDate: invoice.invoiceDate,
          description: `Supplier Invoice: ${invoice.invoiceNumber} (${invoice.supplier.name})`,
          status: JournalEntryStatus.POSTED,
          sourceType: 'SUPPLIER_INVOICE',
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

      // Update invoice status
      return tx.supplierInvoice.update({
        where: { id },
        data: {
          status: SupplierInvoiceStatus.POSTED,
          postedAt: new Date(),
          postedByUserId: actorUserId,
        },
        include: {
          supplier: {
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
          purchaseOrder: { select: { id: true, poNumber: true, status: true } },
          goodsReceipt: {
            select: { id: true, receiptNumber: true, status: true },
          },
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true } },
              variant: { select: { id: true, sku: true, name: true } },
              purchaseOrderLine: {
                select: { id: true, quantity: true, unitPrice: true },
              },
              goodsReceiptLine: {
                select: { id: true, quantity: true, unitCost: true },
              },
            },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_INVOICE_POSTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'supplier_invoice.post',
      resource: 'supplier_invoice',
      resourceId: id,
      details: {
        invoiceNumber: posted.invoiceNumber,
        grandTotal: posted.grandTotal.toString(),
        glJournalNumber: journalNumber,
      },
    });

    return posted;
  }

  /**
   * Cancel draft, submitted, or approved supplier invoice.
   */
  async cancel(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<SupplierInvoiceWithDetails> {
    const invoice = await this.findOne(organizationId, id);

    if (
      invoice.status !== SupplierInvoiceStatus.DRAFT &&
      invoice.status !== SupplierInvoiceStatus.SUBMITTED &&
      invoice.status !== SupplierInvoiceStatus.APPROVED
    ) {
      throw new BadRequestException(
        `Cannot cancel supplier invoice with status: ${invoice.status}. Only DRAFT, SUBMITTED, or APPROVED invoices can be cancelled.`,
      );
    }

    const updated = await this.prisma.supplierInvoice.update({
      where: { id },
      data: { status: SupplierInvoiceStatus.CANCELLED },
      include: {
        supplier: {
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
        purchaseOrder: { select: { id: true, poNumber: true, status: true } },
        goodsReceipt: {
          select: { id: true, receiptNumber: true, status: true },
        },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true, name: true } },
            purchaseOrderLine: {
              select: { id: true, quantity: true, unitPrice: true },
            },
            goodsReceiptLine: {
              select: { id: true, quantity: true, unitCost: true },
            },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_INVOICE_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'supplier_invoice.cancel',
      resource: 'supplier_invoice',
      resourceId: id,
      details: { invoiceNumber: updated.invoiceNumber },
    });

    return updated;
  }

  /**
   * Void posted supplier invoice with compensating GL reversal.
   */
  async void(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<SupplierInvoiceWithDetails> {
    const invoice = await this.findOne(organizationId, id);

    if (invoice.status !== SupplierInvoiceStatus.POSTED) {
      throw new BadRequestException(
        `Only POSTED supplier invoices can be voided. Current status: ${invoice.status}`,
      );
    }

    if (invoice.amountPaid.greaterThan(0)) {
      throw new BadRequestException(
        `Cannot void supplier invoice ${invoice.invoiceNumber} because payments have already been applied (Amount Paid: ${invoice.amountPaid.toString()}).`,
      );
    }

    // Find GL journal entry for this invoice
    const glEntry = await this.prisma.journalEntry.findFirst({
      where: {
        organizationId,
        sourceType: 'SUPPLIER_INVOICE',
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
        // Create compensating journal entry
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

      return tx.supplierInvoice.update({
        where: { id },
        data: { status: SupplierInvoiceStatus.VOIDED },
        include: {
          supplier: {
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
          purchaseOrder: { select: { id: true, poNumber: true, status: true } },
          goodsReceipt: {
            select: { id: true, receiptNumber: true, status: true },
          },
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true } },
              variant: { select: { id: true, sku: true, name: true } },
              purchaseOrderLine: {
                select: { id: true, quantity: true, unitPrice: true },
              },
              goodsReceiptLine: {
                select: { id: true, quantity: true, unitCost: true },
              },
            },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_INVOICE_VOIDED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'supplier_invoice.void',
      resource: 'supplier_invoice',
      resourceId: id,
      details: {
        invoiceNumber: voided.invoiceNumber,
      },
    });

    return voided;
  }
}
