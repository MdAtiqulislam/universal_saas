import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../../ap/account-mapping/ap-account-mapping.service';
import { CreateCustomerRefundDto } from './dto/create-customer-refund.dto';
import { CustomerRefundQueryDto } from './dto/customer-refund-query.dto';
import {
  CreditNoteStatus,
  FiscalPeriodStatus,
  JournalEntryStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';

export type CustomerRefundWithDetails = Prisma.CustomerRefundGetPayload<{
  include: {
    customer: true;
    creditNote: true;
    paymentAccount: true;
    currency: true;
    journalEntry: true;
  };
}>;

@Injectable()
export class CustomerRefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly accountMappingService: ApAccountMappingService,
  ) {}

  /**
   * 1. Create a draft customer refund
   */
  async create(
    organizationId: string,
    dto: CreateCustomerRefundDto,
    actorUserId: string,
  ): Promise<CustomerRefundWithDetails> {
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

    // 2. Validate payment account
    const paymentAccount = await this.prisma.paymentAccount.findFirst({
      where: { id: dto.paymentAccountId, organizationId, deletedAt: null },
    });
    if (!paymentAccount) {
      throw new NotFoundException(
        `Payment account with ID ${dto.paymentAccountId} not found.`,
      );
    }
    if (!paymentAccount.isActive) {
      throw new BadRequestException(
        `Payment account '${paymentAccount.name}' is inactive.`,
      );
    }

    // 3. Resolve currency
    const currencyId = dto.currencyId ?? paymentAccount.currencyId;
    const currency = await this.prisma.currency.findFirst({
      where: { id: currencyId, isActive: true },
    });
    if (!currency) {
      throw new BadRequestException(
        `Currency ${currencyId} not found or inactive.`,
      );
    }

    const refundAmount = new Prisma.Decimal(dto.amount);
    if (refundAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Refund amount must be strictly positive.');
    }

    // 4. Validate credit note if provided
    if (dto.creditNoteId) {
      const creditNote = await this.prisma.customerCreditNote.findFirst({
        where: {
          id: dto.creditNoteId,
          organizationId,
          customerId: dto.customerId,
          deletedAt: null,
        },
      });
      if (!creditNote) {
        throw new NotFoundException(
          `Customer Credit Note ${dto.creditNoteId} not found for this customer.`,
        );
      }
      if (
        creditNote.status !== CreditNoteStatus.POSTED &&
        creditNote.status !== CreditNoteStatus.PARTIALLY_APPLIED
      ) {
        throw new BadRequestException(
          `Credit note must be POSTED or PARTIALLY_APPLIED to be refunded. Current status: ${creditNote.status}`,
        );
      }
      if (refundAmount.greaterThan(creditNote.remainingAmount)) {
        throw new BadRequestException(
          `Refund amount (${refundAmount.toFixed(4)}) exceeds credit note remaining amount (${creditNote.remainingAmount.toFixed(4)}).`,
        );
      }
    }

    // 5. Generate refund number
    let refundNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'CUSTOMER_REFUND',
        actorUserId,
      );
      refundNumber = seq.formatted;
    } catch {
      const count = await this.prisma.customerRefund.count({
        where: { organizationId },
      });
      refundNumber = `RF-${String(count + 1).padStart(6, '0')}`;
    }

    // 6. Create record
    const refund = await this.prisma.customerRefund.create({
      data: {
        organizationId,
        refundNumber,
        customerId: dto.customerId,
        creditNoteId: dto.creditNoteId ?? null,
        paymentAccountId: dto.paymentAccountId,
        currencyId,
        refundDate: new Date(dto.refundDate),
        amount: refundAmount,
        reason: dto.reason ?? null,
        reference: dto.reference ?? null,
        notes: dto.notes ?? null,
        status: RefundStatus.DRAFT,
        createdByUserId: actorUserId,
      },
      include: {
        customer: true,
        creditNote: true,
        paymentAccount: true,
        currency: true,
        journalEntry: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_REFUND_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_refund.create',
      resource: 'customer_refund',
      resourceId: refund.id,
      details: {
        refundNumber: refund.refundNumber,
        amount: refund.amount.toFixed(4),
      },
    });

    return refund;
  }

  /**
   * 2. Find all customer refunds
   */
  async findAll(organizationId: string, query: CustomerRefundQueryDto) {
    const where: Prisma.CustomerRefundWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.creditNoteId ? { creditNoteId: query.creditNoteId } : {}),
      ...(query.paymentAccountId
        ? { paymentAccountId: query.paymentAccountId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.startDate || query.endDate
        ? {
            refundDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { refundNumber: { contains: query.search, mode: 'insensitive' } },
              { reason: { contains: query.search, mode: 'insensitive' } },
              { reference: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.customerRefund.findMany({
        where,
        include: {
          customer: true,
          creditNote: true,
          paymentAccount: true,
          currency: true,
          journalEntry: true,
        },
        orderBy: [{ refundDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.customerRefund.count({ where }),
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
   * 3. Find one customer refund
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<CustomerRefundWithDetails> {
    const refund = await this.prisma.customerRefund.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        customer: true,
        creditNote: true,
        paymentAccount: true,
        currency: true,
        journalEntry: true,
      },
    });

    if (!refund) {
      throw new NotFoundException(`Customer Refund with ID ${id} not found.`);
    }

    return refund;
  }

  /**
   * 4. Post customer refund to GL (DRAFT -> POSTED)
   */
  async post(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<CustomerRefundWithDetails> {
    const refund = await this.findOne(organizationId, id);

    if (refund.status !== RefundStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT refunds can be posted. Current status: ${refund.status}`,
      );
    }

    // 1. Resolve open fiscal period
    const fiscalPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: {
        organizationId,
        status: FiscalPeriodStatus.OPEN,
        startDate: { lte: refund.refundDate },
        endDate: { gte: refund.refundDate },
      },
    });
    if (!fiscalPeriod) {
      throw new BadRequestException(
        `No OPEN fiscal period found covering refund date (${refund.refundDate.toISOString().slice(0, 10)}).`,
      );
    }

    // 2. Resolve account mappings
    const arAccountId = await this.accountMappingService.resolveAccount(
      organizationId,
      'ACCOUNTS_RECEIVABLE',
    );
    const bankAccountId = refund.paymentAccount.accountingAccountId;

    // 3. Generate journal number
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

    // 4. Balanced journal lines:
    // Debit: Accounts Receivable (reduces credit liability / AR credit balance)
    // Credit: Bank / Cash (reduces bank asset)
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
        description: `Customer Refund ${refund.refundNumber} - ${refund.customer.name}`,
        debit: refund.amount,
        credit: new Prisma.Decimal(0),
        lineNumber: 1,
      },
      {
        organizationId,
        accountId: bankAccountId,
        description: `Customer Refund ${refund.refundNumber} - ${refund.paymentAccount.name}`,
        debit: new Prisma.Decimal(0),
        credit: refund.amount,
        lineNumber: 2,
      },
    ];

    // 5. Execute in transaction
    const posted = await this.prisma.$transaction(async (tx) => {
      // 5.1 Create posted journal entry
      const glEntry = await tx.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber: journalNumber,
          entryDate: refund.refundDate,
          description: `Customer Refund: ${refund.refundNumber} (${refund.customer.name})`,
          status: JournalEntryStatus.POSTED,
          sourceType: 'CUSTOMER_REFUND',
          sourceId: refund.id,
          createdByUserId: actorUserId,
          postedByUserId: actorUserId,
          postedAt: new Date(),
          lines: { create: journalLinesData },
        },
      });

      // 5.2 If linked to credit note, update credit note applied/remaining
      if (refund.creditNoteId) {
        const cn = await tx.customerCreditNote.findFirst({
          where: { id: refund.creditNoteId, organizationId },
        });
        if (cn) {
          const newApplied = cn.appliedAmount.add(refund.amount);
          const newRemaining = cn.remainingAmount.sub(refund.amount);
          const newStatus = newRemaining.isZero()
            ? CreditNoteStatus.APPLIED
            : CreditNoteStatus.PARTIALLY_APPLIED;

          await tx.customerCreditNote.update({
            where: { id: cn.id },
            data: {
              appliedAmount: newApplied,
              remainingAmount: newRemaining,
              status: newStatus,
            },
          });
        }
      }

      // 5.3 Update refund status
      return tx.customerRefund.update({
        where: { id },
        data: {
          status: RefundStatus.POSTED,
          postedByUserId: actorUserId,
          postedAt: new Date(),
          journalEntryId: glEntry.id,
        },
        include: {
          customer: true,
          creditNote: true,
          paymentAccount: true,
          currency: true,
          journalEntry: true,
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_REFUND_POSTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_refund.post',
      resource: 'customer_refund',
      resourceId: posted.id,
      details: {
        refundNumber: posted.refundNumber,
        amount: posted.amount.toFixed(4),
        journalEntryId: posted.journalEntryId,
      },
    });

    return posted;
  }

  /**
   * 5. Void customer refund
   */
  async void(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<CustomerRefundWithDetails> {
    const refund = await this.findOne(organizationId, id);

    if (refund.status === RefundStatus.VOIDED) {
      throw new BadRequestException('Refund is already voided.');
    }

    let reversalJournalId: string | null = null;
    if (refund.status === RefundStatus.POSTED) {
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
      const bankAccountId = refund.paymentAccount.accountingAccountId;

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
      // Debit: Bank / Cash
      // Credit: Accounts Receivable
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
          accountId: bankAccountId,
          description: `Reversal of Customer Refund ${refund.refundNumber}`,
          debit: refund.amount,
          credit: new Prisma.Decimal(0),
          lineNumber: 1,
        },
        {
          organizationId,
          accountId: arAccountId,
          description: `Reversal of Customer Refund ${refund.refundNumber}`,
          debit: new Prisma.Decimal(0),
          credit: refund.amount,
          lineNumber: 2,
        },
      ];

      const reversalGl = await this.prisma.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber: journalNumber,
          entryDate: new Date(),
          description: `Void Reversal: Customer Refund ${refund.refundNumber}`,
          status: JournalEntryStatus.POSTED,
          sourceType: 'REVERSAL',
          sourceId: refund.id,
          createdByUserId: actorUserId,
          postedByUserId: actorUserId,
          postedAt: new Date(),
          lines: { create: reversalLinesData },
        },
      });
      reversalJournalId = reversalGl.id;
    }

    const voided = await this.prisma.$transaction(async (tx) => {
      if (refund.creditNoteId && refund.status === RefundStatus.POSTED) {
        const cn = await tx.customerCreditNote.findFirst({
          where: { id: refund.creditNoteId, organizationId },
        });
        if (cn) {
          const newApplied = cn.appliedAmount.sub(refund.amount);
          const newRemaining = cn.remainingAmount.add(refund.amount);
          const newStatus = newApplied.isZero()
            ? CreditNoteStatus.POSTED
            : CreditNoteStatus.PARTIALLY_APPLIED;

          await tx.customerCreditNote.update({
            where: { id: cn.id },
            data: {
              appliedAmount: newApplied,
              remainingAmount: newRemaining,
              status: newStatus,
            },
          });
        }
      }

      return tx.customerRefund.update({
        where: { id },
        data: {
          status: RefundStatus.VOIDED,
          voidedAt: new Date(),
        },
        include: {
          customer: true,
          creditNote: true,
          paymentAccount: true,
          currency: true,
          journalEntry: true,
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_REFUND_VOIDED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_refund.void',
      resource: 'customer_refund',
      resourceId: voided.id,
      details: {
        refundNumber: voided.refundNumber,
        reversalJournalId,
      },
    });

    return voided;
  }
}
