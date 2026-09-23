import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { RecordTaxTransactionDto } from './dto/record-tax-transaction.dto';
import { TaxReportQueryDto } from './dto/tax-report-query.dto';
import {
  Prisma,
  TaxPeriodStatus,
  TaxScope,
  FiscalPeriodStatus,
  JournalEntryStatus,
} from '@prisma/client';

@Injectable()
export class TaxTransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly accountMappingService: ApAccountMappingService,
  ) {}

  /**
   * Record a tax transaction into the authoritative tax ledger.
   * Idempotent per (organizationId, sourceType, sourceId, taxCodeId, isReversal).
   */
  async record(
    organizationId: string,
    dto: RecordTaxTransactionDto,
    actorUserId?: string,
    existingTx?: Prisma.TransactionClient,
  ) {
    const client = existingTx ?? this.prisma;
    const txDate = new Date(dto.transactionDate);

    // 1. Check if transaction falls within a LOCKED tax period
    const lockedPeriod = await client.taxPeriod.findFirst({
      where: {
        organizationId,
        status: TaxPeriodStatus.LOCKED,
        startDate: { lte: txDate },
        endDate: { gte: txDate },
      },
    });
    if (lockedPeriod) {
      throw new BadRequestException(
        `Cannot record tax transaction: Tax period "${lockedPeriod.name}" is LOCKED. Use adjustments.`,
      );
    }

    // 2. Idempotency check
    const existing = await client.taxTransaction.findUnique({
      where: {
        organizationId_sourceType_sourceId_taxCodeId_isReversal: {
          organizationId,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
          taxCodeId: dto.taxCodeId,
          isReversal: dto.isReversal ?? false,
        },
      },
      include: { taxCode: true, jurisdiction: true, journalEntry: true },
    });

    if (existing) {
      return existing;
    }

    // 3. Find matching active tax period to link
    const matchingPeriod = await client.taxPeriod.findFirst({
      where: {
        organizationId,
        startDate: { lte: txDate },
        endDate: { gte: txDate },
      },
    });

    let journalEntryId: string | null = dto.journalEntryId ?? null;

    // 4. Optional GL posting if requested and taxAmount > 0
    const taxAmount = new Prisma.Decimal(dto.taxAmount);
    if (dto.postToGl && !journalEntryId && taxAmount.greaterThan(0)) {
      const fiscalPeriod = await client.fiscalPeriod.findFirst({
        where: {
          organizationId,
          status: FiscalPeriodStatus.OPEN,
          startDate: { lte: txDate },
          endDate: { gte: txDate },
        },
      });

      if (fiscalPeriod) {
        let taxAccountId: string;
        let clearingAccountId: string;

        if (dto.taxScope === TaxScope.OUTPUT) {
          taxAccountId = await this.accountMappingService.resolveAccount(
            organizationId,
            'OUTPUT_TAX',
          );
          clearingAccountId = await this.accountMappingService.resolveAccount(
            organizationId,
            'ACCOUNTS_RECEIVABLE',
          );
        } else {
          taxAccountId = await this.accountMappingService.resolveAccount(
            organizationId,
            'INPUT_TAX',
          );
          clearingAccountId = await this.accountMappingService.resolveAccount(
            organizationId,
            'ACCOUNTS_PAYABLE',
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
          const count = await client.journalEntry.count({
            where: { organizationId },
          });
          journalNumber = `JE-${String(count + 1).padStart(6, '0')}`;
        }

        const debitAccount =
          dto.taxScope === TaxScope.OUTPUT ? clearingAccountId : taxAccountId;
        const creditAccount =
          dto.taxScope === TaxScope.OUTPUT ? taxAccountId : clearingAccountId;

        const glEntry = await client.journalEntry.create({
          data: {
            organizationId,
            fiscalPeriodId: fiscalPeriod.id,
            entryNumber: journalNumber,
            entryDate: txDate,
            description: `Tax Ledger Posting: ${dto.sourceType} ${dto.sourceNumber ?? dto.sourceId}`,
            status: JournalEntryStatus.POSTED,
            sourceType: 'TAX_LEDGER',
            createdByUserId:
              actorUserId ?? '00000000-0000-0000-0000-000000000000',
            postedByUserId:
              actorUserId ?? '00000000-0000-0000-0000-000000000000',
            postedAt: txDate,
            lines: {
              create: [
                {
                  organizationId,
                  accountId: debitAccount,
                  description: `Tax ${dto.taxScope} - Debit`,
                  debit: taxAmount,
                  credit: new Prisma.Decimal(0),
                  lineNumber: 1,
                },
                {
                  organizationId,
                  accountId: creditAccount,
                  description: `Tax ${dto.taxScope} - Credit`,
                  debit: new Prisma.Decimal(0),
                  credit: taxAmount,
                  lineNumber: 2,
                },
              ],
            },
          },
        });
        journalEntryId = glEntry.id;
      }
    }

    // 5. Create immutable tax transaction
    const record = await client.taxTransaction.create({
      data: {
        organizationId,
        taxCodeId: dto.taxCodeId,
        jurisdictionId: dto.jurisdictionId,
        journalEntryId,
        taxPeriodId: matchingPeriod?.id ?? null,
        transactionDate: txDate,
        taxScope: dto.taxScope,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        sourceNumber: dto.sourceNumber,
        currencyCode: dto.currencyCode ?? 'USD',
        taxableAmount: new Prisma.Decimal(dto.taxableAmount),
        taxRate: new Prisma.Decimal(dto.taxRate),
        taxAmount,
        isReversal: dto.isReversal ?? false,
        reversalOfTaxTransactionId: dto.reversalOfTaxTransactionId,
      },
      include: {
        taxCode: true,
        jurisdiction: true,
        journalEntry: true,
      },
    });

    if (!existingTx) {
      await this.eventBus.publish({
        eventName: 'TAX_TRANSACTION_POSTED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'tax_transaction.posted',
        resource: 'tax_transaction',
        resourceId: record.id,
        details: {
          taxScope: record.taxScope,
          sourceType: record.sourceType,
          taxAmount: record.taxAmount.toFixed(4),
        },
      });
    }

    return record;
  }

  async findAll(organizationId: string, query: TaxReportQueryDto) {
    const where: Prisma.TaxTransactionWhereInput = {
      organizationId,
      ...(query.taxCodeId ? { taxCodeId: query.taxCodeId } : {}),
      ...(query.jurisdictionId ? { jurisdictionId: query.jurisdictionId } : {}),
      ...(query.taxScope ? { taxScope: query.taxScope } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.startDate || query.endDate
        ? {
            transactionDate: {
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
      this.prisma.taxTransaction.findMany({
        where,
        include: {
          taxCode: true,
          jurisdiction: true,
          journalEntry: true,
        },
        orderBy: { transactionDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.taxTransaction.count({ where }),
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
    const tx = await this.prisma.taxTransaction.findFirst({
      where: { id, organizationId },
      include: {
        taxCode: true,
        jurisdiction: true,
        journalEntry: true,
      },
    });
    if (!tx) {
      throw new NotFoundException(`Tax transaction ${id} not found.`);
    }
    return tx;
  }
}
