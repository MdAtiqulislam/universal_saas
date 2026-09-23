import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../../ap/account-mapping/ap-account-mapping.service';
import { BalancesService } from '../../inventory/balances/balances.service';
import {
  CreateCustomerCreditNoteDto,
  CreateCustomerCreditNoteLineDto,
} from './dto/create-customer-credit-note.dto';
import { UpdateCustomerCreditNoteDto } from './dto/update-customer-credit-note.dto';
import { CustomerCreditNoteQueryDto } from './dto/customer-credit-note-query.dto';
import { ApplyCustomerCreditNoteDto } from './dto/apply-customer-credit-note.dto';
import {
  CreditNoteStatus,
  CustomerInvoiceStatus,
  FiscalPeriodStatus,
  JournalEntryStatus,
  Prisma,
  ReturnDisposition,
  StockMovementType,
} from '@prisma/client';

interface ValidatedCustomerCreditLine {
  itemId: string;
  variantId?: string | null;
  customerInvoiceLineId?: string | null;
  description?: string | null;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  returnToInventory: boolean;
  disposition?: ReturnDisposition | null;
  locationId?: string | null;
  batchNumber?: string | null;
  serialNumbers?: string[];
  lineNumber: number;
}

export type CustomerCreditNoteWithDetails =
  Prisma.CustomerCreditNoteGetPayload<{
    include: {
      customer: true;
      currency: true;
      customerInvoice: true;
      lines: {
        include: {
          item: true;
          variant: true;
          location: true;
        };
      };
      applications: {
        include: {
          customerInvoice: true;
        };
      };
      refunds: true;
      journalEntry: true;
    };
  }>;

