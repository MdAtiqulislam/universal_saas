import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { ReimburseExpenseClaimDto } from './dto/reimburse-expense-claim.dto';
import {
  Prisma,
  ExpenseClaimStatus,
  PaymentType,
  PaymentStatus,
  FiscalPeriodStatus,
  JournalEntryStatus,
} from '@prisma/client';

@Injectable()
export class ExpenseReimbursementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly accountMappingService: ApAccountMappingService,
  ) {}

  async reimburse(
    organizationId: string,
    claimId: string,
    dto: ReimburseExpenseClaimDto,
    actorUserId: string,
  ) {
    const claim = await this.prisma.expenseClaim.findFirst({
      where: { id: claimId, organizationId },
      include: { claimant: true },
    });
    if (!claim) {
      throw new NotFoundException(`Expense claim ${claimId} not found.`);
    }

    if (
      claim.status !== ExpenseClaimStatus.POSTED &&
      claim.status !== ExpenseClaimStatus.APPROVED
    ) {
      throw new BadRequestException(
        `Cannot reimburse expense claim in status ${claim.status}. Claim must be POSTED or APPROVED.`,
      );
    }

    const payAmount = new Prisma.Decimal(dto.amount);
    if (payAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Reimbursement amount must be greater than zero.',
      );
    }

    if (payAmount.greaterThan(claim.dueAmount)) {
      throw new BadRequestException(
        `Reimbursement amount (${payAmount.toFixed(4)}) exceeds remaining due amount (${claim.dueAmount.toFixed(4)}).`,
      );
    }

    const paymentAccount = await this.prisma.paymentAccount.findFirst({
      where: { id: dto.paymentAccountId, organizationId, deletedAt: null },
    });
    if (!paymentAccount) {
      throw new NotFoundException('Payment account not found.');
    }
    if (!paymentAccount.isActive) {
      throw new BadRequestException('Payment account is inactive.');
    }

    const paymentDate = new Date(dto.paymentDate);
    const fiscalPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: {
        organizationId,
        status: FiscalPeriodStatus.OPEN,
        startDate: { lte: paymentDate },
        endDate: { gte: paymentDate },
      },
    });
    if (!fiscalPeriod) {
      throw new BadRequestException(
        `No OPEN fiscal period found covering reimbursement payment date ${paymentDate.toISOString().slice(0, 10)}.`,
      );
    }

    const payableAccountId = await this.accountMappingService.resolveAccount(
      organizationId,
      'EMPLOYEE_EXPENSE_PAYABLE',
    );

    let paymentNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'PAYMENT',
        actorUserId,
      );
      paymentNumber = seq.formatted;
    } catch {
      const count = await this.prisma.payment.count({
        where: { organizationId },
      });
      paymentNumber = `PAY-EX-${String(count + 1).padStart(6, '0')}`;
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
      journalNumber = `JE-PAY-${String(count + 1).padStart(6, '0')}`;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Re-fetch claim inside transaction with locking check
      const currentClaim = await tx.expenseClaim.findUnique({
        where: { id: claim.id },
      });
      if (!currentClaim) {
        throw new NotFoundException('Expense claim not found.');
      }
      if (payAmount.greaterThan(currentClaim.dueAmount)) {
        throw new BadRequestException(
          `Reimbursement amount (${payAmount.toFixed(4)}) exceeds current due amount (${currentClaim.dueAmount.toFixed(4)}).`,
        );
      }

      // 1. Create GL journal entry for reimbursement
      const glEntry = await tx.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber: journalNumber,
          entryDate: paymentDate,
          description: `Employee Reimbursement: ${claim.claimNumber} - ${claim.claimant.name}`,
          status: JournalEntryStatus.POSTED,
          sourceType: 'EXPENSE_REIMBURSEMENT',
          sourceId: claim.id,
          createdByUserId: actorUserId,
          postedByUserId: actorUserId,
          postedAt: new Date(),
          lines: {
            create: [
              {
                organizationId,
                accountId: payableAccountId,
                description: `Debit Payable: ${claim.claimant.name}`,
                debit: payAmount,
                credit: new Prisma.Decimal(0),
                lineNumber: 1,
              },
              {
                organizationId,
                accountId: paymentAccount.accountingAccountId,
                description: `Credit Bank/Cash: ${paymentAccount.name}`,
                debit: new Prisma.Decimal(0),
                credit: payAmount,
                lineNumber: 2,
              },
            ],
          },
        },
      });

      // 2. Create Payment record
      const payment = await tx.payment.create({
        data: {
          organizationId,
          paymentNumber,
          type: PaymentType.REIMBURSEMENT,
          paymentAccountId: paymentAccount.id,
          currencyId: claim.currencyId,
          claimantId: claim.claimantId,
          paymentDate,
          amount: payAmount,
          allocatedAmount: payAmount,
          unallocatedAmount: new Prisma.Decimal(0),
          reference: dto.reference ?? `Reimbursement ${claim.claimNumber}`,
          notes: dto.notes,
          status: PaymentStatus.ALLOCATED,
          journalEntryId: glEntry.id,
          createdByUserId: actorUserId,
          postedByUserId: actorUserId,
          postedAt: new Date(),
        },
      });

      // 3. Create Payment Allocation
      const allocation = await tx.paymentAllocation.create({
        data: {
          organizationId,
          paymentId: payment.id,
          expenseClaimId: claim.id,
          amount: payAmount,
          createdByUserId: actorUserId,
        },
      });

      // 4. Update claim paid/due amounts
      const newPaid = currentClaim.paidAmount.add(payAmount);
      const newDue = currentClaim.dueAmount.sub(payAmount);
      const isFullyPaid = newDue.isZero();

      const updatedClaim = await tx.expenseClaim.update({
        where: { id: claim.id },
        data: {
          paidAmount: newPaid,
          dueAmount: newDue,
          ...(isFullyPaid
            ? { status: ExpenseClaimStatus.PAID, paidAt: new Date() }
            : {}),
        },
      });

      return {
        payment,
        allocation,
        claim: updatedClaim,
      };
    });

    await this.eventBus.publish({
      eventName: 'EXPENSE_REIMBURSEMENT_POSTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'expense_reimbursement.posted',
      resource: 'payment',
      resourceId: result.payment.id,
      details: {
        claimNumber: claim.claimNumber,
        paymentNumber: result.payment.paymentNumber,
        amount: payAmount.toFixed(4),
        remainingDue: result.claim.dueAmount.toFixed(4),
      },
    });

    if (result.claim.status === ExpenseClaimStatus.PAID) {
      await this.eventBus.publish({
        eventName: 'EXPENSE_CLAIM_PAID',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'expense_claim.paid',
        resource: 'expense_claim',
        resourceId: claim.id,
        details: { claimNumber: claim.claimNumber },
      });
    }

    return result;
  }

  async findAll(organizationId: string) {
    return this.prisma.payment.findMany({
      where: {
        organizationId,
        type: PaymentType.REIMBURSEMENT,
        deletedAt: null,
      },
      include: {
        paymentAccount: true,
        claimant: true,
        currency: true,
        allocations: { include: { expenseClaim: true } },
      },
      orderBy: { paymentDate: 'desc' },
    });
  }
}
