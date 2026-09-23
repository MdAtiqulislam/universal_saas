import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { CreateBankReconciliationDto } from './dto/create-bank-reconciliation.dto';
import {
  BankReconciliationStatus,
  BankStatementStatus,
  BankTransactionStatus,
  PaymentStatus,
  PaymentType,
  Prisma,
} from '@prisma/client';

export type BankReconciliationWithDetails =
  Prisma.BankReconciliationGetPayload<{
    include: {
      paymentAccount: {
        select: { id: true; code: true; name: true; type: true };
      };
      statement: {
        include: {
          currency: true;
          _count: { select: { transactions: true } };
        };
      };
    };
  }>;

@Injectable()
export class BankReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * Create a new bank reconciliation session.
   */
  async create(
    organizationId: string,
    dto: CreateBankReconciliationDto,
    actorUserId: string,
  ): Promise<BankReconciliationWithDetails> {
    // 1. Verify statement exists in organization
    const statement = await this.prisma.bankStatement.findFirst({
      where: { id: dto.statementId, organizationId },
      include: { paymentAccount: true, transactions: true },
    });

    if (!statement) {
      throw new NotFoundException(
        `Bank statement with ID ${dto.statementId} not found in this organization.`,
      );
    }

    if (
      statement.status === BankStatementStatus.RECONCILED ||
      statement.status === BankStatementStatus.LOCKED
    ) {
      throw new BadRequestException(
        `Statement is already in status '${statement.status}'.`,
      );
    }

    // 2. Check if active reconciliation already exists for this statement
    const existingRec = await this.prisma.bankReconciliation.findFirst({
      where: {
        organizationId,
        statementId: dto.statementId,
        status: {
          in: [
            BankReconciliationStatus.OPEN,
            BankReconciliationStatus.COMPLETED,
          ],
        },
      },
    });

    if (existingRec) {
      throw new BadRequestException(
        `A reconciliation session already exists for this statement (${existingRec.reconciliationNumber}).`,
      );
    }

    // 3. Compute Book Balance:
    // Net payments in this payment account: (Receipts - Payments)
    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId,
        paymentAccountId: statement.paymentAccountId,
        status: {
          in: [
            PaymentStatus.POSTED,
            PaymentStatus.PARTIALLY_ALLOCATED,
            PaymentStatus.ALLOCATED,
          ],
        },
        paymentDate: {
          gte: new Date(dto.periodStart),
          lte: new Date(dto.periodEnd),
        },
      },
    });

    let bookBalance = new Prisma.Decimal(statement.openingBalance);
    for (const p of payments) {
      if (p.type === PaymentType.RECEIPT) {
        bookBalance = bookBalance.add(p.amount);
      } else {
        bookBalance = bookBalance.sub(p.amount);
      }
    }

    const statementBalance = new Prisma.Decimal(statement.closingBalance);

    // Compute Reconciled Balance from statement transactions marked MATCHED or ADJUSTED
    let reconciledBalance = new Prisma.Decimal(statement.openingBalance);
    for (const t of statement.transactions) {
      if (
        t.status === BankTransactionStatus.MATCHED ||
        t.status === BankTransactionStatus.ADJUSTED
      ) {
        if (t.creditAmount.greaterThan(0)) {
          reconciledBalance = reconciledBalance.add(t.amount);
        } else {
          reconciledBalance = reconciledBalance.sub(t.amount);
        }
      }
    }

    const difference = statementBalance.sub(bookBalance);

    // 4. Generate reconciliation number
    let reconciliationNumber: string;
    try {
      const generated = await this.numberingService.nextNumber(
        organizationId,
        'BANK_RECONCILIATION',
        actorUserId,
      );
      reconciliationNumber = generated.formatted;
    } catch {
      const count = await this.prisma.bankReconciliation.count({
        where: { organizationId },
      });
      reconciliationNumber = `REC-${String(count + 1).padStart(6, '0')}`;
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.bankReconciliation.create({
        data: {
          organizationId,
          reconciliationNumber,
          paymentAccountId: statement.paymentAccountId,
          statementId: statement.id,
          periodStart: new Date(dto.periodStart),
          periodEnd: new Date(dto.periodEnd),
          bookBalance,
          statementBalance,
          reconciledBalance,
          difference,
          status: BankReconciliationStatus.OPEN,
          startedByUserId: actorUserId,
        },
        include: {
          paymentAccount: {
            select: { id: true, code: true, name: true, type: true },
          },
          statement: {
            include: {
              currency: true,
              _count: { select: { transactions: true } },
            },
          },
        },
      });

      await tx.bankStatement.update({
        where: { id: statement.id },
        data: { status: BankStatementStatus.RECONCILING },
      });

      return rec;
    });

    await this.eventBus.publish({
      eventName: 'BANK_RECONCILIATION_STARTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'bank_reconciliation.create',
      resource: 'bank_reconciliation',
      resourceId: created.id,
      details: {
        reconciliationNumber: created.reconciliationNumber,
        statementId: statement.id,
      },
    });

    return created;
  }

  /**
   * Complete bank reconciliation and lock statement.
   */
  async complete(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<BankReconciliationWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const rec = await tx.bankReconciliation.findFirst({
        where: { id, organizationId },
        include: {
          statement: {
            include: {
              transactions: true,
              currency: true,
              _count: { select: { transactions: true } },
            },
          },
          paymentAccount: {
            select: { id: true, code: true, name: true, type: true },
          },
        },
      });

      if (!rec) {
        throw new NotFoundException(
          `Bank reconciliation with ID ${id} not found in this organization.`,
        );
      }

      if (rec.status !== BankReconciliationStatus.OPEN) {
        throw new BadRequestException(
          `Only OPEN reconciliations can be completed. Current status: ${rec.status}`,
        );
      }

      // Check for any remaining unmatched transactions
      const unmatchedCount = rec.statement.transactions.filter(
        (t) =>
          t.status === BankTransactionStatus.UNMATCHED ||
          t.status === BankTransactionStatus.POSSIBLE_MATCH,
      ).length;

      if (unmatchedCount > 0) {
        throw new BadRequestException(
          `Cannot complete reconciliation: statement still has ${unmatchedCount} unmatched transaction(s).`,
        );
      }

      // Calculate final reconciled balance
      let finalReconciled = new Prisma.Decimal(rec.statement.openingBalance);
      for (const t of rec.statement.transactions) {
        if (
          t.status === BankTransactionStatus.MATCHED ||
          t.status === BankTransactionStatus.ADJUSTED
        ) {
          if (t.creditAmount.greaterThan(0)) {
            finalReconciled = finalReconciled.add(t.amount);
          } else {
            finalReconciled = finalReconciled.sub(t.amount);
          }
        }
      }

      if (!finalReconciled.equals(rec.statement.closingBalance)) {
        throw new BadRequestException(
          `Reconciled balance (${finalReconciled.toString()}) does not match statement closing balance (${rec.statement.closingBalance.toString()}).`,
        );
      }

      const updated = await tx.bankReconciliation.update({
        where: { id: rec.id },
        data: {
          reconciledBalance: finalReconciled,
          difference: new Prisma.Decimal(0),
          status: BankReconciliationStatus.COMPLETED,
          completedByUserId: actorUserId,
          completedAt: new Date(),
        },
        include: {
          paymentAccount: {
            select: { id: true, code: true, name: true, type: true },
          },
          statement: {
            include: {
              currency: true,
              _count: { select: { transactions: true } },
            },
          },
        },
      });

      await tx.bankStatement.update({
        where: { id: rec.statement.id },
        data: { status: BankStatementStatus.LOCKED },
      });

      await this.eventBus.publish({
        eventName: 'BANK_RECONCILIATION_COMPLETED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'bank_reconciliation.complete',
        resource: 'bank_reconciliation',
        resourceId: rec.id,
        details: {
          reconciliationNumber: rec.reconciliationNumber,
          statementId: rec.statement.id,
        },
      });

      return updated;
    });
  }

  /**
   * Cancel open bank reconciliation session.
   */
  async cancel(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<BankReconciliationWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const rec = await tx.bankReconciliation.findFirst({
        where: { id, organizationId },
        include: {
          statement: {
            include: {
              currency: true,
              _count: { select: { transactions: true } },
            },
          },
          paymentAccount: {
            select: { id: true, code: true, name: true, type: true },
          },
        },
      });

      if (!rec) {
        throw new NotFoundException(
          `Bank reconciliation with ID ${id} not found in this organization.`,
        );
      }

      if (rec.status !== BankReconciliationStatus.OPEN) {
        throw new BadRequestException(
          `Only OPEN reconciliations can be cancelled. Current status: ${rec.status}`,
        );
      }

      const updated = await tx.bankReconciliation.update({
        where: { id: rec.id },
        data: { status: BankReconciliationStatus.CANCELLED },
        include: {
          paymentAccount: {
            select: { id: true, code: true, name: true, type: true },
          },
          statement: {
            include: {
              currency: true,
              _count: { select: { transactions: true } },
            },
          },
        },
      });

      await tx.bankStatement.update({
        where: { id: rec.statement.id },
        data: { status: BankStatementStatus.IMPORTED },
      });

      await this.eventBus.publish({
        eventName: 'BANK_RECONCILIATION_CANCELLED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'bank_reconciliation.cancel',
        resource: 'bank_reconciliation',
        resourceId: rec.id,
        details: { reconciliationNumber: rec.reconciliationNumber },
      });

      return updated;
    });
  }

  /**
   * List all bank reconciliations in organization.
   */
  async findAll(
    organizationId: string,
  ): Promise<BankReconciliationWithDetails[]> {
    return this.prisma.bankReconciliation.findMany({
      where: { organizationId },
      include: {
        paymentAccount: {
          select: { id: true, code: true, name: true, type: true },
        },
        statement: {
          include: {
            currency: true,
            _count: { select: { transactions: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  /**
   * Find single bank reconciliation by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<BankReconciliationWithDetails> {
    const rec = await this.prisma.bankReconciliation.findFirst({
      where: { id, organizationId },
      include: {
        paymentAccount: {
          select: { id: true, code: true, name: true, type: true },
        },
        statement: {
          include: {
            currency: true,
            _count: { select: { transactions: true } },
          },
        },
      },
    });

    if (!rec) {
      throw new NotFoundException(
        `Bank reconciliation with ID ${id} not found in this organization.`,
      );
    }

    return rec;
  }
}
