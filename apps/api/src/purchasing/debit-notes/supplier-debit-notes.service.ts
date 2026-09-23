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
  CreateSupplierDebitNoteDto,
  CreateSupplierDebitNoteLineDto,
} from './dto/create-supplier-debit-note.dto';
import { UpdateSupplierDebitNoteDto } from './dto/update-supplier-debit-note.dto';
import { SupplierDebitNoteQueryDto } from './dto/supplier-debit-note-query.dto';
import { ApplySupplierDebitNoteDto } from './dto/apply-supplier-debit-note.dto';
import {
  DebitNoteStatus,
  FiscalPeriodStatus,
  JournalEntryStatus,
  Prisma,
  ReturnDisposition,
  StockMovementType,
  SupplierInvoiceStatus,
} from '@prisma/client';

interface ValidatedSupplierDebitLine {
  itemId: string;
  variantId?: string | null;
  supplierInvoiceLineId?: string | null;
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

export type SupplierDebitNoteWithDetails = Prisma.SupplierDebitNoteGetPayload<{
  include: {
    supplier: true;
    currency: true;
    supplierInvoice: true;
    lines: {
      include: {
        item: true;
        variant: true;
        location: true;
      };
    };
    applications: {
      include: {
        supplierInvoice: true;
      };
    };
    journalEntry: true;
  };
}>;

@Injectable()
export class SupplierDebitNotesService {
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
    linesDto: CreateSupplierDebitNoteLineDto[],
  ) {
    let subtotal = new Prisma.Decimal(0);
    let discountAmount = new Prisma.Decimal(0);
    let taxAmount = new Prisma.Decimal(0);

    const validatedLines: ValidatedSupplierDebitLine[] = [];

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
        supplierInvoiceLineId: l.supplierInvoiceLineId ?? null,
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
   * 1. Create draft supplier debit note
   */
  async create(
    organizationId: string,
    dto: CreateSupplierDebitNoteDto,
    actorUserId: string,
  ): Promise<SupplierDebitNoteWithDetails> {
    // 1. Validate supplier
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
        'Currency ID must be provided or configured on supplier profile.',
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

    // 3. Validate supplier invoice if provided
    if (dto.supplierInvoiceId) {
      const inv = await this.prisma.supplierInvoice.findFirst({
        where: {
          id: dto.supplierInvoiceId,
          organizationId,
          supplierId: dto.supplierId,
        },
      });
      if (!inv) {
        throw new BadRequestException(
          `Supplier Invoice ${dto.supplierInvoiceId} not found for this supplier.`,
        );
      }
    }

    // 4. Validate lines & compute totals
    const { validatedLines, subtotal, discountAmount, taxAmount, grandTotal } =
      await this.validateAndComputeLines(organizationId, dto.lines);

    // 5. Generate debit note number
    let debitNoteNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'DEBIT_NOTE',
        actorUserId,
      );
      debitNoteNumber = seq.formatted;
    } catch {
      const count = await this.prisma.supplierDebitNote.count({
        where: { organizationId },
      });
      debitNoteNumber = `DN-${String(count + 1).padStart(6, '0')}`;
    }

