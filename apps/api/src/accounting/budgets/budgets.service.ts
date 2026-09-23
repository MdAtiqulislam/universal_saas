import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { BudgetQueryDto } from './dto/budget-query.dto';
import { Prisma, BudgetStatus } from '@prisma/client';

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  async create(organizationId: string, dto: CreateBudgetDto, userId: string) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date.');
    }

    // Validate Currency
    const currency = await this.prisma.currency.findFirst({
      where: { id: dto.currencyId, isActive: true },
    });
    if (!currency) {
      throw new NotFoundException(`Currency ${dto.currencyId} not found.`);
    }

    // Numbering
    let budgetNumber = dto.budgetNumber;
    if (!budgetNumber) {
      const generated = await this.numberingService.nextNumber(
        organizationId,
        'BUDGET',
        userId,
      );
      budgetNumber = generated.formatted;
    } else {
      const duplicate = await this.prisma.budget.findFirst({
        where: { organizationId, budgetNumber, deletedAt: null },
      });
      if (duplicate) {
        throw new ConflictException(
          `Budget with number "${budgetNumber}" already exists in this organization.`,
        );
      }
    }

    // Validate lines if provided
    let totalBudget = new Prisma.Decimal(0);
    const linesToCreate: Prisma.BudgetLineCreateWithoutBudgetInput[] = [];

    if (dto.lines && dto.lines.length > 0) {
      await this.validateBudgetLines(
        organizationId,
        dto.lines,
        startDate,
        endDate,
      );

      for (const line of dto.lines) {
        const amount = new Prisma.Decimal(line.amount);
        totalBudget = totalBudget.add(amount);

        linesToCreate.push({
          organization: { connect: { id: organizationId } },
          account: { connect: { id: line.accountId } },
          category: line.category ?? 'OTHER',
          ...(line.fiscalPeriodId
            ? { fiscalPeriod: { connect: { id: line.fiscalPeriodId } } }
            : {}),
          period: line.period,
          startDate: new Date(line.startDate),
          endDate: new Date(line.endDate),
          amount,
          notes: line.notes,
        });
      }
    }

    const budget = await this.prisma.budget.create({
      data: {
        organizationId,
        budgetNumber,
        name: dto.name,
        description: dto.description,
        fiscalYear: dto.fiscalYear,
        startDate,
        endDate,
        currencyId: dto.currencyId,
        periodType: dto.periodType ?? 'MONTHLY',
        controlPolicy: dto.controlPolicy ?? 'WARN',
        warnThresholdPercent:
          dto.warnThresholdPercent !== undefined
            ? new Prisma.Decimal(dto.warnThresholdPercent)
            : new Prisma.Decimal(90.0),
        totalBudget,
        status: BudgetStatus.DRAFT,
        notes: dto.notes,
        createdByUserId: userId,
        lines: { create: linesToCreate },
      },
      include: {
        currency: true,
        lines: { include: { account: true, fiscalPeriod: true } },
      },
    });

    await this.eventBus.publish({
      eventName: 'BUDGET_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'budget.created',
      resource: 'budget',
      resourceId: budget.id,
      details: {
        budgetNumber: budget.budgetNumber,
        name: budget.name,
        fiscalYear: budget.fiscalYear,
        totalBudget: budget.totalBudget.toFixed(4),
      },
    });

    return budget;
  }

  async findAll(organizationId: string, query: BudgetQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.BudgetWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.fiscalYear ? { fiscalYear: query.fiscalYear } : {}),
      ...(query.startDate || query.endDate
        ? {
            startDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.budget.findMany({
        where,
        include: {
          currency: true,
          _count: { select: { lines: true } },
        },
        orderBy: [{ fiscalYear: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.budget.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(organizationId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        currency: true,
        lines: {
          include: { account: true, fiscalPeriod: true },
          orderBy: [{ startDate: 'asc' }, { period: 'asc' }],
        },
      },
    });

    if (!budget) {
      throw new NotFoundException(`Budget ${id} not found.`);
    }

    return budget;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateBudgetDto,
    userId: string,
  ) {
    const budget = await this.findOne(organizationId, id);

    if (budget.status !== BudgetStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot modify budget in status ${budget.status}. Only DRAFT budgets can be modified.`,
      );
    }

    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : budget.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : budget.endDate;

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date.');
    }

    return this.prisma.$transaction(async (tx) => {
      let totalBudget = budget.totalBudget;

      if (dto.lines !== undefined) {
        await this.validateBudgetLines(
          organizationId,
          dto.lines,
          startDate,
          endDate,
        );

        // Delete existing lines
        await tx.budgetLine.deleteMany({
          where: { budgetId: budget.id, organizationId },
        });

        totalBudget = new Prisma.Decimal(0);
        const linesToCreate = dto.lines.map((line) => {
          const amount = new Prisma.Decimal(line.amount);
          totalBudget = totalBudget.add(amount);

          return {
            organizationId,
            budgetId: budget.id,
            accountId: line.accountId,
            category: line.category ?? 'OTHER',
            fiscalPeriodId: line.fiscalPeriodId ?? null,
            period: line.period,
            startDate: new Date(line.startDate),
            endDate: new Date(line.endDate),
            amount,
            notes: line.notes,
          };
        });

        if (linesToCreate.length > 0) {
          await tx.budgetLine.createMany({ data: linesToCreate });
        }
      }

      const updated = await tx.budget.update({
        where: { id: budget.id },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.fiscalYear ? { fiscalYear: dto.fiscalYear } : {}),
          ...(dto.startDate ? { startDate } : {}),
          ...(dto.endDate ? { endDate } : {}),
          ...(dto.currencyId ? { currencyId: dto.currencyId } : {}),
          ...(dto.periodType ? { periodType: dto.periodType } : {}),
          ...(dto.controlPolicy ? { controlPolicy: dto.controlPolicy } : {}),
          ...(dto.warnThresholdPercent !== undefined
            ? {
                warnThresholdPercent: new Prisma.Decimal(
                  dto.warnThresholdPercent,
                ),
              }
            : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          totalBudget,
        },
        include: {
          currency: true,
          lines: { include: { account: true, fiscalPeriod: true } },
        },
      });

      await this.eventBus.publish({
        eventName: 'BUDGET_UPDATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'budget.updated',
        resource: 'budget',
        resourceId: updated.id,
        details: {
          budgetNumber: updated.budgetNumber ?? budget.budgetNumber,
          totalBudget: (updated.totalBudget ?? budget.totalBudget).toFixed(4),
        },
      });

      return updated;
    });
  }

  async delete(organizationId: string, id: string) {
    const budget = await this.findOne(organizationId, id);

    if (
      budget.status !== BudgetStatus.DRAFT &&
      budget.status !== BudgetStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot delete budget in status ${budget.status}. Only DRAFT or CANCELLED budgets can be deleted.`,
      );
    }

    return this.prisma.budget.update({
      where: { id: budget.id },
      data: { deletedAt: new Date() },
    });
  }

  async submit(organizationId: string, id: string, userId: string) {
    const budget = await this.findOne(organizationId, id);

    if (budget.status !== BudgetStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot submit budget in status ${budget.status}. Budget must be in DRAFT.`,
      );
    }

    if (budget.lines.length === 0) {
      throw new BadRequestException(
        'Cannot submit budget without budget lines.',
      );
    }

    const updated = await this.prisma.budget.update({
      where: { id: budget.id },
      data: { status: BudgetStatus.SUBMITTED },
      include: { currency: true, lines: true },
    });

    await this.eventBus.publish({
      eventName: 'BUDGET_SUBMITTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'budget.submitted',
      resource: 'budget',
      resourceId: updated.id,
      details: {
        budgetNumber: updated.budgetNumber ?? budget.budgetNumber,
        totalBudget: (updated.totalBudget ?? budget.totalBudget).toFixed(4),
      },
    });

    return updated;
  }

  async approve(organizationId: string, id: string, userId: string) {
    const budget = await this.findOne(organizationId, id);

    if (budget.status !== BudgetStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot approve budget in status ${budget.status}. Budget must be in SUBMITTED.`,
      );
    }

    const updated = await this.prisma.budget.update({
      where: { id: budget.id },
      data: {
        status: BudgetStatus.APPROVED,
        approvedByUserId: userId,
        approvedAt: new Date(),
      },
      include: { currency: true, lines: true },
    });

    await this.eventBus.publish({
      eventName: 'BUDGET_APPROVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'budget.approved',
      resource: 'budget',
      resourceId: updated.id,
      details: {
        budgetNumber: updated.budgetNumber,
        approvedBy: userId,
      },
    });

    return updated;
  }

  async activate(organizationId: string, id: string, userId: string) {
    const budget = await this.findOne(organizationId, id);

    if (
      budget.status !== BudgetStatus.APPROVED &&
      budget.status !== BudgetStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Cannot activate budget in status ${budget.status}. Budget must be APPROVED or DRAFT.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // If there's an existing ACTIVE budget for same fiscal year, close or archive it
      await tx.budget.updateMany({
        where: {
          organizationId,
          fiscalYear: budget.fiscalYear,
          status: BudgetStatus.ACTIVE,
          NOT: { id: budget.id },
        },
        data: { status: BudgetStatus.CLOSED },
      });

      const updated = await tx.budget.update({
        where: { id: budget.id },
        data: {
          status: BudgetStatus.ACTIVE,
          ...(budget.approvedAt
            ? {}
            : { approvedAt: new Date(), approvedByUserId: userId }),
        },
        include: { currency: true, lines: true },
      });

      await this.eventBus.publish({
        eventName: 'BUDGET_ACTIVATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'budget.activated',
        resource: 'budget',
        resourceId: updated.id,
        details: {
          budgetNumber: updated.budgetNumber,
          fiscalYear: updated.fiscalYear,
        },
      });

      return updated;
    });
  }

  async close(organizationId: string, id: string, userId: string) {
    const budget = await this.findOne(organizationId, id);

    if (budget.status !== BudgetStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot close budget in status ${budget.status}. Only ACTIVE budgets can be closed.`,
      );
    }

    const updated = await this.prisma.budget.update({
      where: { id: budget.id },
      data: { status: BudgetStatus.CLOSED },
      include: { currency: true },
    });

    await this.eventBus.publish({
      eventName: 'BUDGET_CLOSED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'budget.closed',
      resource: 'budget',
      resourceId: updated.id,
      details: {
        budgetNumber: updated.budgetNumber,
      },
    });

    return updated;
  }

  async cancel(organizationId: string, id: string, userId: string) {
    const budget = await this.findOne(organizationId, id);

    if (
      budget.status !== BudgetStatus.DRAFT &&
      budget.status !== BudgetStatus.SUBMITTED
    ) {
      throw new BadRequestException(
        `Cannot cancel budget in status ${budget.status}. Only DRAFT or SUBMITTED budgets can be cancelled.`,
      );
    }

    const updated = await this.prisma.budget.update({
      where: { id: budget.id },
      data: { status: BudgetStatus.CANCELLED },
      include: { currency: true },
    });

    await this.eventBus.publish({
      eventName: 'BUDGET_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'budget.cancelled',
      resource: 'budget',
      resourceId: updated.id,
      details: {
        budgetNumber: updated.budgetNumber,
      },
    });

    return updated;
  }

  async reject(
    organizationId: string,
    id: string,
    reason: string | undefined,
    userId: string,
  ) {
    const budget = await this.findOne(organizationId, id);

    if (budget.status !== BudgetStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot reject budget in status ${budget.status}. Budget must be in SUBMITTED.`,
      );
    }

    const updated = await this.prisma.budget.update({
      where: { id: budget.id },
      data: {
        status: BudgetStatus.REJECTED,
        rejectionReason: reason,
      },
      include: { currency: true },
    });

    await this.eventBus.publish({
      eventName: 'BUDGET_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'budget.rejected',
      resource: 'budget',
      resourceId: updated.id,
      details: {
        budgetNumber: updated.budgetNumber,
        reason,
      },
    });

    return updated;
  }

  private async validateBudgetLines(
    organizationId: string,
    lines: Array<{
      accountId: string;
      fiscalPeriodId?: string;
      period: string;
      startDate: string;
      endDate: string;
      amount: number;
    }>,
    budgetStart: Date,
    budgetEnd: Date,
  ) {
    const accountIds = Array.from(new Set(lines.map((l) => l.accountId)));
    const accounts = await this.prisma.account.findMany({
      where: {
        id: { in: accountIds },
        organizationId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (accounts.length !== accountIds.length) {
      throw new NotFoundException(
        'One or more accounts in budget lines do not exist, are inactive, or belong to another organization.',
      );
    }

    // Check period uniqueness in payload: (accountId + period)
    const seen = new Set<string>();
    for (const line of lines) {
      if (line.amount < 0) {
        throw new BadRequestException('Budget line amount cannot be negative.');
      }

      const lStart = new Date(line.startDate);
      const lEnd = new Date(line.endDate);

      if (lEnd <= lStart) {
        throw new BadRequestException(
          `Line period "${line.period}" end date must be after start date.`,
        );
      }

      if (lStart < budgetStart || lEnd > budgetEnd) {
        throw new BadRequestException(
          `Line period "${line.period}" (${line.startDate} - ${line.endDate}) must fall within budget dates (${budgetStart.toISOString().slice(0, 10)} - ${budgetEnd.toISOString().slice(0, 10)}).`,
        );
      }

      const key = `${line.accountId}::${line.period}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate budget line for account ${line.accountId} and period "${line.period}".`,
        );
      }
      seen.add(key);
    }
  }
}
