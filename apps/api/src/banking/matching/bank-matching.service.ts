import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { PostBankAdjustmentDto } from './dto/post-bank-adjustment.dto';
import {
  BankStatementTransaction,
  BankTransactionStatus,
  BankStatementStatus,
  PaymentStatus,
  PaymentType,
  JournalEntryStatus,
  FiscalPeriodStatus,
  Prisma,
} from '@prisma/client';

export type MatchedTransactionWithDetails =
  Prisma.BankStatementTransactionGetPayload<{
    include: {
      bankStatement: {
        include: {
          paymentAccount: true;
          currency: true;
        };
      };
      matchedPayment: true;
      matchedJournalEntry: true;
    };
  }>;

@Injectable()
export class BankMatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * Get suggestions for matching a statement transaction against existing Payments.
   */
  async getSuggestions(
    organizationId: string,
    transactionId: string,
  ): Promise<{
    transaction: BankStatementTransaction;
    suggestions: Array<{
      payment: any;
      matchConfidence: 'EXACT_MATCH' | 'POSSIBLE_MATCH';
      reason: string;
    }>;
  }> {
    const txn = await this.prisma.bankStatementTransaction.findFirst({
      where: { id: transactionId, organizationId },
      include: {
        bankStatement: {
          include: { paymentAccount: true, currency: true },
        },
      },
    });

    if (!txn) {
      throw new NotFoundException(
        `Bank statement transaction with ID ${transactionId} not found in this organization.`,
      );
    }

    // Determine expected payment type:
    // Debit on bank statement = money paid out (PaymentType.PAYMENT)
    // Credit on bank statement = money received (PaymentType.RECEIPT)
    const expectedPaymentType = txn.debitAmount.greaterThan(0)
      ? PaymentType.PAYMENT
      : PaymentType.RECEIPT;

    // Find candidate payments in organization that are not already matched
    const matchedPaymentIds = (
      await this.prisma.bankStatementTransaction.findMany({
        where: {
          organizationId,
          matchedPaymentId: { not: null },
        },
        select: { matchedPaymentId: true },
      })
    )
      .map((t) => t.matchedPaymentId)
      .filter((id): id is string => Boolean(id));

    const candidatePayments = await this.prisma.payment.findMany({
      where: {
        organizationId,
        paymentAccountId: txn.bankStatement.paymentAccountId,
        type: expectedPaymentType,
        status: {
          in: [
            PaymentStatus.POSTED,
            PaymentStatus.PARTIALLY_ALLOCATED,
            PaymentStatus.ALLOCATED,
          ],
        },
        amount: txn.amount,
        id: { notIn: matchedPaymentIds },
      },
      include: {
        customer: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        currency: { select: { id: true, code: true, symbol: true } },
      },
      orderBy: [{ paymentDate: 'desc' }],
    });

    const suggestions = candidatePayments.map((p) => {
      let isExact = false;
      let reason = `Amount matches exactly (${p.amount.toString()} ${txn.bankStatement.currency.code})`;

      // Reference match
      if (
        (txn.reference &&
          p.reference &&
          txn.reference.toLowerCase() === p.reference.toLowerCase()) ||
        (txn.reference &&
          p.paymentNumber &&
          txn.reference.includes(p.paymentNumber)) ||
        (txn.description &&
          p.paymentNumber &&
          txn.description.includes(p.paymentNumber))
      ) {
        isExact = true;
        reason += '; Reference / Payment number matches';
      }

      // Date proximity check (same date)
      if (
        p.paymentDate.toISOString().slice(0, 10) ===
        txn.transactionDate.toISOString().slice(0, 10)
      ) {
        if (!isExact) reason += '; Exact transaction date match';
        isExact = true;
      }

      return {
        payment: p,
        matchConfidence: isExact
          ? ('EXACT_MATCH' as const)
          : ('POSSIBLE_MATCH' as const),
        reason,
      };
    });

    return {
      transaction: txn,
      suggestions,
    };
  }

  /**
   * Match a statement transaction against an existing Payment.
   */
  async matchPayment(
    organizationId: string,
    transactionId: string,
    paymentId: string,
    actorUserId: string,
  ): Promise<MatchedTransactionWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const txn = await tx.bankStatementTransaction.findFirst({
        where: { id: transactionId, organizationId },
        include: { bankStatement: true },
      });

      if (!txn) {
        throw new NotFoundException(
          `Statement transaction with ID ${transactionId} not found in this organization.`,
        );
      }

      if (
        txn.status === BankTransactionStatus.MATCHED ||
        txn.status === BankTransactionStatus.ADJUSTED
      ) {
        throw new BadRequestException(
          `Transaction is already in status '${txn.status}'. Unmatch first before re-matching.`,
        );
      }

      if (
        txn.bankStatement.status === BankStatementStatus.RECONCILED ||
        txn.bankStatement.status === BankStatementStatus.LOCKED
      ) {
        throw new BadRequestException(
          `Cannot match transactions in a statement with status '${txn.bankStatement.status}'.`,
        );
      }

      const payment = await tx.payment.findFirst({
        where: { id: paymentId, organizationId },
      });

      if (!payment) {
        throw new NotFoundException(
          `Payment with ID ${paymentId} not found in this organization.`,
        );
      }

      if (
        payment.status !== PaymentStatus.POSTED &&
        payment.status !== PaymentStatus.PARTIALLY_ALLOCATED &&
        payment.status !== PaymentStatus.ALLOCATED
      ) {
        throw new BadRequestException(
          `Payment must be POSTED or ALLOCATED to be matched. Current status: ${payment.status}`,
        );
      }

      if (payment.paymentAccountId !== txn.bankStatement.paymentAccountId) {
        throw new BadRequestException(
          'Payment does not belong to the same payment account as the bank statement.',
        );
      }

      if (!payment.amount.equals(txn.amount)) {
        throw new BadRequestException(
          `Payment amount (${payment.amount.toString()}) does not match statement transaction amount (${txn.amount.toString()}).`,
        );
      }

      // Check if payment is already matched to another transaction
      const existingMatch = await tx.bankStatementTransaction.findFirst({
        where: {
          organizationId,
          matchedPaymentId: payment.id,
          id: { not: txn.id },
        },
      });

      if (existingMatch) {
        throw new BadRequestException(
          `Payment '${payment.paymentNumber}' is already matched to another statement transaction (${existingMatch.id}).`,
        );
      }

      const updated = await tx.bankStatementTransaction.update({
        where: { id: txn.id },
        data: {
          matchedPaymentId: payment.id,
          matchedJournalEntryId: null,
          status: BankTransactionStatus.MATCHED,
          reconciliationDate: new Date(),
          reconciledByUserId: actorUserId,
        },
        include: {
          bankStatement: {
            include: { paymentAccount: true, currency: true },
          },
          matchedPayment: true,
          matchedJournalEntry: true,
        },
      });

      await this.eventBus.publish({
        eventName: 'BANK_TRANSACTION_MATCHED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'bank_transaction.match_payment',
        resource: 'bank_statement_transaction',
        resourceId: txn.id,
        details: {
          paymentId: payment.id,
          paymentNumber: payment.paymentNumber,
          amount: payment.amount.toString(),
        },
      });

      return updated;
    });
  }

  /**
   * Match a statement transaction against an existing General Ledger Journal Entry.
   */
  async matchJournal(
    organizationId: string,
    transactionId: string,
    journalEntryId: string,
    actorUserId: string,
  ): Promise<MatchedTransactionWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const txn = await tx.bankStatementTransaction.findFirst({
        where: { id: transactionId, organizationId },
        include: { bankStatement: true },
      });

      if (!txn) {
        throw new NotFoundException(
          `Statement transaction with ID ${transactionId} not found in this organization.`,
        );
      }

      if (
        txn.status === BankTransactionStatus.MATCHED ||
        txn.status === BankTransactionStatus.ADJUSTED
      ) {
        throw new BadRequestException(
          `Transaction is already in status '${txn.status}'.`,
        );
      }

      if (
        txn.bankStatement.status === BankStatementStatus.RECONCILED ||
        txn.bankStatement.status === BankStatementStatus.LOCKED
      ) {
        throw new BadRequestException(
          `Cannot match transactions in a statement with status '${txn.bankStatement.status}'.`,
        );
      }

      const journal = await tx.journalEntry.findFirst({
        where: { id: journalEntryId, organizationId },
      });

      if (!journal) {
        throw new NotFoundException(
          `Journal entry with ID ${journalEntryId} not found in this organization.`,
        );
      }

      if (journal.status !== JournalEntryStatus.POSTED) {
        throw new BadRequestException(
          `Journal entry must be POSTED to be matched. Current status: ${journal.status}`,
        );
      }

      const updated = await tx.bankStatementTransaction.update({
        where: { id: txn.id },
        data: {
          matchedJournalEntryId: journal.id,
          matchedPaymentId: null,
          status: BankTransactionStatus.MATCHED,
          reconciliationDate: new Date(),
          reconciledByUserId: actorUserId,
        },
        include: {
          bankStatement: {
            include: { paymentAccount: true, currency: true },
          },
          matchedPayment: true,
          matchedJournalEntry: true,
        },
      });

      await this.eventBus.publish({
        eventName: 'BANK_TRANSACTION_MATCHED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'bank_transaction.match_journal',
        resource: 'bank_statement_transaction',
        resourceId: txn.id,
        details: {
          journalEntryId: journal.id,
          entryNumber: journal.entryNumber,
        },
      });

      return updated;
    });
  }

  /**
   * Unmatch a previously matched statement transaction.
   */
  async unmatch(
    organizationId: string,
    transactionId: string,
    actorUserId: string,
  ): Promise<MatchedTransactionWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const txn = await tx.bankStatementTransaction.findFirst({
        where: { id: transactionId, organizationId },
        include: { bankStatement: true },
      });

      if (!txn) {
        throw new NotFoundException(
          `Statement transaction with ID ${transactionId} not found in this organization.`,
        );
      }

      if (
        txn.status !== BankTransactionStatus.MATCHED &&
        txn.status !== BankTransactionStatus.ADJUSTED
      ) {
        throw new BadRequestException(
          `Only MATCHED or ADJUSTED transactions can be unmatched. Current status: ${txn.status}`,
        );
      }

      if (
        txn.bankStatement.status === BankStatementStatus.RECONCILED ||
        txn.bankStatement.status === BankStatementStatus.LOCKED
      ) {
        throw new BadRequestException(
          `Cannot unmatch transactions in a statement with status '${txn.bankStatement.status}'.`,
        );
      }

      const updated = await tx.bankStatementTransaction.update({
        where: { id: txn.id },
        data: {
          matchedPaymentId: null,
          matchedJournalEntryId: null,
          status: BankTransactionStatus.UNMATCHED,
          reconciliationDate: null,
          reconciledByUserId: null,
        },
        include: {
          bankStatement: {
            include: { paymentAccount: true, currency: true },
          },
          matchedPayment: true,
          matchedJournalEntry: true,
        },
      });

      await this.eventBus.publish({
        eventName: 'BANK_TRANSACTION_UNMATCHED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'bank_transaction.unmatch',
        resource: 'bank_statement_transaction',
        resourceId: txn.id,
      });

      return updated;
    });
  }

  /**
   * Post a bank adjustment (bank charge, interest, or bank fee) to General Ledger and link to transaction.
   */
  async postAdjustment(
    organizationId: string,
    transactionId: string,
    dto: PostBankAdjustmentDto,
    actorUserId: string,
  ): Promise<MatchedTransactionWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const txn = await tx.bankStatementTransaction.findFirst({
        where: { id: transactionId, organizationId },
        include: {
          bankStatement: {
            include: { paymentAccount: true },
          },
        },
      });

      if (!txn) {
        throw new NotFoundException(
          `Statement transaction with ID ${transactionId} not found in this organization.`,
        );
      }

      if (
        txn.status === BankTransactionStatus.MATCHED ||
        txn.status === BankTransactionStatus.ADJUSTED
      ) {
        throw new BadRequestException(
          `Transaction is already matched or adjusted. Current status: ${txn.status}`,
        );
      }

      if (
        txn.bankStatement.status === BankStatementStatus.RECONCILED ||
        txn.bankStatement.status === BankStatementStatus.LOCKED
      ) {
        throw new BadRequestException(
          `Cannot adjust transactions in a statement with status '${txn.bankStatement.status}'.`,
        );
      }

      // 1. Verify GL account exists in tenant
      const targetAccount = await tx.account.findFirst({
        where: {
          id: dto.expenseOrIncomeAccountId,
          organizationId,
          deletedAt: null,
        },
      });
      if (!targetAccount) {
        throw new NotFoundException(
          `General Ledger Account with ID ${dto.expenseOrIncomeAccountId} not found in this organization.`,
        );
      }
      if (!targetAccount.isActive) {
        throw new BadRequestException(
          `General Ledger Account '${targetAccount.code} - ${targetAccount.name}' is inactive.`,
        );
      }

      // 2. Resolve open fiscal period covering transaction date
      const fiscalPeriod = await tx.fiscalPeriod.findFirst({
        where: {
          organizationId,
          status: FiscalPeriodStatus.OPEN,
          startDate: { lte: txn.transactionDate },
          endDate: { gte: txn.transactionDate },
        },
      });

      if (!fiscalPeriod) {
        throw new BadRequestException(
          `No OPEN fiscal period found covering transaction date (${txn.transactionDate.toISOString().slice(0, 10)}).`,
        );
      }

      // 3. Prepare balanced journal entry lines
      const bankGlAccountId =
        txn.bankStatement.paymentAccount.accountingAccountId;

      let journalLinesData: Array<{
        organizationId: string;
        accountId: string;
        description: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
        lineNumber: number;
      }>;

      const desc =
        dto.description?.trim() ||
        `${dto.adjustmentType}: ${txn.description} (${txn.bankStatement.statementNumber})`;

      if (txn.debitAmount.greaterThan(0)) {
        // Money out of bank (e.g. Bank Fee Expense)
        // Debit: Expense / Target Account, Credit: Bank Account
        journalLinesData = [
          {
            organizationId,
            accountId: targetAccount.id,
            description: desc,
            debit: txn.amount,
            credit: new Prisma.Decimal(0),
            lineNumber: 1,
          },
          {
            organizationId,
            accountId: bankGlAccountId,
            description: desc,
            debit: new Prisma.Decimal(0),
            credit: txn.amount,
            lineNumber: 2,
          },
        ];
      } else {
        // Money into bank (e.g. Bank Interest Income)
        // Debit: Bank Account, Credit: Income / Target Account
        journalLinesData = [
          {
            organizationId,
            accountId: bankGlAccountId,
            description: desc,
            debit: txn.amount,
            credit: new Prisma.Decimal(0),
            lineNumber: 1,
          },
          {
            organizationId,
            accountId: targetAccount.id,
            description: desc,
            debit: new Prisma.Decimal(0),
            credit: txn.amount,
            lineNumber: 2,
          },
        ];
      }

      // 4. Generate journal number
      let journalNumber: string;
      try {
        const generated = await this.numberingService.nextNumber(
          organizationId,
          'JOURNAL_ENTRY',
          actorUserId,
        );
        journalNumber = generated.formatted;
      } catch {
        const count = await tx.journalEntry.count({
          where: { organizationId },
        });
        journalNumber = `JE-${String(count + 1).padStart(6, '0')}`;
      }

      // 5. Create GL entry
      const glEntry = await tx.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber: journalNumber,
          entryDate: txn.transactionDate,
          description: desc,
          status: JournalEntryStatus.POSTED,
          sourceType: 'BANK_ADJUSTMENT',
          sourceId: txn.id,
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

      // 6. Link to statement transaction and mark ADJUSTED
      const updated = await tx.bankStatementTransaction.update({
        where: { id: txn.id },
        data: {
          matchedJournalEntryId: glEntry.id,
          matchedPaymentId: null,
          status: BankTransactionStatus.ADJUSTED,
          reconciliationDate: new Date(),
          reconciledByUserId: actorUserId,
        },
        include: {
          bankStatement: {
            include: { paymentAccount: true, currency: true },
          },
          matchedPayment: true,
          matchedJournalEntry: true,
        },
      });

      await this.eventBus.publish({
        eventName: 'BANK_ADJUSTMENT_POSTED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'bank_transaction.post_adjustment',
        resource: 'bank_statement_transaction',
        resourceId: txn.id,
        details: {
          journalEntryId: glEntry.id,
          journalNumber: glEntry.entryNumber,
          adjustmentType: dto.adjustmentType,
          amount: txn.amount.toString(),
        },
      });

      return updated;
    });
  }
}
