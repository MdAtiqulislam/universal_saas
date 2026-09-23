import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { JournalWithDetails } from '../journals/journals.service';
import { JournalEntryStatus, FiscalPeriodStatus, Prisma } from '@prisma/client';

@Injectable()
export class AccountingPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Atomically validate and post a draft journal entry to the general ledger.
   * Enforces double-entry balance (Sum(Debit) == Sum(Credit)) using exact Decimal precision.
   */
  async post(
    organizationId: string,
    journalId: string,
    actorUserId: string,
  ): Promise<JournalWithDetails> {
    const postedJournal = await this.prisma.$transaction(async (tx) => {
      // 1. Fetch journal with lines and fiscal period
      const journal = await tx.journalEntry.findFirst({
        where: { id: journalId, organizationId },
        include: {
          fiscalPeriod: true,
          lines: {
            include: {
              account: true,
            },
            orderBy: { lineNumber: 'asc' },
          },
        },
      });

      if (!journal) {
        throw new NotFoundException(
          `Journal entry with ID ${journalId} not found in this organization.`,
        );
      }

      // 2. Validate current status is DRAFT
      if (journal.status === JournalEntryStatus.POSTED) {
        throw new BadRequestException(
          `Journal entry ${journal.entryNumber} is already posted.`,
        );
      }

      if (journal.status === JournalEntryStatus.VOIDED) {
        throw new BadRequestException(
          `Cannot post voided journal entry ${journal.entryNumber}.`,
        );
      }

      // 3. Validate Fiscal Period is OPEN
      if (journal.fiscalPeriod.status !== FiscalPeriodStatus.OPEN) {
        throw new BadRequestException(
          `Cannot post into a ${journal.fiscalPeriod.status} fiscal period '${journal.fiscalPeriod.name}'.`,
        );
      }

      // 4. Validate entry date is within fiscal period range
      if (
        journal.entryDate < journal.fiscalPeriod.startDate ||
        journal.entryDate > journal.fiscalPeriod.endDate
      ) {
        throw new BadRequestException(
          `Journal entry date (${journal.entryDate.toISOString().slice(0, 10)}) is outside fiscal period '${journal.fiscalPeriod.name}' date range.`,
        );
      }

      // 5. Validate minimum lines
      if (journal.lines.length < 2) {
        throw new BadRequestException(
          `Journal entry must contain at least 2 lines to post. Current lines: ${journal.lines.length}.`,
        );
      }

      // 6. Validate accounts and calculate exact debit/credit totals
      let totalDebit = new Prisma.Decimal(0);
      let totalCredit = new Prisma.Decimal(0);

      for (let i = 0; i < journal.lines.length; i++) {
        const line = journal.lines[i];

        if (!line.account || line.account.deletedAt !== null) {
          throw new BadRequestException(
            `Line ${i + 1}: Referenced account is deleted or invalid.`,
          );
        }

        if (!line.account.isActive) {
          throw new BadRequestException(
            `Line ${i + 1}: Account '${line.account.code} - ${line.account.name}' is inactive.`,
          );
        }

        if (line.account.organizationId !== organizationId) {
          throw new BadRequestException(
            `Line ${i + 1}: Account does not belong to this organization.`,
          );
        }

        const debit = line.debit;
        const credit = line.credit;

        // Verify line debit/credit constraints
        if (debit.lessThan(0) || credit.lessThan(0)) {
          throw new BadRequestException(
            `Line ${i + 1}: Negative amounts are not allowed in journal lines.`,
          );
        }

        const isDebit = debit.greaterThan(0);
        const isCredit = credit.greaterThan(0);

        if ((isDebit && isCredit) || (!isDebit && !isCredit)) {
          throw new BadRequestException(
            `Line ${i + 1}: Each line must have either a positive debit or a positive credit, never both or neither.`,
          );
        }

        totalDebit = totalDebit.add(debit);
        totalCredit = totalCredit.add(credit);
      }

      // 7. Double-entry balance check: Total Debit MUST equal Total Credit
      if (!totalDebit.equals(totalCredit)) {
        throw new BadRequestException(
          `Unbalanced journal entry: Total Debit (${totalDebit.toString()}) does not equal Total Credit (${totalCredit.toString()}). Difference: ${totalDebit.sub(totalCredit).abs().toString()}`,
        );
      }

      // 8. Update status to POSTED
      const updated = await tx.journalEntry.update({
        where: { id: journalId },
        data: {
          status: JournalEntryStatus.POSTED,
          postedAt: new Date(),
          postedByUserId: actorUserId,
        },
        include: {
          fiscalPeriod: {
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true,
              status: true,
            },
          },
          lines: {
            include: {
              account: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  type: true,
                  isActive: true,
                },
              },
            },
            orderBy: { lineNumber: 'asc' },
          },
        },
      });

      return updated;
    });

    // 9. Publish event
    await this.eventBus.publish({
      eventName: 'JOURNAL_POSTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'journal.post',
      resource: 'journal_entry',
      resourceId: postedJournal.id,
      details: {
        entryNumber: postedJournal.entryNumber,
        fiscalPeriodName: postedJournal.fiscalPeriod.name,
      },
    });

    return postedJournal;
  }
}