@Injectable()
export class CustomerCreditNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly accountMappingService: ApAccountMappingService,
    private readonly balancesService: BalancesService,
  ) {}

  /**
   * Helper: Validate and compute line totals & header totals.
   */
  private async validateAndComputeLines(
    organizationId: string,
    linesDto: CreateCustomerCreditNoteLineDto[],
  ) {
    let subtotal = new Prisma.Decimal(0);
    let discountAmount = new Prisma.Decimal(0);
    let taxAmount = new Prisma.Decimal(0);

    const validatedLines: ValidatedCustomerCreditLine[] = [];

    let lineCounter = 1;
    for (const l of linesDto) {
      const item = await this.prisma.item.findFirst({
        where: { id: l.itemId, organizationId, deletedAt: null },
      });
      if (!item) {
        throw new BadRequestException(
          `Item with ID ${l.itemId} not found in this organization.`,
        );
      }

      if (l.variantId) {
        const variant = await this.prisma.itemVariant.findFirst({
          where: {
            id: l.variantId,
            itemId: l.itemId,
            organizationId,
            deletedAt: null,
          },
        });
        if (!variant) {
          throw new BadRequestException(
            `Item variant with ID ${l.variantId} not found for item ${item.sku}.`,
          );
        }
      }

      if (l.returnToInventory && !l.locationId) {
        throw new BadRequestException(
          `Location ID is required when returnToInventory is true (item: ${item.sku}).`,
        );
      }

      if (l.locationId) {
        const location = await this.prisma.location.findFirst({
          where: { id: l.locationId, organizationId, deletedAt: null },
        });
        if (!location) {
          throw new BadRequestException(
            `Location with ID ${l.locationId} not found in this organization.`,
          );
        }
      }

      const quantity = new Prisma.Decimal(l.quantity);
      const unitPrice = new Prisma.Decimal(l.unitPrice);
      const lineDiscount = new Prisma.Decimal(l.discountAmount ?? 0);
      const taxRate = new Prisma.Decimal(l.taxRate ?? 0);

      if (quantity.lessThanOrEqualTo(0)) {
        throw new BadRequestException('Line quantity must be greater than 0.');
      }
      if (unitPrice.lessThan(0)) {
        throw new BadRequestException('Unit price cannot be negative.');
      }
      if (lineDiscount.lessThan(0)) {
        throw new BadRequestException('Discount amount cannot be negative.');
      }

      const grossAmount = quantity.mul(unitPrice);
      const netAmount = grossAmount.sub(lineDiscount);
      const lineTax = netAmount.mul(taxRate).dividedBy(100);
      const lineTotal = netAmount.add(lineTax);

      subtotal = subtotal.add(grossAmount);
      discountAmount = discountAmount.add(lineDiscount);
      taxAmount = taxAmount.add(lineTax);

      validatedLines.push({
        itemId: l.itemId,
        variantId: l.variantId ?? null,
        customerInvoiceLineId: l.customerInvoiceLineId ?? null,
        description: l.description ?? item.name,
        quantity,
        unitPrice,
        discountAmount: lineDiscount,
        taxRate,
        taxAmount: lineTax,
        lineTotal,
        returnToInventory: l.returnToInventory ?? false,
        disposition: l.disposition ?? null,
        locationId: l.locationId ?? null,
        batchNumber: l.batchNumber ?? null,
        serialNumbers: l.serialNumbers ?? [],
        lineNumber: lineCounter++,
      });
    }

    const grandTotal = subtotal.sub(discountAmount).add(taxAmount);

    return {
      validatedLines,
      subtotal,
      discountAmount,
      taxAmount,
      grandTotal,
    };
  }

  /**
   * 1. Create a draft customer credit note
   */
  async create(
    organizationId: string,
    dto: CreateCustomerCreditNoteDto,
    actorUserId: string,
  ): Promise<CustomerCreditNoteWithDetails> {
    // 1. Validate customer
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
        'Currency ID must be provided or configured on customer profile.',
      );
    }
    const currency = await this.prisma.currency.findFirst({
      where: { id: currencyId, isActive: true },
    });
    if (!currency) {
      throw new BadRequestException(
        `Currency ${currencyId} not found or inactive.`,
      );
    }

    // 3. Validate customer invoice if provided
    if (dto.customerInvoiceId) {
      const inv = await this.prisma.customerInvoice.findFirst({
        where: {
          id: dto.customerInvoiceId,
          organizationId,
          customerId: dto.customerId,
        },
      });
      if (!inv) {
        throw new BadRequestException(
          `Customer Invoice ${dto.customerInvoiceId} not found for this customer.`,
        );
      }
    }

    // 4. Validate lines & compute totals
    const { validatedLines, subtotal, discountAmount, taxAmount, grandTotal } =
      await this.validateAndComputeLines(organizationId, dto.lines);

    // 5. Generate credit note number
    let creditNoteNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'CREDIT_NOTE',
        actorUserId,
      );
      creditNoteNumber = seq.formatted;
    } catch {
      const count = await this.prisma.customerCreditNote.count({
        where: { organizationId },
      });
      creditNoteNumber = `CN-${String(count + 1).padStart(6, '0')}`;
    }

    // 6. Create in DB
    const creditNote = await this.prisma.customerCreditNote.create({
      data: {
        organizationId,
        creditNoteNumber,
        customerId: dto.customerId,
        customerInvoiceId: dto.customerInvoiceId ?? null,
        salesOrderId: dto.salesOrderId ?? null,
        deliveryOrderId: dto.deliveryOrderId ?? null,
        currencyId,
        creditDate: new Date(dto.creditDate),
        reason: dto.reason ?? null,
        notes: dto.notes ?? null,
        subtotal,
        discountAmount,
        taxAmount,
        grandTotal,
        appliedAmount: new Prisma.Decimal(0),
        remainingAmount: grandTotal,
        status: CreditNoteStatus.DRAFT,
        createdByUserId: actorUserId,
        lines: {
          create: validatedLines.map((vl) => ({
            organizationId,
            itemId: vl.itemId,
            variantId: vl.variantId,
            customerInvoiceLineId: vl.customerInvoiceLineId,
            description: vl.description,
            quantity: vl.quantity,
            unitPrice: vl.unitPrice,
            discountAmount: vl.discountAmount,
            taxRate: vl.taxRate,
            taxAmount: vl.taxAmount,
            lineTotal: vl.lineTotal,
            returnToInventory: vl.returnToInventory,
            disposition: vl.disposition,
            locationId: vl.locationId,
            batchNumber: vl.batchNumber,
            serialNumbers: vl.serialNumbers ?? [],
            lineNumber: vl.lineNumber,
          })),
        },
      },
      include: {
        customer: true,
        currency: true,
        customerInvoice: true,
        lines: {
          include: {
            item: true,
            variant: true,
            location: true,
          },
        },
        applications: {
          include: {
            customerInvoice: true,
          },
        },
        refunds: true,
        journalEntry: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_CREDIT_NOTE_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_credit_note.create',
      resource: 'customer_credit_note',
      resourceId: creditNote.id,
      details: {
        creditNoteNumber: creditNote.creditNoteNumber,
        grandTotal: creditNote.grandTotal.toFixed(4),
      },
    });

    return creditNote;
  }

  /**
   * 2. Find all credit notes with pagination & filters
   */
  async findAll(organizationId: string, query: CustomerCreditNoteQueryDto) {
    const where: Prisma.CustomerCreditNoteWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.customerInvoiceId
        ? { customerInvoiceId: query.customerInvoiceId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.startDate || query.endDate
        ? {
            creditDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                creditNoteNumber: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              { reason: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.customerCreditNote.findMany({
        where,
        include: {
          customer: true,
          currency: true,
          customerInvoice: true,
          lines: {
            include: { item: true, variant: true, location: true },
          },
          applications: {
            include: { customerInvoice: true },
          },
          refunds: true,
          journalEntry: true,
        },
        orderBy: [{ creditDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.customerCreditNote.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 3. Find one credit note
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<CustomerCreditNoteWithDetails> {
    const creditNote = await this.prisma.customerCreditNote.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        customer: true,
        currency: true,
        customerInvoice: true,
        lines: {
          include: { item: true, variant: true, location: true },
          orderBy: { lineNumber: 'asc' },
        },
        applications: {
          include: { customerInvoice: true },
          orderBy: { appliedAt: 'desc' },
        },
        refunds: true,
        journalEntry: true,
      },
    });

    if (!creditNote) {
      throw new NotFoundException(
        `Customer Credit Note with ID ${id} not found.`,
      );
    }

    return creditNote;
  }

  /**
   * 4. Update draft credit note
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateCustomerCreditNoteDto,
  ): Promise<CustomerCreditNoteWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== CreditNoteStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT credit notes can be edited. Current status: ${existing.status}`,
      );
    }

    let subtotal = existing.subtotal;
    let discountAmount = existing.discountAmount;
    let taxAmount = existing.taxAmount;
    let grandTotal = existing.grandTotal;
    let validatedLines: ValidatedCustomerCreditLine[] | null = null;

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

    const updated = await this.prisma.$transaction(async (tx) => {
      if (validatedLines) {
        await tx.customerCreditNoteLine.deleteMany({
          where: { creditNoteId: id },
        });
        await tx.customerCreditNoteLine.createMany({
          data: validatedLines.map((vl) => ({
            creditNoteId: id,
            organizationId,
            itemId: vl.itemId,
            variantId: vl.variantId,
            customerInvoiceLineId: vl.customerInvoiceLineId,
            description: vl.description,
            quantity: vl.quantity,
            unitPrice: vl.unitPrice,
            discountAmount: vl.discountAmount,
            taxRate: vl.taxRate,
            taxAmount: vl.taxAmount,
            lineTotal: vl.lineTotal,
            returnToInventory: vl.returnToInventory,
            disposition: vl.disposition,
            locationId: vl.locationId,
            batchNumber: vl.batchNumber,
            serialNumbers: vl.serialNumbers ?? [],
            lineNumber: vl.lineNumber,
          })),
        });
      }

      return tx.customerCreditNote.update({
        where: { id },
        data: {
          currencyId: dto.currencyId ?? existing.currencyId,
          creditDate: dto.creditDate
            ? new Date(dto.creditDate)
            : existing.creditDate,
          reason: dto.reason !== undefined ? dto.reason : existing.reason,
          notes: dto.notes !== undefined ? dto.notes : existing.notes,
          subtotal,
          discountAmount,
          taxAmount,
          grandTotal,
          remainingAmount: grandTotal.sub(existing.appliedAmount),
        },
        include: {
          customer: true,
          currency: true,
          customerInvoice: true,
          lines: {
            include: { item: true, variant: true, location: true },
          },
          applications: {
            include: { customerInvoice: true },
          },
          refunds: true,
          journalEntry: true,
        },
      });
    });

    return updated;
  }

  /**
   * 5. Approve draft credit note (DRAFT -> APPROVED)
   */
  async approve(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<CustomerCreditNoteWithDetails> {
    const creditNote = await this.findOne(organizationId, id);

    if (creditNote.status !== CreditNoteStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT credit notes can be approved. Current status: ${creditNote.status}`,
      );
    }

    const approved = await this.prisma.customerCreditNote.update({
      where: { id },
      data: {
        status: CreditNoteStatus.APPROVED,
        approvedByUserId: actorUserId,
        approvedAt: new Date(),
      },
      include: {
        customer: true,
        currency: true,
        customerInvoice: true,
        lines: { include: { item: true, variant: true, location: true } },
        applications: { include: { customerInvoice: true } },
        refunds: true,
        journalEntry: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_CREDIT_NOTE_APPROVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_credit_note.approve',
      resource: 'customer_credit_note',
      resourceId: approved.id,
      details: { creditNoteNumber: approved.creditNoteNumber },
    });

    return approved;
  }

  /**
   * 6. Post credit note to GL and optionally return inventory (APPROVED -> POSTED)
   */
  async post(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<CustomerCreditNoteWithDetails> {
    const creditNote = await this.findOne(organizationId, id);

    if (
      creditNote.status !== CreditNoteStatus.APPROVED &&
      creditNote.status !== CreditNoteStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Cannot post credit note in status: ${creditNote.status}. Must be DRAFT or APPROVED.`,
      );
    }

    // 1. Resolve open fiscal period
    const fiscalPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: {
        organizationId,
        status: FiscalPeriodStatus.OPEN,
        startDate: { lte: creditNote.creditDate },
        endDate: { gte: creditNote.creditDate },
      },
    });
    if (!fiscalPeriod) {
      throw new BadRequestException(
        `No OPEN fiscal period found covering credit date (${creditNote.creditDate.toISOString().slice(0, 10)}).`,
      );
    }

    // 2. Resolve account mappings
    const arAccountId = await this.accountMappingService.resolveAccount(
      organizationId,
      'ACCOUNTS_RECEIVABLE',
    );

    // Sales Returns account (fallback to SALES_REVENUE)
    let salesReturnsAccountId: string;
    try {
      salesReturnsAccountId = await this.accountMappingService.resolveAccount(
        organizationId,
        'SALES_RETURNS',
      );
    } catch {
      salesReturnsAccountId = await this.accountMappingService.resolveAccount(
        organizationId,
        'SALES_REVENUE',
      );
    }

    let outputTaxAccountId: string | null = null;
    if (creditNote.taxAmount.greaterThan(0)) {
      outputTaxAccountId = await this.accountMappingService.resolveAccount(
        organizationId,
        'OUTPUT_TAX',
      );
    }

    // 3. Generate journal entry number
    let journalNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'JOURNAL_ENTRY',
        actorUserId,
      );
      journalNumber = seq.formatted;
    } catch {
      const count = await this.prisma.journalEntry.count({
        where: { organizationId },
      });
      journalNumber = `JE-${String(count + 1).padStart(6, '0')}`;
    }

    // 4. Build balanced journal lines:
    // Debit: Sales Returns (subtotal - discount)
    // Debit: Output Tax (taxAmount, if > 0)
    // Credit: Accounts Receivable (grandTotal)
    const netReturns = creditNote.subtotal.sub(creditNote.discountAmount);
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
        accountId: salesReturnsAccountId,
        description: `Credit Note ${creditNote.creditNoteNumber} - Sales Returns`,
        debit: netReturns,
        credit: new Prisma.Decimal(0),
        lineNumber: 1,
      },
    ];

    let lineCounter = 2;
    if (creditNote.taxAmount.greaterThan(0) && outputTaxAccountId) {
      journalLinesData.push({
        organizationId,
        accountId: outputTaxAccountId,
        description: `Credit Note ${creditNote.creditNoteNumber} - Tax Adjustment`,
        debit: creditNote.taxAmount,
        credit: new Prisma.Decimal(0),
        lineNumber: lineCounter++,
      });
    }

    journalLinesData.push({
      organizationId,
      accountId: arAccountId,
      description: `Credit Note ${creditNote.creditNoteNumber} - ${creditNote.customer.name}`,
      debit: new Prisma.Decimal(0),
      credit: creditNote.grandTotal,
      lineNumber: lineCounter,
    });

    // 5. Execute posting, inventory updates, and status change in single transaction
    const posted = await this.prisma.$transaction(async (tx) => {
      // 5.1 Create posted journal entry
      const glEntry = await tx.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber: journalNumber,
          entryDate: creditNote.creditDate,
          description: `Customer Credit Note: ${creditNote.creditNoteNumber} (${creditNote.customer.name})`,
          status: JournalEntryStatus.POSTED,
          sourceType: 'CUSTOMER_CREDIT_NOTE',
          sourceId: creditNote.id,
          createdByUserId: actorUserId,
          postedByUserId: actorUserId,
          postedAt: new Date(),
          lines: {
            create: journalLinesData,
          },
        },
      });

      // 5.2 Process inventory returns
      for (const line of creditNote.lines) {
        if (
          line.returnToInventory &&
          line.disposition === ReturnDisposition.RESTOCK &&
          line.locationId
        ) {
          await this.balancesService.applyStockMovement(
            organizationId,
            {
              itemId: line.itemId,
              variantId: line.variantId,
              locationId: line.locationId,
              movementType: StockMovementType.RECEIPT,
              quantity: new Prisma.Decimal(line.quantity).toNumber(),
              referenceType: 'CUSTOMER_CREDIT_NOTE',
              referenceId: creditNote.id,
              reason: `Customer Return - ${creditNote.creditNoteNumber}`,
            },
            actorUserId,
            tx,
          );
        }
      }

      // 5.3 Update credit note status
      return tx.customerCreditNote.update({
        where: { id },
        data: {
          status: CreditNoteStatus.POSTED,
          postedByUserId: actorUserId,
          postedAt: new Date(),
          journalEntryId: glEntry.id,
        },
        include: {
          customer: true,
          currency: true,
          customerInvoice: true,
          lines: { include: { item: true, variant: true, location: true } },
          applications: { include: { customerInvoice: true } },
          refunds: true,
          journalEntry: true,
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_CREDIT_NOTE_POSTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_credit_note.post',
      resource: 'customer_credit_note',
      resourceId: posted.id,
      details: {
        creditNoteNumber: posted.creditNoteNumber,
        grandTotal: posted.grandTotal.toFixed(4),
        journalEntryId: posted.journalEntryId,
      },
    });

    return posted;
  }

  /**
   * 7. Apply credit note against customer invoices
   */
  async apply(
    organizationId: string,
    id: string,
    dto: ApplyCustomerCreditNoteDto,
    actorUserId: string,
  ): Promise<CustomerCreditNoteWithDetails> {
    const updatedCreditNote = await this.prisma.$transaction(async (tx) => {
      // 1. Fetch current credit note with lock-safe checks
      const creditNote = await tx.customerCreditNote.findFirst({
        where: { id, organizationId, deletedAt: null },
      });
      if (!creditNote) {
        throw new NotFoundException(
          `Customer Credit Note with ID ${id} not found.`,
        );
      }

      if (
        creditNote.status !== CreditNoteStatus.POSTED &&
        creditNote.status !== CreditNoteStatus.PARTIALLY_APPLIED
      ) {
        throw new BadRequestException(
          `Credit note must be POSTED or PARTIALLY_APPLIED to be applied. Current status: ${creditNote.status}`,
        );
      }

      // 2. Validate total application amount against remaining credit
      let totalAppAmount = new Prisma.Decimal(0);
      for (const app of dto.applications) {
        totalAppAmount = totalAppAmount.add(new Prisma.Decimal(app.amount));
      }

      if (totalAppAmount.greaterThan(creditNote.remainingAmount)) {
        throw new BadRequestException(
          `Total application amount (${totalAppAmount.toFixed(4)}) exceeds credit note remaining amount (${creditNote.remainingAmount.toFixed(4)}).`,
        );
      }

      // 3. Process each invoice application
      for (const app of dto.applications) {
        const appAmount = new Prisma.Decimal(app.amount);
        const invoice = await tx.customerInvoice.findFirst({
          where: {
            id: app.customerInvoiceId,
            organizationId,
            customerId: creditNote.customerId,
            deletedAt: null,
          },
        });

        if (!invoice) {
          throw new NotFoundException(
            `Customer invoice ${app.customerInvoiceId} not found for this customer.`,
          );
        }

        if (
          invoice.status !== CustomerInvoiceStatus.ISSUED &&
          invoice.status !== CustomerInvoiceStatus.PARTIALLY_PAID
        ) {
          throw new BadRequestException(
            `Invoice ${invoice.invoiceNumber} is in status ${invoice.status}. Only ISSUED or PARTIALLY_PAID invoices can accept credit applications.`,
          );
        }

        if (appAmount.greaterThan(invoice.amountDue)) {
          throw new BadRequestException(
            `Applied amount (${appAmount.toFixed(4)}) exceeds invoice amount due (${invoice.amountDue.toFixed(4)}) for ${invoice.invoiceNumber}.`,
          );
        }

        const newAmountPaid = invoice.amountPaid.add(appAmount);
        const newAmountDue = invoice.amountDue.sub(appAmount);
        const newStatus = newAmountDue.isZero()
          ? CustomerInvoiceStatus.PAID
          : CustomerInvoiceStatus.PARTIALLY_PAID;

        // Update invoice
        await tx.customerInvoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: newAmountPaid,
            amountDue: newAmountDue,
            status: newStatus,
          },
        });

        // Record credit application
        await tx.customerCreditApplication.create({
          data: {
            organizationId,
            creditNoteId: id,
            customerInvoiceId: invoice.id,
            amount: appAmount,
            createdByUserId: actorUserId,
          },
        });
      }

      // 4. Update credit note balances and status
      const newAppliedAmount = creditNote.appliedAmount.add(totalAppAmount);
      const newRemainingAmount = creditNote.remainingAmount.sub(totalAppAmount);
      const newCreditStatus = newRemainingAmount.isZero()
        ? CreditNoteStatus.APPLIED
        : CreditNoteStatus.PARTIALLY_APPLIED;

      return tx.customerCreditNote.update({
        where: { id },
        data: {
          appliedAmount: newAppliedAmount,
          remainingAmount: newRemainingAmount,
          status: newCreditStatus,
        },
        include: {
          customer: true,
          currency: true,
          customerInvoice: true,
          lines: { include: { item: true, variant: true, location: true } },
          applications: { include: { customerInvoice: true } },
          refunds: true,
          journalEntry: true,
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_CREDIT_NOTE_APPLIED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_credit_note.apply',
      resource: 'customer_credit_note',
      resourceId: updatedCreditNote.id,
      details: {
        creditNoteNumber: updatedCreditNote.creditNoteNumber,
        appliedAmount: updatedCreditNote.appliedAmount.toFixed(4),
        remainingAmount: updatedCreditNote.remainingAmount.toFixed(4),
      },
    });

    return updatedCreditNote;
  }

  /**
   * 8. Void credit note (DRAFT/APPROVED/POSTED)
   */
  async void(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<CustomerCreditNoteWithDetails> {
    const creditNote = await this.findOne(organizationId, id);

    if (creditNote.status === CreditNoteStatus.VOIDED) {
      throw new BadRequestException('Credit note is already voided.');
    }

    if (creditNote.appliedAmount.greaterThan(0)) {
      throw new BadRequestException(
        `Cannot void credit note with active applications (${creditNote.appliedAmount.toFixed(4)} applied).`,
      );
    }

    // If POSTED, create compensating reversal journal entry
    let reversalJournalId: string | null = null;
    if (creditNote.status === CreditNoteStatus.POSTED) {
      const fiscalPeriod = await this.prisma.fiscalPeriod.findFirst({
        where: {
          organizationId,
          status: FiscalPeriodStatus.OPEN,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
      });
      if (!fiscalPeriod) {
        throw new BadRequestException(
          'No OPEN fiscal period found covering today to post reversal.',
        );
      }

      const arAccountId = await this.accountMappingService.resolveAccount(
        organizationId,
        'ACCOUNTS_RECEIVABLE',
      );

      let salesReturnsAccountId: string;
      try {
        salesReturnsAccountId = await this.accountMappingService.resolveAccount(
          organizationId,
          'SALES_RETURNS',
        );
      } catch {
        salesReturnsAccountId = await this.accountMappingService.resolveAccount(
          organizationId,
          'SALES_REVENUE',
        );
      }

      let outputTaxAccountId: string | null = null;
      if (creditNote.taxAmount.greaterThan(0)) {
        outputTaxAccountId = await this.accountMappingService.resolveAccount(
          organizationId,
          'OUTPUT_TAX',
        );
      }

      let journalNumber: string;
      try {
        const seq = await this.numberingService.nextNumber(
          organizationId,
          'JOURNAL_ENTRY',
          actorUserId,
        );
        journalNumber = seq.formatted;
      } catch {
        const count = await this.prisma.journalEntry.count({
          where: { organizationId },
        });
        journalNumber = `JE-${String(count + 1).padStart(6, '0')}`;
      }

      // Reversal:
      // Debit: Accounts Receivable (grandTotal)
      // Credit: Sales Returns (netReturns)
      // Credit: Output Tax (taxAmount, if > 0)
      const netReturns = creditNote.subtotal.sub(creditNote.discountAmount);
      const reversalLinesData: Array<{
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
          description: `Reversal of Credit Note ${creditNote.creditNoteNumber}`,
          debit: creditNote.grandTotal,
          credit: new Prisma.Decimal(0),
          lineNumber: 1,
        },
        {
          organizationId,
          accountId: salesReturnsAccountId,
          description: `Reversal of Credit Note ${creditNote.creditNoteNumber} - Sales Returns`,
          debit: new Prisma.Decimal(0),
          credit: netReturns,
          lineNumber: 2,
        },
      ];

      if (creditNote.taxAmount.greaterThan(0) && outputTaxAccountId) {
        reversalLinesData.push({
          organizationId,
          accountId: outputTaxAccountId,
          description: `Reversal of Credit Note ${creditNote.creditNoteNumber} - Tax Adjustment`,
          debit: new Prisma.Decimal(0),
          credit: creditNote.taxAmount,
          lineNumber: 3,
        });
      }

      const reversalGl = await this.prisma.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber: journalNumber,
          entryDate: new Date(),
          description: `Void Reversal: Credit Note ${creditNote.creditNoteNumber}`,
          status: JournalEntryStatus.POSTED,
          sourceType: 'REVERSAL',
          sourceId: creditNote.id,
          createdByUserId: actorUserId,
          postedByUserId: actorUserId,
          postedAt: new Date(),
          lines: { create: reversalLinesData },
        },
      });
      reversalJournalId = reversalGl.id;
    }

    const voided = await this.prisma.customerCreditNote.update({
      where: { id },
      data: {
        status: CreditNoteStatus.VOIDED,
        voidedAt: new Date(),
      },
      include: {
        customer: true,
        currency: true,
        customerInvoice: true,
        lines: { include: { item: true, variant: true, location: true } },
        applications: { include: { customerInvoice: true } },
        refunds: true,
        journalEntry: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_CREDIT_NOTE_VOIDED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_credit_note.void',
      resource: 'customer_credit_note',
      resourceId: voided.id,
      details: {
        creditNoteNumber: voided.creditNoteNumber,
        reversalJournalId,
      },
    });

    return voided;
  }
}
