import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { CreateBankStatementDto } from './dto/create-bank-statement.dto';
import { ImportStatementTransactionsDto } from './dto/import-statement-transactions.dto';
import { BankStatementQueryDto } from './dto/bank-statement-query.dto';
import {
  BankStatement,
  BankStatementTransaction,
  BankStatementStatus,
  BankTransactionStatus,
  Prisma,
} from '@prisma/client';

export type BankStatementWithDetails = Prisma.BankStatementGetPayload<{
  include: {
    paymentAccount: {
      select: {
        id: true;
        code: true;
        name: true;
        type: true;
        accountingAccountId: true;
      };
    };
    currency: {
      select: { id: true; code: true; name: true; symbol: true };
    };
    _count: {
      select: { transactions: true; reconciliations: true };
    };
  };
}>;

@Injectable()
export class BankStatementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * Create a new bank statement header (DRAFT).
   */
  async create(
    organizationId: string,
    dto: CreateBankStatementDto,
    actorUserId: string,
  ): Promise<BankStatementWithDetails> {
    // 1. Verify payment account exists in organization
    const paymentAccount = await this.prisma.paymentAccount.findFirst({
      where: { id: dto.paymentAccountId, organizationId, deletedAt: null },
    });
    if (!paymentAccount) {
      throw new NotFoundException(
        `Payment account with ID ${dto.paymentAccountId} not found in this organization.`,
      );
    }
    if (!paymentAccount.isActive) {
      throw new BadRequestException(
        `Payment account '${paymentAccount.code} - ${paymentAccount.name}' is inactive.`,
      );
    }

    // 2. Resolve currency
    const currencyId = dto.currencyId ?? paymentAccount.currencyId;
    const currency = await this.prisma.currency.findFirst({
      where: { id: currencyId, isActive: true },
    });
    if (!currency) {
      throw new NotFoundException(
        `Currency with ID ${currencyId} not found or inactive.`,
      );
    }

    // 3. Generate statement number
    let statementNumber: string;
    try {
      const generated = await this.numberingService.nextNumber(
        organizationId,
        'BANK_STATEMENT',
        actorUserId,
      );
      statementNumber = generated.formatted;
    } catch {
      const count = await this.prisma.bankStatement.count({
        where: { organizationId },
      });
      statementNumber = `BS-${String(count + 1).padStart(6, '0')}`;
    }

    const openingBalance = new Prisma.Decimal(dto.openingBalance);
    const closingBalance = new Prisma.Decimal(dto.closingBalance);

    const statement = await this.prisma.bankStatement.create({
      data: {
        organizationId,
        paymentAccountId: dto.paymentAccountId,
        statementNumber,
        statementDate: new Date(dto.statementDate),
        openingBalance,
        closingBalance,
        currencyId,
        status: BankStatementStatus.DRAFT,
        source: dto.source?.trim() ?? 'MANUAL',
        createdByUserId: actorUserId,
      },
      include: {
        paymentAccount: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            accountingAccountId: true,
          },
        },
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
        _count: {
          select: { transactions: true, reconciliations: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'BANK_STATEMENT_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'bank_statement.create',
      resource: 'bank_statement',
      resourceId: statement.id,
      details: {
        statementNumber: statement.statementNumber,
        paymentAccountId: statement.paymentAccountId,
      },
    });

    return statement;
  }

  /**
   * Import batch transactions into a bank statement.
   */
  async importTransactions(
    organizationId: string,
    statementId: string,
    dto: ImportStatementTransactionsDto,
    actorUserId: string,
  ): Promise<{ importedCount: number; statement: BankStatementWithDetails }> {
    const statement = await this.findOne(organizationId, statementId);

    if (
      statement.status === BankStatementStatus.RECONCILED ||
      statement.status === BankStatementStatus.LOCKED
    ) {
      throw new BadRequestException(
        `Cannot import transactions into a statement with status '${statement.status}'.`,
      );
    }

    // 1. Validate transactions (debit/credit XOR and amounts)
    const externalIds = new Set<string>();
    const preparedData: Array<{
      organizationId: string;
      bankStatementId: string;
      transactionDate: Date;
      valueDate: Date | null;
      description: string;
      reference: string | null;
      externalTransactionId: string | null;
      debitAmount: Prisma.Decimal;
      creditAmount: Prisma.Decimal;
      amount: Prisma.Decimal;
      runningBalance: Prisma.Decimal | null;
      status: BankTransactionStatus;
      metadata: Prisma.InputJsonValue | undefined;
    }> = [];

    for (const item of dto.transactions) {
      const debit = new Prisma.Decimal(item.debitAmount ?? 0);
      const credit = new Prisma.Decimal(item.creditAmount ?? 0);

      // Debit/credit XOR check
      if (
        (debit.isZero() && credit.isZero()) ||
        (!debit.isZero() && !credit.isZero())
      ) {
        throw new BadRequestException(
          `Each transaction must specify either debitAmount > 0 OR creditAmount > 0, but not both. (Description: "${item.description}")`,
        );
      }

      if (debit.isNegative() || credit.isNegative()) {
        throw new BadRequestException(
          'Debit and credit amounts cannot be negative.',
        );
      }

      const calculatedAmount = debit.greaterThan(0) ? debit : credit;
      const amount = item.amount
        ? new Prisma.Decimal(item.amount)
        : calculatedAmount;

      if (!amount.equals(calculatedAmount)) {
        throw new BadRequestException(
          `Specified amount (${amount.toString()}) does not match non-zero debit/credit (${calculatedAmount.toString()}).`,
        );
      }

      if (item.externalTransactionId) {
        if (externalIds.has(item.externalTransactionId)) {
          throw new BadRequestException(
            `Duplicate external transaction ID '${item.externalTransactionId}' in batch.`,
          );
        }
        externalIds.add(item.externalTransactionId);
      }

      preparedData.push({
        organizationId,
        bankStatementId: statement.id,
        transactionDate: new Date(item.transactionDate),
        valueDate: item.valueDate ? new Date(item.valueDate) : null,
        description: item.description,
        reference: item.reference ?? null,
        externalTransactionId: item.externalTransactionId ?? null,
        debitAmount: debit,
        creditAmount: credit,
        amount,
        runningBalance: item.runningBalance
          ? new Prisma.Decimal(item.runningBalance)
          : null,
        status: BankTransactionStatus.UNMATCHED,
        metadata: item.metadata as Prisma.InputJsonValue | undefined,
      });
    }

    // 2. Check existing duplicate externalTransactionIds in DB for this statement
    if (externalIds.size > 0) {
      const existingTxns = await this.prisma.bankStatementTransaction.findMany({
        where: {
          organizationId,
          bankStatementId: statement.id,
          externalTransactionId: { in: Array.from(externalIds) },
        },
        select: { externalTransactionId: true },
      });
      if (existingTxns.length > 0) {
        throw new BadRequestException(
          `External transaction ID '${existingTxns[0].externalTransactionId}' already imported in this statement.`,
        );
      }
    }

    // 3. Save transactions and transition statement status to IMPORTED
    await this.prisma.$transaction(async (tx) => {
      await tx.bankStatementTransaction.createMany({
        data: preparedData,
      });

      if (statement.status === BankStatementStatus.DRAFT) {
        await tx.bankStatement.update({
          where: { id: statement.id },
          data: { status: BankStatementStatus.IMPORTED },
        });
      }
    });

    await this.eventBus.publish({
      eventName: 'BANK_STATEMENT_IMPORTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'bank_statement.import',
      resource: 'bank_statement',
      resourceId: statement.id,
      details: {
        statementNumber: statement.statementNumber,
        importedCount: preparedData.length,
      },
    });

    const updated = await this.findOne(organizationId, statementId);
    return {
      importedCount: preparedData.length,
      statement: updated,
    };
  }

  /**
   * List bank statements with filters and pagination.
   */
  async findAll(
    organizationId: string,
    query: BankStatementQueryDto,
  ): Promise<{
    statements: BankStatement[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BankStatementWhereInput = { organizationId };

    if (query.status) where.status = query.status;
    if (query.paymentAccountId) where.paymentAccountId = query.paymentAccountId;

    if (query.fromDate || query.toDate) {
      where.statementDate = {};
      if (query.fromDate) where.statementDate.gte = new Date(query.fromDate);
      if (query.toDate) where.statementDate.lte = new Date(query.toDate);
    }

    if (query.search) {
      where.statementNumber = { contains: query.search, mode: 'insensitive' };
    }

    const [total, statements] = await Promise.all([
      this.prisma.bankStatement.count({ where }),
      this.prisma.bankStatement.findMany({
        where,
        include: {
          paymentAccount: {
            select: { id: true, code: true, name: true, type: true },
          },
          currency: {
            select: { id: true, code: true, name: true, symbol: true },
          },
          _count: {
            select: { transactions: true, reconciliations: true },
          },
        },
        orderBy: [{ statementDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      statements,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find single bank statement by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<BankStatementWithDetails> {
    const statement = await this.prisma.bankStatement.findFirst({
      where: { id, organizationId },
      include: {
        paymentAccount: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            accountingAccountId: true,
          },
        },
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
        _count: {
          select: { transactions: true, reconciliations: true },
        },
      },
    });

    if (!statement) {
      throw new NotFoundException(
        `Bank statement with ID ${id} not found in this organization.`,
      );
    }

    return statement;
  }

  /**
   * Get all transactions for a specific statement.
   */
  async getTransactions(
    organizationId: string,
    statementId: string,
  ): Promise<BankStatementTransaction[]> {
    await this.findOne(organizationId, statementId);

    return this.prisma.bankStatementTransaction.findMany({
      where: { organizationId, bankStatementId: statementId },
      include: {
        matchedPayment: {
          select: {
            id: true,
            paymentNumber: true,
            type: true,
            amount: true,
            status: true,
          },
        },
        matchedJournalEntry: {
          select: {
            id: true,
            entryNumber: true,
            entryDate: true,
            description: true,
          },
        },
      },
      orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
    });
  }
}
