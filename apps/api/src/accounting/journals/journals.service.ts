import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import {
  CreateJournalEntryDto,
  CreateJournalLineDto,
} from './dto/create-journal.dto';
import { UpdateJournalEntryDto } from './dto/update-journal.dto';
import { JournalQueryDto } from './dto/journal-query.dto';
import {
  JournalEntry,
  JournalEntryStatus,
  FiscalPeriodStatus,
  Prisma,
} from '@prisma/client';

export type JournalWithDetails = Prisma.JournalEntryGetPayload<{
  include: {
    fiscalPeriod: {
      select: {
        id: true;
        name: true;
        startDate: true;
        endDate: true;
        status: true;
      };
    };
    lines: {
      include: {
        account: {
          select: {
            id: true;
            code: true;
            name: true;
            type: true;
            isActive: true;
          };
        };
      };
      orderBy: { lineNumber: 'asc' };
    };
  };
}>;

@Injectable()
export class JournalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * Helper: Validate journal lines formatting and account ownership.
   */
  private async validateLines(
    organizationId: string,
    lines: CreateJournalLineDto[],
  ) {
    if (lines.length < 2) {
      throw new BadRequestException(
        'A journal entry must contain at least 2 lines.',
      );
    }

    const validatedLines: Array<{
      accountId: string;
      description?: string | null;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
      lineNumber: number;
    }> = [];

    for (let i = 0; i < lines.length; i++) {
      const lineDto = lines[i];
      const debit = new Prisma.Decimal(lineDto.debit ?? 0);
      const credit = new Prisma.Decimal(lineDto.credit ?? 0);

      // Debit/Credit non-negative check
      if (debit.lessThan(0) || credit.lessThan(0)) {
        throw new BadRequestException(
          `Line ${i + 1}: Debit and credit amounts must be non-negative.`,
        );
      }

      // XOR validation: exactly one must be > 0
      const isDebit = debit.greaterThan(0);
      const isCredit = credit.greaterThan(0);

      if ((isDebit && isCredit) || (!isDebit && !isCredit)) {
        throw new BadRequestException(
          `Line ${i + 1}: A line must have either a positive debit OR a positive credit, never both or neither.`,
        );
      }

      // Verify Account exists in organization and is active
      const account = await this.prisma.account.findFirst({
        where: {
          id: lineDto.accountId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!account) {
        throw new NotFoundException(
          `Line ${i + 1}: Account with ID ${lineDto.accountId} not found in this organization.`,
        );
      }

      if (!account.isActive) {
        throw new BadRequestException(
          `Line ${i + 1}: Account '${account.code} - ${account.name}' is inactive.`,
        );
      }

      validatedLines.push({
        accountId: lineDto.accountId,
        description: lineDto.description?.trim() ?? null,
        debit,
        credit,
        lineNumber: lineDto.lineNumber ?? i + 1,
      });
    }

    return validatedLines;
  }

  /**
   * Create a new draft journal entry.
   */
  async create(
    organizationId: string,
    dto: CreateJournalEntryDto,
    actorUserId: string,
  ): Promise<JournalWithDetails> {
    const entryDate = new Date(dto.entryDate);

    // 1. Verify Fiscal Period exists and is OPEN
    const fiscalPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: { id: dto.fiscalPeriodId, organizationId },
    });

    if (!fiscalPeriod) {
      throw new NotFoundException(
        `Fiscal period with ID ${dto.fiscalPeriodId} not found in this organization.`,
      );
    }

    if (fiscalPeriod.status !== FiscalPeriodStatus.OPEN) {
      throw new BadRequestException(
        `Cannot create journal entry in a CLOSED fiscal period '${fiscalPeriod.name}'.`,
      );
    }

    // 2. Validate entry date within fiscal period range
    if (
      entryDate < fiscalPeriod.startDate ||
      entryDate > fiscalPeriod.endDate
    ) {
      throw new BadRequestException(
        `Entry date (${dto.entryDate}) falls outside fiscal period '${fiscalPeriod.name}' date range (${fiscalPeriod.startDate.toISOString().slice(0, 10)} to ${fiscalPeriod.endDate.toISOString().slice(0, 10)}).`,
      );
    }

    // 3. Validate Lines
    const validatedLines = await this.validateLines(organizationId, dto.lines);

    // 4. Generate Journal Entry Number
    let entryNumber: string;
    try {
      const generated = await this.numberingService.nextNumber(
        organizationId,
        'JOURNAL_ENTRY',
        actorUserId,
      );
      entryNumber = generated.formatted;
    } catch {
      const count = await this.prisma.journalEntry.count({
        where: { organizationId },
      });
      entryNumber = `JE-${String(count + 1).padStart(6, '0')}`;
    }

    // 5. Create in transaction
    const journal = await this.prisma.$transaction(async (tx) => {
      const created = await tx.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: dto.fiscalPeriodId,
          entryNumber,
          entryDate,
          description: dto.description?.trim() ?? null,
          status: JournalEntryStatus.DRAFT,
          sourceType: dto.sourceType ?? 'MANUAL',
          sourceId: dto.sourceId ?? null,
          createdByUserId: actorUserId,
        },
      });

      await tx.journalLine.createMany({
        data: validatedLines.map((l) => ({
          ...l,
          journalEntryId: created.id,
          organizationId,
        })),
      });

      return tx.journalEntry.findUniqueOrThrow({
        where: { id: created.id },
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
    });

    await this.eventBus.publish({
      eventName: 'JOURNAL_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'journal.create',
      resource: 'journal_entry',
      resourceId: journal.id,
      details: {
        entryNumber: journal.entryNumber,
        status: journal.status,
      },
    });

    return journal;
  }

  /**
   * List journal entries with pagination and filters.
   */
  async findAll(
    organizationId: string,
    query: JournalQueryDto,
  ): Promise<{
    journals: JournalEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.JournalEntryWhereInput = { organizationId };

    if (query.status) where.status = query.status;
    if (query.fiscalPeriodId) where.fiscalPeriodId = query.fiscalPeriodId;
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.sourceId) where.sourceId = query.sourceId;

    if (query.fromDate || query.toDate) {
      where.entryDate = {};
      if (query.fromDate) where.entryDate.gte = new Date(query.fromDate);
      if (query.toDate) where.entryDate.lte = new Date(query.toDate);
    }

    if (query.search) {
      where.OR = [
        { entryNumber: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, journals] = await Promise.all([
      this.prisma.journalEntry.count({ where }),
      this.prisma.journalEntry.findMany({
        where,
        include: {
          fiscalPeriod: {
            select: { id: true, name: true, status: true },
          },
          _count: { select: { lines: true } },
        },
        orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      journals,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find single journal entry by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<JournalWithDetails> {
    const journal = await this.prisma.journalEntry.findFirst({
      where: { id, organizationId },
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

    if (!journal) {
      throw new NotFoundException(
        `Journal entry with ID ${id} not found in this organization.`,
      );
    }

    return journal;
  }

  /**
   * Update draft journal entry.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateJournalEntryDto,
    actorUserId: string,
  ): Promise<JournalWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== JournalEntryStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT journal entries can be modified. Current status: ${existing.status}`,
      );
    }

    const fiscalPeriodId = dto.fiscalPeriodId ?? existing.fiscalPeriodId;
    const entryDate = dto.entryDate
      ? new Date(dto.entryDate)
      : existing.entryDate;

    // Verify fiscal period
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id: fiscalPeriodId, organizationId },
    });

    if (!period) {
      throw new NotFoundException(
        `Fiscal period with ID ${fiscalPeriodId} not found in this organization.`,
      );
    }

    if (period.status !== FiscalPeriodStatus.OPEN) {
      throw new BadRequestException(
        `Cannot update journal entry in a CLOSED fiscal period '${period.name}'.`,
      );
    }

    if (entryDate < period.startDate || entryDate > period.endDate) {
      throw new BadRequestException(
        `Entry date falls outside fiscal period '${period.name}' date range.`,
      );
    }

    let validatedLines: Array<{
      accountId: string;
      description?: string | null;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
      lineNumber: number;
    }> | null = null;
    if (dto.lines) {
      validatedLines = await this.validateLines(organizationId, dto.lines);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const data: Prisma.JournalEntryUpdateInput = {};
      if (dto.fiscalPeriodId) {
        data.fiscalPeriod = { connect: { id: dto.fiscalPeriodId } };
      }
      if (dto.entryDate) data.entryDate = entryDate;
      if (dto.description !== undefined) {
        data.description = dto.description?.trim() ?? null;
      }
      if (dto.sourceType !== undefined) {
        data.sourceType = dto.sourceType?.trim() ?? null;
      }
      if (dto.sourceId !== undefined) data.sourceId = dto.sourceId ?? null;

      if (validatedLines) {
        await tx.journalLine.deleteMany({ where: { journalEntryId: id } });
        await tx.journalLine.createMany({
          data: validatedLines.map((l) => ({
            ...l,
            journalEntryId: id,
            organizationId,
          })),
        });
      }

      await tx.journalEntry.update({
        where: { id },
        data,
      });

      return tx.journalEntry.findUniqueOrThrow({
        where: { id },
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
    });

    await this.eventBus.publish({
      eventName: 'JOURNAL_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'journal.update',
      resource: 'journal_entry',
      resourceId: updated.id,
      details: { entryNumber: updated.entryNumber },
    });

    return updated;
  }

  /**
   * Delete draft journal entry.
   */
  async remove(
    organizationId: string,
    id: string,
  ): Promise<{ success: boolean }> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== JournalEntryStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT journal entries can be deleted. Current status: ${existing.status}`,
      );
    }

    await this.prisma.journalEntry.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Create a compensating reversal entry for a posted journal entry.
   */
  async reverse(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<JournalWithDetails> {
    const original = await this.findOne(organizationId, id);

    if (original.status !== JournalEntryStatus.POSTED) {
      throw new BadRequestException(
        `Only POSTED journal entries can be reversed. Current status: ${original.status}`,
      );
    }

    // Verify current fiscal period of the original is OPEN, or use the latest OPEN period
    let activePeriod = await this.prisma.fiscalPeriod.findFirst({
      where: { id: original.fiscalPeriodId, organizationId },
    });

    if (!activePeriod || activePeriod.status !== FiscalPeriodStatus.OPEN) {
      activePeriod = await this.prisma.fiscalPeriod.findFirst({
        where: {
          organizationId,
          status: FiscalPeriodStatus.OPEN,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
      });

      if (!activePeriod) {
        throw new BadRequestException(
          'No active OPEN fiscal period available for the reversal entry.',
        );
      }
    }

    // Generate Reversal Journal Entry Number
    let entryNumber: string;
    try {
      const generated = await this.numberingService.nextNumber(
        organizationId,
        'JOURNAL_ENTRY',
        actorUserId,
      );
      entryNumber = generated.formatted;
    } catch {
      const count = await this.prisma.journalEntry.count({
        where: { organizationId },
      });
      entryNumber = `JE-${String(count + 1).padStart(6, '0')}`;
    }

    const reversal = await this.prisma.$transaction(async (tx) => {
      // 1. Create Reversal Journal Entry with POSTED status
      const created = await tx.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: activePeriod.id,
          entryNumber,
          entryDate: new Date(),
          description:
            `Reversal of ${original.entryNumber}: ${original.description ?? ''}`.trim(),
          status: JournalEntryStatus.POSTED,
          sourceType: 'REVERSAL',
          sourceId: original.id,
          createdByUserId: actorUserId,
          postedAt: new Date(),
          postedByUserId: actorUserId,
        },
      });

      // 2. Create Inverted Journal Lines (Debit <-> Credit swapped)
      await tx.journalLine.createMany({
        data: original.lines.map((l) => ({
          journalEntryId: created.id,
          organizationId,
          accountId: l.accountId,
          description: `Reversal: ${l.description ?? ''}`.trim() || null,
          debit: l.credit, // Swapped!
          credit: l.debit, // Swapped!
          lineNumber: l.lineNumber,
        })),
      });

      // 3. Mark original journal status as VOIDED
      await tx.journalEntry.update({
        where: { id },
        data: { status: JournalEntryStatus.VOIDED },
      });

      return tx.journalEntry.findUniqueOrThrow({
        where: { id: created.id },
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
    });

    await this.eventBus.publish({
      eventName: 'JOURNAL_REVERSED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'journal.reverse',
      resource: 'journal_entry',
      resourceId: id,
      details: {
        originalEntryNumber: original.entryNumber,
        reversalEntryNumber: reversal.entryNumber,
      },
    });

    return reversal;
  }
}