    // 6. Create in DB
    const debitNote = await this.prisma.supplierDebitNote.create({
      data: {
        organizationId,
        debitNoteNumber,
        supplierId: dto.supplierId,
        supplierInvoiceId: dto.supplierInvoiceId ?? null,
        purchaseOrderId: dto.purchaseOrderId ?? null,
        currencyId,
        debitDate: new Date(dto.debitDate),
        reason: dto.reason ?? null,
        notes: dto.notes ?? null,
        subtotal,
        discountAmount,
        taxAmount,
        grandTotal,
        appliedAmount: new Prisma.Decimal(0),
        remainingAmount: grandTotal,
        status: DebitNoteStatus.DRAFT,
        createdByUserId: actorUserId,
        lines: {
          create: validatedLines.map((vl) => ({
            organizationId,
            itemId: vl.itemId,
            variantId: vl.variantId,
            supplierInvoiceLineId: vl.supplierInvoiceLineId,
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
        supplier: true,
        currency: true,
        supplierInvoice: true,
        lines: {
          include: {
            item: true,
            variant: true,
            location: true,
          },
        },
        applications: {
          include: {
            supplierInvoice: true,
          },
        },
        journalEntry: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_DEBIT_NOTE_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'supplier_debit_note.create',
      resource: 'supplier_debit_note',
      resourceId: debitNote.id,
      details: {
        debitNoteNumber: debitNote.debitNoteNumber,
        grandTotal: debitNote.grandTotal.toFixed(4),
      },
    });

    return debitNote;
  }

  /**
   * 2. Find all debit notes
   */
  async findAll(organizationId: string, query: SupplierDebitNoteQueryDto) {
    const where: Prisma.SupplierDebitNoteWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.supplierInvoiceId
        ? { supplierInvoiceId: query.supplierInvoiceId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.startDate || query.endDate
        ? {
            debitDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                debitNoteNumber: {
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
      this.prisma.supplierDebitNote.findMany({
        where,
        include: {
          supplier: true,
          currency: true,
          supplierInvoice: true,
          lines: {
            include: { item: true, variant: true, location: true },
          },
          applications: {
            include: { supplierInvoice: true },
          },
          journalEntry: true,
        },
        orderBy: [{ debitDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.supplierDebitNote.count({ where }),
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
   * 3. Find one debit note
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<SupplierDebitNoteWithDetails> {
    const debitNote = await this.prisma.supplierDebitNote.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        supplier: true,
        currency: true,
        supplierInvoice: true,
        lines: {
          include: { item: true, variant: true, location: true },
          orderBy: { lineNumber: 'asc' },
        },
        applications: {
          include: { supplierInvoice: true },
          orderBy: { appliedAt: 'desc' },
        },
        journalEntry: true,
      },
    });

    if (!debitNote) {
      throw new NotFoundException(
        `Supplier Debit Note with ID ${id} not found.`,
      );
    }

    return debitNote;
  }

  /**
   * 4. Update draft debit note
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateSupplierDebitNoteDto,
  ): Promise<SupplierDebitNoteWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== DebitNoteStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT debit notes can be edited. Current status: ${existing.status}`,
      );
    }

    let subtotal = existing.subtotal;
    let discountAmount = existing.discountAmount;
    let taxAmount = existing.taxAmount;
    let grandTotal = existing.grandTotal;
    let validatedLines: ValidatedSupplierDebitLine[] | null = null;

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
        await tx.supplierDebitNoteLine.deleteMany({
          where: { debitNoteId: id },
        });
        await tx.supplierDebitNoteLine.createMany({
          data: validatedLines.map((vl) => ({
            debitNoteId: id,
            organizationId,
            itemId: vl.itemId,
            variantId: vl.variantId,
            supplierInvoiceLineId: vl.supplierInvoiceLineId,
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

      return tx.supplierDebitNote.update({
        where: { id },
        data: {
          currencyId: dto.currencyId ?? existing.currencyId,
          debitDate: dto.debitDate
            ? new Date(dto.debitDate)
            : existing.debitDate,
          reason: dto.reason !== undefined ? dto.reason : existing.reason,
          notes: dto.notes !== undefined ? dto.notes : existing.notes,
          subtotal,
          discountAmount,
          taxAmount,
          grandTotal,
          remainingAmount: grandTotal.sub(existing.appliedAmount),
        },
        include: {
          supplier: true,
          currency: true,
          supplierInvoice: true,
          lines: {
            include: { item: true, variant: true, location: true },
          },
          applications: {
            include: { supplierInvoice: true },
          },
          journalEntry: true,
        },
      });
    });

    return updated;
  }

  /**
   * 5. Approve draft debit note (DRAFT -> APPROVED)
   */
  async approve(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<SupplierDebitNoteWithDetails> {
    const debitNote = await this.findOne(organizationId, id);

    if (debitNote.status !== DebitNoteStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT debit notes can be approved. Current status: ${debitNote.status}`,
      );
    }

    const approved = await this.prisma.supplierDebitNote.update({
      where: { id },
      data: {
        status: DebitNoteStatus.APPROVED,
        approvedByUserId: actorUserId,
        approvedAt: new Date(),
      },
      include: {
        supplier: true,
        currency: true,
        supplierInvoice: true,
        lines: { include: { item: true, variant: true, location: true } },
        applications: { include: { supplierInvoice: true } },
        journalEntry: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_DEBIT_NOTE_APPROVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'supplier_debit_note.approve',
      resource: 'supplier_debit_note',
      resourceId: approved.id,
      details: { debitNoteNumber: approved.debitNoteNumber },
    });

    return approved;
  }

  /**
   * 6. Post debit note to GL and optionally adjust inventory (APPROVED -> POSTED)
   */
  async post(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<SupplierDebitNoteWithDetails> {
    const debitNote = await this.findOne(organizationId, id);

    if (
      debitNote.status !== DebitNoteStatus.APPROVED &&
      debitNote.status !== DebitNoteStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Cannot post debit note in status: ${debitNote.status}. Must be DRAFT or APPROVED.`,
      );
    }

    // 1. Resolve open fiscal period
    const fiscalPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: {
        organizationId,
        status: FiscalPeriodStatus.OPEN,
        startDate: { lte: debitNote.debitDate },
        endDate: { gte: debitNote.debitDate },
      },
    });
    if (!fiscalPeriod) {
      throw new BadRequestException(
        `No OPEN fiscal period found covering debit date (${debitNote.debitDate.toISOString().slice(0, 10)}).`,
      );
    }

    // 2. Resolve account mappings
    const apAccountId = await this.accountMappingService.resolveAccount(
      organizationId,
      'ACCOUNTS_PAYABLE',
    );
    const purchaseExpenseAccountId =
      await this.accountMappingService.resolveAccount(
        organizationId,
        'PURCHASE_EXPENSE',
      );

    let inputTaxAccountId: string | null = null;
    if (debitNote.taxAmount.greaterThan(0)) {
      inputTaxAccountId = await this.accountMappingService.resolveAccount(
        organizationId,
        'INPUT_TAX',
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
    // Debit: Accounts Payable (grandTotal)
    // Credit: Purchase Expense (subtotal - discount)
    // Credit: Input Tax (taxAmount, if > 0)
    const netExpense = debitNote.subtotal.sub(debitNote.discountAmount);
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
        accountId: apAccountId,
        description: `Debit Note ${debitNote.debitNoteNumber} - ${debitNote.supplier.name}`,
        debit: debitNote.grandTotal,
        credit: new Prisma.Decimal(0),
        lineNumber: 1,
      },
      {
        organizationId,
        accountId: purchaseExpenseAccountId,
        description: `Debit Note ${debitNote.debitNoteNumber} - Purchase Adjustment`,
        debit: new Prisma.Decimal(0),
        credit: netExpense,
        lineNumber: 2,
      },
    ];

    if (debitNote.taxAmount.greaterThan(0) && inputTaxAccountId) {
      journalLinesData.push({
        organizationId,
        accountId: inputTaxAccountId,
        description: `Debit Note ${debitNote.debitNoteNumber} - Input Tax Adjustment`,
        debit: new Prisma.Decimal(0),
        credit: debitNote.taxAmount,
        lineNumber: 3,
      });
    }

    // 5. Execute in transaction
    const posted = await this.prisma.$transaction(async (tx) => {
      // 5.1 Create posted journal entry
      const glEntry = await tx.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber: journalNumber,
          entryDate: debitNote.debitDate,
          description: `Supplier Debit Note: ${debitNote.debitNoteNumber} (${debitNote.supplier.name})`,
          status: JournalEntryStatus.POSTED,
          sourceType: 'SUPPLIER_DEBIT_NOTE',
          sourceId: debitNote.id,
          createdByUserId: actorUserId,
          postedByUserId: actorUserId,
          postedAt: new Date(),
          lines: { create: journalLinesData },
        },
      });

      // 5.2 Process inventory return to supplier (StockMovement ISSUE)
      for (const line of debitNote.lines) {
        if (line.returnToInventory && line.locationId) {
          await this.balancesService.applyStockMovement(
            organizationId,
            {
              itemId: line.itemId,
              variantId: line.variantId,
              locationId: line.locationId,
              movementType: StockMovementType.ISSUE,
              quantity: new Prisma.Decimal(line.quantity).toNumber(),
              referenceType: 'SUPPLIER_DEBIT_NOTE',
              referenceId: debitNote.id,
              reason: `Supplier Return - ${debitNote.debitNoteNumber}`,
            },
            actorUserId,
            tx,
          );
        }
      }

      // 5.3 Update debit note status
      return tx.supplierDebitNote.update({
        where: { id },
        data: {
          status: DebitNoteStatus.POSTED,
          postedByUserId: actorUserId,
          postedAt: new Date(),
          journalEntryId: glEntry.id,
        },
        include: {
          supplier: true,
          currency: true,
          supplierInvoice: true,
          lines: { include: { item: true, variant: true, location: true } },
          applications: { include: { supplierInvoice: true } },
          journalEntry: true,
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_DEBIT_NOTE_POSTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'supplier_debit_note.post',
      resource: 'supplier_debit_note',
      resourceId: posted.id,
      details: {
        debitNoteNumber: posted.debitNoteNumber,
        grandTotal: posted.grandTotal.toFixed(4),
        journalEntryId: posted.journalEntryId,
      },
    });

    return posted;
  }

  /**
   * 7. Apply debit note against supplier invoices
   */
  async apply(
    organizationId: string,
    id: string,
    dto: ApplySupplierDebitNoteDto,
    actorUserId: string,
  ): Promise<SupplierDebitNoteWithDetails> {
    const updatedDebitNote = await this.prisma.$transaction(async (tx) => {
      // 1. Fetch current debit note
      const debitNote = await tx.supplierDebitNote.findFirst({
        where: { id, organizationId, deletedAt: null },
      });
      if (!debitNote) {
        throw new NotFoundException(
          `Supplier Debit Note with ID ${id} not found.`,
        );
      }

      if (
        debitNote.status !== DebitNoteStatus.POSTED &&
        debitNote.status !== DebitNoteStatus.PARTIALLY_APPLIED
      ) {
        throw new BadRequestException(
          `Debit note must be POSTED or PARTIALLY_APPLIED to be applied. Current status: ${debitNote.status}`,
        );
      }

      // 2. Validate total application amount against remaining debit
      let totalAppAmount = new Prisma.Decimal(0);
      for (const app of dto.applications) {
        totalAppAmount = totalAppAmount.add(new Prisma.Decimal(app.amount));
      }

      if (totalAppAmount.greaterThan(debitNote.remainingAmount)) {
        throw new BadRequestException(
          `Total application amount (${totalAppAmount.toFixed(4)}) exceeds debit note remaining amount (${debitNote.remainingAmount.toFixed(4)}).`,
        );
      }

      // 3. Process each invoice application
      for (const app of dto.applications) {
        const appAmount = new Prisma.Decimal(app.amount);
        const invoice = await tx.supplierInvoice.findFirst({
          where: {
            id: app.supplierInvoiceId,
            organizationId,
            supplierId: debitNote.supplierId,
          },
        });

        if (!invoice) {
          throw new NotFoundException(
            `Supplier invoice ${app.supplierInvoiceId} not found for this supplier.`,
          );
        }

        if (
          invoice.status !== SupplierInvoiceStatus.POSTED &&
          invoice.status !== SupplierInvoiceStatus.PARTIALLY_PAID
        ) {
          throw new BadRequestException(
            `Invoice ${invoice.invoiceNumber} is in status ${invoice.status}. Only POSTED or PARTIALLY_PAID invoices can accept debit applications.`,
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
          ? SupplierInvoiceStatus.PAID
          : SupplierInvoiceStatus.PARTIALLY_PAID;

        // Update supplier invoice
        await tx.supplierInvoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: newAmountPaid,
            amountDue: newAmountDue,
            status: newStatus,
          },
        });

        // Record debit application
        await tx.supplierDebitApplication.create({
          data: {
            organizationId,
            debitNoteId: id,
            supplierInvoiceId: invoice.id,
            amount: appAmount,
            createdByUserId: actorUserId,
          },
        });
      }

      // 4. Update debit note balances and status
      const newAppliedAmount = debitNote.appliedAmount.add(totalAppAmount);
      const newRemainingAmount = debitNote.remainingAmount.sub(totalAppAmount);
      const newDebitStatus = newRemainingAmount.isZero()
        ? DebitNoteStatus.APPLIED
        : DebitNoteStatus.PARTIALLY_APPLIED;

      return tx.supplierDebitNote.update({
        where: { id },
        data: {
          appliedAmount: newAppliedAmount,
          remainingAmount: newRemainingAmount,
          status: newDebitStatus,
        },
        include: {
          supplier: true,
          currency: true,
          supplierInvoice: true,
          lines: { include: { item: true, variant: true, location: true } },
          applications: { include: { supplierInvoice: true } },
          journalEntry: true,
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_DEBIT_NOTE_APPLIED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'supplier_debit_note.apply',
      resource: 'supplier_debit_note',
      resourceId: updatedDebitNote.id,
      details: {
        debitNoteNumber: updatedDebitNote.debitNoteNumber,
        appliedAmount: updatedDebitNote.appliedAmount.toFixed(4),
        remainingAmount: updatedDebitNote.remainingAmount.toFixed(4),
      },
    });

    return updatedDebitNote;
  }

  /**
   * 8. Void supplier debit note
   */
  async void(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<SupplierDebitNoteWithDetails> {
    const debitNote = await this.findOne(organizationId, id);

    if (debitNote.status === DebitNoteStatus.VOIDED) {
      throw new BadRequestException('Debit note is already voided.');
    }

    if (debitNote.appliedAmount.greaterThan(0)) {
      throw new BadRequestException(
        `Cannot void debit note with active applications (${debitNote.appliedAmount.toFixed(4)} applied).`,
      );
    }

    let reversalJournalId: string | null = null;
    if (debitNote.status === DebitNoteStatus.POSTED) {
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

      const apAccountId = await this.accountMappingService.resolveAccount(
        organizationId,
        'ACCOUNTS_PAYABLE',
      );
      const purchaseExpenseAccountId =
        await this.accountMappingService.resolveAccount(
          organizationId,
          'PURCHASE_EXPENSE',
        );

      let inputTaxAccountId: string | null = null;
      if (debitNote.taxAmount.greaterThan(0)) {
        inputTaxAccountId = await this.accountMappingService.resolveAccount(
          organizationId,
          'INPUT_TAX',
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
      // Debit: Purchase Expense (netExpense)
      // Debit: Input Tax (taxAmount, if > 0)
      // Credit: Accounts Payable (grandTotal)
      const netExpense = debitNote.subtotal.sub(debitNote.discountAmount);
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
          accountId: purchaseExpenseAccountId,
          description: `Reversal of Debit Note ${debitNote.debitNoteNumber} - Purchase Expense`,
          debit: netExpense,
          credit: new Prisma.Decimal(0),
          lineNumber: 1,
        },
      ];

      let lineCounter = 2;
      if (debitNote.taxAmount.greaterThan(0) && inputTaxAccountId) {
        reversalLinesData.push({
          organizationId,
          accountId: inputTaxAccountId,
          description: `Reversal of Debit Note ${debitNote.debitNoteNumber} - Input Tax`,
          debit: debitNote.taxAmount,
          credit: new Prisma.Decimal(0),
          lineNumber: lineCounter++,
        });
      }

      reversalLinesData.push({
        organizationId,
        accountId: apAccountId,
        description: `Reversal of Debit Note ${debitNote.debitNoteNumber} - Accounts Payable`,
        debit: new Prisma.Decimal(0),
        credit: debitNote.grandTotal,
        lineNumber: lineCounter,
      });

      const reversalGl = await this.prisma.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber: journalNumber,
          entryDate: new Date(),
          description: `Void Reversal: Debit Note ${debitNote.debitNoteNumber}`,
          status: JournalEntryStatus.POSTED,
          sourceType: 'REVERSAL',
          sourceId: debitNote.id,
          createdByUserId: actorUserId,
          postedByUserId: actorUserId,
          postedAt: new Date(),
          lines: { create: reversalLinesData },
        },
      });
      reversalJournalId = reversalGl.id;
    }

    const voided = await this.prisma.supplierDebitNote.update({
      where: { id },
      data: {
        status: DebitNoteStatus.VOIDED,
        voidedAt: new Date(),
      },
      include: {
        supplier: true,
        currency: true,
        supplierInvoice: true,
        lines: { include: { item: true, variant: true, location: true } },
        applications: { include: { supplierInvoice: true } },
        journalEntry: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_DEBIT_NOTE_VOIDED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'supplier_debit_note.void',
      resource: 'supplier_debit_note',
      resourceId: voided.id,
      details: {
        debitNoteNumber: voided.debitNoteNumber,
        reversalJournalId,
      },
    });

    return voided;
  }
}
