import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { TaxRatesService } from '../tax/tax-rates.service';
import { TaxTransactionsService } from '../tax/tax-transactions.service';
import {
  CreateExpenseClaimDto,
  CreateExpenseClaimLineDto,
} from './dto/create-expense-claim.dto';
import { UpdateExpenseClaimDto } from './dto/update-expense-claim.dto';
import { RejectExpenseClaimDto } from './dto/reject-expense-claim.dto';
import { CreateExpenseReceiptDto } from './dto/create-expense-receipt.dto';
import { ExpenseReportQueryDto } from './dto/expense-report-query.dto';
import {
  Prisma,
  ExpenseClaimStatus,
  FiscalPeriodStatus,
  JournalEntryStatus,
  TaxScope,
} from '@prisma/client';

@Injectable()
export class ExpenseClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly accountMappingService: ApAccountMappingService,
    private readonly taxRatesService: TaxRatesService,
    private readonly taxTransactionsService: TaxTransactionsService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateExpenseClaimDto,
    actorUserId: string,
  ) {
    const claimant = await this.prisma.expenseClaimant.findFirst({
      where: { id: dto.claimantId, organizationId, deletedAt: null },
    });
    if (!claimant) {
      throw new NotFoundException('Expense claimant not found.');
    }
    if (!claimant.isActive) {
      throw new BadRequestException('Expense claimant is inactive.');
    }

    const currency = await this.prisma.currency.findFirst({
      where: { id: dto.currencyId },
    });
    if (!currency) {
      throw new NotFoundException('Currency not found.');
    }

    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException(
        'Expense claim must contain at least one line item.',
      );
    }

    let claimNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'EXPENSE_CLAIM',
        actorUserId,
      );
      claimNumber = seq.formatted;
    } catch {
      const count = await this.prisma.expenseClaim.count({
        where: { organizationId },
      });
      claimNumber = `EX-${String(count + 1).padStart(6, '0')}`;
    }

    const processedLines = await this.processLines(
      organizationId,
      dto.lines,
      new Date(dto.claimDate),
    );

    let subtotalSum = new Prisma.Decimal(0);
    let taxSum = new Prisma.Decimal(0);
    let totalSum = new Prisma.Decimal(0);

    for (const l of processedLines) {
      subtotalSum = subtotalSum.add(l.subtotal);
      taxSum = taxSum.add(l.taxAmount);
      totalSum = totalSum.add(l.totalAmount);
    }

    const claim = await this.prisma.expenseClaim.create({
      data: {
        organizationId,
        claimNumber,
        claimantId: dto.claimantId,
        claimDate: new Date(dto.claimDate),
        description: dto.description,
        currencyId: dto.currencyId,
        status: ExpenseClaimStatus.DRAFT,
        subtotal: subtotalSum,
        taxAmount: taxSum,
        totalAmount: totalSum,
        approvedAmount: new Prisma.Decimal(0),
        paidAmount: new Prisma.Decimal(0),
        dueAmount: new Prisma.Decimal(0),
        createdByUserId: actorUserId,
        lines: {
          create: processedLines.map((l) => ({
            organizationId,
            categoryId: l.categoryId,
            description: l.description,
            expenseDate: l.expenseDate,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            subtotal: l.subtotal,
            taxCodeId: l.taxCodeId,
            taxRate: l.taxRate,
            taxAmount: l.taxAmount,
            totalAmount: l.totalAmount,
            glAccountId: l.glAccountId,
            receiptReference: l.receiptReference,
            receiptFilename: l.receiptFilename,
            receiptMimeType: l.receiptMimeType,
          })),
        },
      },
      include: {
        claimant: true,
        currency: true,
        lines: { include: { category: true, glAccount: true, taxCode: true } },
      },
    });

    await this.eventBus.publish({
      eventName: 'EXPENSE_CLAIM_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'expense_claim.created',
      resource: 'expense_claim',
      resourceId: claim.id,
      details: {
        claimNumber: claim.claimNumber,
        totalAmount: totalSum.toFixed(4),
      },
    });

    return claim;
  }

  async findAll(organizationId: string, query: ExpenseReportQueryDto) {
    const where: Prisma.ExpenseClaimWhereInput = {
      organizationId,
      ...(query.claimantId ? { claimantId: query.claimantId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.currencyId ? { currencyId: query.currencyId } : {}),
      ...(query.startDate || query.endDate
        ? {
            claimDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.expenseClaim.findMany({
        where,
        include: {
          claimant: true,
          currency: true,
          lines: {
            include: { category: true, glAccount: true, taxCode: true },
          },
          receipts: true,
        },
        orderBy: { claimDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.expenseClaim.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(organizationId: string, id: string) {
    const claim = await this.prisma.expenseClaim.findFirst({
      where: { id, organizationId },
      include: {
        claimant: true,
        currency: true,
        lines: {
          include: { category: true, glAccount: true, taxCode: true },
        },
        receipts: true,
        journalEntry: { include: { lines: true } },
        allocations: { include: { payment: true } },
      },
    });
    if (!claim) {
      throw new NotFoundException(`Expense claim ${id} not found.`);
    }
    return claim;
  }

  async update(organizationId: string, id: string, dto: UpdateExpenseClaimDto) {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== ExpenseClaimStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot update expense claim in status ${existing.status}. Only DRAFT claims can be edited.`,
      );
    }

    const claimDate = dto.claimDate
      ? new Date(dto.claimDate)
      : existing.claimDate;

    let subtotalSum = existing.subtotal;
    let taxSum = existing.taxAmount;
    let totalSum = existing.totalAmount;

    let processedLines = undefined;
    if (dto.lines) {
      if (dto.lines.length === 0) {
        throw new BadRequestException('Expense claim cannot have empty lines.');
      }
      processedLines = await this.processLines(
        organizationId,
        dto.lines,
        claimDate,
      );
      subtotalSum = new Prisma.Decimal(0);
      taxSum = new Prisma.Decimal(0);
      totalSum = new Prisma.Decimal(0);

      for (const l of processedLines) {
        subtotalSum = subtotalSum.add(l.subtotal);
        taxSum = taxSum.add(l.taxAmount);
        totalSum = totalSum.add(l.totalAmount);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (processedLines) {
        await tx.expenseClaimLine.deleteMany({
          where: { organizationId, expenseClaimId: existing.id },
        });

        await tx.expenseClaimLine.createMany({
          data: processedLines.map((l) => ({
            organizationId,
            expenseClaimId: existing.id,
            categoryId: l.categoryId,
            description: l.description,
            expenseDate: l.expenseDate,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            subtotal: l.subtotal,
            taxCodeId: l.taxCodeId,
            taxRate: l.taxRate,
            taxAmount: l.taxAmount,
            totalAmount: l.totalAmount,
            glAccountId: l.glAccountId,
            receiptReference: l.receiptReference,
            receiptFilename: l.receiptFilename,
            receiptMimeType: l.receiptMimeType,
          })),
        });
      }

      return tx.expenseClaim.update({
        where: { id: existing.id },
        data: {
          ...(dto.claimantId !== undefined
            ? { claimantId: dto.claimantId }
            : {}),
          ...(dto.claimDate !== undefined ? { claimDate } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.currencyId !== undefined
            ? { currencyId: dto.currencyId }
            : {}),
          subtotal: subtotalSum,
          taxAmount: taxSum,
          totalAmount: totalSum,
        },
        include: {
          claimant: true,
          currency: true,
          lines: {
            include: { category: true, glAccount: true, taxCode: true },
          },
        },
      });
    });
  }

  async submit(organizationId: string, id: string, actorUserId: string) {
    const claim = await this.findOne(organizationId, id);

    if (claim.status !== ExpenseClaimStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot submit expense claim in status ${claim.status}.`,
      );
    }
    if (!claim.lines || claim.lines.length === 0) {
      throw new BadRequestException(
        'Cannot submit expense claim with zero line items.',
      );
    }
    if (!claim.claimant.isActive) {
      throw new BadRequestException(
        'Cannot submit expense claim for inactive claimant.',
      );
    }

    const updated = await this.prisma.expenseClaim.update({
      where: { id: claim.id },
      data: {
        status: ExpenseClaimStatus.SUBMITTED,
        submittedAt: new Date(),
      },
      include: { claimant: true, currency: true, lines: true },
    });

    await this.eventBus.publish({
      eventName: 'EXPENSE_CLAIM_SUBMITTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'expense_claim.submitted',
      resource: 'expense_claim',
      resourceId: updated.id,
      details: {
        claimNumber: updated.claimNumber,
        totalAmount: updated.totalAmount.toFixed(4),
      },
    });

    return updated;
  }

  async approve(organizationId: string, id: string, actorUserId: string) {
    const claim = await this.findOne(organizationId, id);

    if (claim.status !== ExpenseClaimStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot approve expense claim in status ${claim.status}. Must be SUBMITTED.`,
      );
    }

    const updated = await this.prisma.expenseClaim.update({
      where: { id: claim.id },
      data: {
        status: ExpenseClaimStatus.APPROVED,
        approvedAt: new Date(),
        approvedByUserId: actorUserId,
        approvedAmount: claim.totalAmount,
        dueAmount: claim.totalAmount,
      },
      include: { claimant: true, currency: true, lines: true },
    });

    await this.eventBus.publish({
      eventName: 'EXPENSE_CLAIM_APPROVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'expense_claim.approved',
      resource: 'expense_claim',
      resourceId: updated.id,
      details: {
        claimNumber: updated.claimNumber,
        approvedAmount: updated.approvedAmount.toFixed(4),
      },
    });

    return updated;
  }

  async reject(
    organizationId: string,
    id: string,
    dto: RejectExpenseClaimDto,
    actorUserId: string,
  ) {
    const claim = await this.findOne(organizationId, id);

    if (claim.status !== ExpenseClaimStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot reject expense claim in status ${claim.status}. Must be SUBMITTED.`,
      );
    }

    const updated = await this.prisma.expenseClaim.update({
      where: { id: claim.id },
      data: {
        status: ExpenseClaimStatus.REJECTED,
        rejectionReason: dto.reason,
      },
      include: { claimant: true, currency: true, lines: true },
    });

    await this.eventBus.publish({
      eventName: 'EXPENSE_CLAIM_REJECTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'expense_claim.rejected',
      resource: 'expense_claim',
      resourceId: updated.id,
      details: { claimNumber: updated.claimNumber, reason: dto.reason },
    });

    return updated;
  }

  async cancel(organizationId: string, id: string, actorUserId: string) {
    const claim = await this.findOne(organizationId, id);

    if (
      claim.status !== ExpenseClaimStatus.DRAFT &&
      claim.status !== ExpenseClaimStatus.SUBMITTED
    ) {
      throw new BadRequestException(
        `Cannot cancel expense claim in status ${claim.status}.`,
      );
    }

    const updated = await this.prisma.expenseClaim.update({
      where: { id: claim.id },
      data: {
        status: ExpenseClaimStatus.CANCELLED,
      },
      include: { claimant: true, currency: true, lines: true },
    });

    await this.eventBus.publish({
      eventName: 'EXPENSE_CLAIM_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'expense_claim.cancelled',
      resource: 'expense_claim',
      resourceId: updated.id,
      details: { claimNumber: updated.claimNumber },
    });

    return updated;
  }

  async post(organizationId: string, id: string, actorUserId: string) {
    const claim = await this.findOne(organizationId, id);

    if (claim.status !== ExpenseClaimStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot post expense claim in status ${claim.status}. Must be APPROVED.`,
      );
    }

    const fiscalPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: {
        organizationId,
        status: FiscalPeriodStatus.OPEN,
        startDate: { lte: claim.claimDate },
        endDate: { gte: claim.claimDate },
      },
    });

    if (!fiscalPeriod) {
      throw new BadRequestException(
        `No OPEN fiscal period found covering expense date ${claim.claimDate.toISOString().slice(0, 10)}.`,
      );
    }

    const defaultExpenseAccountId =
      await this.accountMappingService.resolveAccount(
        organizationId,
        'EXPENSE_REIMBURSEMENT',
      );
    const payableAccountId = await this.accountMappingService.resolveAccount(
      organizationId,
      'EMPLOYEE_EXPENSE_PAYABLE',
    );
    const inputTaxAccountId = await this.accountMappingService.resolveAccount(
      organizationId,
      'INPUT_TAX',
    );

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
      journalNumber = `JE-EX-${String(count + 1).padStart(6, '0')}`;
    }

    const journalLinesData: Array<{
      organizationId: string;
      accountId: string;
      description: string;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
      lineNumber: number;
    }> = [];
    let lineNum = 1;

    // 1. Line Expense Debits
    for (const line of claim.lines) {
      const lineAccountId =
        line.glAccountId ??
        line.category?.glAccountId ??
        defaultExpenseAccountId;

      journalLinesData.push({
        organizationId,
        accountId: lineAccountId,
        description: `Expense: ${line.description}`,
        debit: line.subtotal,
        credit: new Prisma.Decimal(0),
        lineNumber: lineNum++,
      });
    }

    // 2. Input Tax Debit (if applicable)
    if (claim.taxAmount.greaterThan(0)) {
      journalLinesData.push({
        organizationId,
        accountId: inputTaxAccountId,
        description: `Expense Input Tax - Claim ${claim.claimNumber}`,
        debit: claim.taxAmount,
        credit: new Prisma.Decimal(0),
        lineNumber: lineNum++,
      });
    }

    // 3. Employee Expense Payable Credit
    journalLinesData.push({
      organizationId,
      accountId: payableAccountId,
      description: `Employee Payable - ${claim.claimant.name} (${claim.claimNumber})`,
      debit: new Prisma.Decimal(0),
      credit: claim.totalAmount,
      lineNumber: lineNum++,
    });

    const updatedClaim = await this.prisma.$transaction(async (tx) => {
      const glEntry = await tx.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber: journalNumber,
          entryDate: claim.claimDate,
          description: `Expense Claim: ${claim.claimNumber} - ${claim.description}`,
          status: JournalEntryStatus.POSTED,
          sourceType: 'EXPENSE_CLAIM',
          sourceId: claim.id,
          createdByUserId: actorUserId,
          postedByUserId: actorUserId,
          postedAt: new Date(),
          lines: { create: journalLinesData },
        },
      });

      // Record Tax Transaction in tax sub-ledger if tax > 0
      if (claim.taxAmount.greaterThan(0)) {
        for (const line of claim.lines) {
          if (line.taxCodeId && line.taxAmount.greaterThan(0)) {
            await this.taxTransactionsService.record(
              organizationId,
              {
                taxCodeId: line.taxCodeId,
                transactionDate: line.expenseDate.toISOString(),
                taxScope: TaxScope.INPUT,
                sourceType: 'EXPENSE_CLAIM',
                sourceId: line.id,
                sourceNumber: claim.claimNumber,
                taxableAmount: line.subtotal.toNumber(),
                taxRate: line.taxRate.toNumber(),
                taxAmount: line.taxAmount.toNumber(),
                journalEntryId: glEntry.id,
              },
              actorUserId,
              tx,
            );
          }
        }
      }

      return tx.expenseClaim.update({
        where: { id: claim.id },
        data: {
          status: ExpenseClaimStatus.POSTED,
          postedAt: new Date(),
          postedByUserId: actorUserId,
          journalEntryId: glEntry.id,
        },
        include: {
          claimant: true,
          currency: true,
          lines: true,
          journalEntry: { include: { lines: true } },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'EXPENSE_CLAIM_POSTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'expense_claim.posted',
      resource: 'expense_claim',
      resourceId: updatedClaim.id,
      details: {
        claimNumber: updatedClaim.claimNumber,
        totalAmount: updatedClaim.totalAmount.toFixed(4),
        journalEntryId: updatedClaim.journalEntryId,
      },
    });

    return updatedClaim;
  }

  async void(organizationId: string, id: string, actorUserId: string) {
    const claim = await this.findOne(organizationId, id);

    if (claim.status !== ExpenseClaimStatus.POSTED) {
      throw new BadRequestException(
        `Cannot void expense claim in status ${claim.status}. Must be POSTED.`,
      );
    }

    if (claim.paidAmount.greaterThan(0)) {
      throw new BadRequestException(
        `Cannot void expense claim ${claim.claimNumber} with existing payments of ${claim.paidAmount.toFixed(4)}.`,
      );
    }

    const originalJe = claim.journalEntry;
    if (!originalJe) {
      throw new BadRequestException(
        'Original journal entry not found for posted claim.',
      );
    }

    const fiscalPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: {
        organizationId,
        status: FiscalPeriodStatus.OPEN,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    });
    if (!fiscalPeriod) {
      throw new BadRequestException('No OPEN fiscal period found for voiding.');
    }

    let reversalNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'JOURNAL_ENTRY',
        actorUserId,
      );
      reversalNumber = seq.formatted;
    } catch {
      const count = await this.prisma.journalEntry.count({
        where: { organizationId },
      });
      reversalNumber = `JE-REV-${String(count + 1).padStart(6, '0')}`;
    }

    const reversalLines: Array<{
      organizationId: string;
      accountId: string;
      description: string;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
      lineNumber: number;
    }> = originalJe.lines.map((l, index) => ({
      organizationId,
      accountId: l.accountId,
      description: `Reversal of ${originalJe.entryNumber}: ${l.description ?? ''}`,
      debit: l.credit,
      credit: l.debit,
      lineNumber: index + 1,
    }));

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber: reversalNumber,
          entryDate: new Date(),
          description: `Compensating Reversal of Expense Claim ${claim.claimNumber}`,
          status: JournalEntryStatus.POSTED,
          sourceType: 'EXPENSE_CLAIM_REVERSAL',
          sourceId: claim.id,
          createdByUserId: actorUserId,
          postedByUserId: actorUserId,
          postedAt: new Date(),
          lines: { create: reversalLines },
        },
      });

      return tx.expenseClaim.update({
        where: { id: claim.id },
        data: {
          status: ExpenseClaimStatus.VOIDED,
          dueAmount: new Prisma.Decimal(0),
        },
        include: { claimant: true, currency: true, lines: true },
      });
    });

    await this.eventBus.publish({
      eventName: 'EXPENSE_CLAIM_VOIDED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'expense_claim.voided',
      resource: 'expense_claim',
      resourceId: updated.id,
      details: { claimNumber: updated.claimNumber },
    });

    return updated;
  }

  async addReceipt(
    organizationId: string,
    claimId: string,
    dto: CreateExpenseReceiptDto,
    actorUserId: string,
  ) {
    const claim = await this.findOne(organizationId, claimId);

    if (dto.expenseClaimLineId) {
      const line = await this.prisma.expenseClaimLine.findFirst({
        where: {
          id: dto.expenseClaimLineId,
          expenseClaimId: claim.id,
          organizationId,
        },
      });
      if (!line) {
        throw new NotFoundException('Specified claim line item not found.');
      }
    }

    return this.prisma.expenseReceipt.create({
      data: {
        organizationId,
        expenseClaimId: claim.id,
        expenseClaimLineId: dto.expenseClaimLineId,
        filename: dto.filename,
        mimeType: dto.mimeType,
        storageKey: dto.storageKey,
        fileSize: dto.fileSize,
        uploadedByUserId: actorUserId,
      },
    });
  }

  private async processLines(
    organizationId: string,
    lines: CreateExpenseClaimLineDto[],
    txDate: Date,
  ) {
    const categoryIds = lines.map((l) => l.categoryId);
    const categories = await this.prisma.expenseCategory.findMany({
      where: { id: { in: categoryIds }, organizationId, deletedAt: null },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const processed = [];

    for (const l of lines) {
      const category = categoryMap.get(l.categoryId);
      if (!category) {
        throw new NotFoundException(
          `Expense category ${l.categoryId} not found.`,
        );
      }

      const qty = new Prisma.Decimal(l.quantity);
      const unitPrice = new Prisma.Decimal(l.unitPrice);
      const subtotal = qty.mul(unitPrice);

      const taxCodeId = l.taxCodeId ?? category.taxCodeId;
      let taxRate = new Prisma.Decimal(0);
      let taxAmount = new Prisma.Decimal(0);

      if (taxCodeId) {
        const rate = await this.taxRatesService.findEffectiveRate(
          organizationId,
          taxCodeId,
          txDate,
        );
        if (rate) {
          taxRate = rate.rate;
          taxAmount = subtotal.mul(taxRate);
        }
      }

      const totalAmount = subtotal.add(taxAmount);

      processed.push({
        categoryId: l.categoryId,
        description: l.description,
        expenseDate: new Date(l.expenseDate),
        quantity: qty,
        unitPrice,
        subtotal,
        taxCodeId,
        taxRate,
        taxAmount,
        totalAmount,
        glAccountId: l.glAccountId ?? category.glAccountId,
        receiptReference: l.receiptReference,
        receiptFilename: l.receiptFilename,
        receiptMimeType: l.receiptMimeType,
      });
    }

    return processed;
  }
}
