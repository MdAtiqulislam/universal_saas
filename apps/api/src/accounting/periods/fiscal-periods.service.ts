import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import {
  PeriodCloseEngineService,
  PeriodCloseExecutionSummary,
} from './period-close-engine.service';
import { CreateFiscalPeriodDto } from './dto/create-period.dto';
import { ReopenPeriodDto } from './dto/reopen-period.dto';
import { FiscalPeriodQueryDto } from './dto/period-query.dto';
import {
  FiscalPeriod,
  FiscalPeriodStatus,
  PeriodCloseRun,
  PeriodCloseCheck,
  PeriodCloseRunStatus,
  Prisma,
} from '@prisma/client';

export type FiscalPeriodWithDetails = Prisma.FiscalPeriodGetPayload<{
  include: {
    _count: { select: { journalEntries: true } };
    closeRuns: {
      include: {
        checks: true;
      };
      orderBy: { startedAt: 'desc' };
      take: 1;
    };
  };
}>;

@Injectable()
export class FiscalPeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly closeEngine: PeriodCloseEngineService,
  ) {}

  /**
   * Create a new fiscal period for tenant.
   */
  async create(
    organizationId: string,
    dto: CreateFiscalPeriodDto,
    actorUserId?: string,
  ): Promise<FiscalPeriod> {
    const name = dto.name.trim();
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    // 1. Validate date bounds
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid startDate or endDate provided.');
    }

    if (startDate >= endDate) {
      throw new BadRequestException(
        'Fiscal period startDate must be strictly before endDate.',
      );
    }

    // 2. Verify name uniqueness within tenant
    const existingName = await this.prisma.fiscalPeriod.findFirst({
      where: { organizationId, name },
    });

    if (existingName) {
      throw new ConflictException(
        `Fiscal period with name '${name}' already exists in this organization.`,
      );
    }

    // 3. Prevent date range overlap within tenant
    const overlapping = await this.prisma.fiscalPeriod.findFirst({
      where: {
        organizationId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (overlapping) {
      throw new ConflictException(
        `Fiscal period date range overlaps with existing period '${overlapping.name}' (${overlapping.startDate.toISOString().slice(0, 10)} to ${overlapping.endDate.toISOString().slice(0, 10)}).`,
      );
    }

    // 4. Verify fiscalYear/periodNumber uniqueness if provided
    if (dto.fiscalYear && dto.periodNumber) {
      const existingYearPeriod = await this.prisma.fiscalPeriod.findFirst({
        where: {
          organizationId,
          fiscalYear: dto.fiscalYear,
          periodNumber: dto.periodNumber,
        },
      });
      if (existingYearPeriod) {
        throw new ConflictException(
          `Fiscal period for Year ${dto.fiscalYear} Period ${dto.periodNumber} already exists.`,
        );
      }
    }

    const period = await this.prisma.fiscalPeriod.create({
      data: {
        organizationId,
        name,
        fiscalYear: dto.fiscalYear,
        periodNumber: dto.periodNumber,
        startDate,
        endDate,
        status: FiscalPeriodStatus.OPEN,
      },
    });

    await this.eventBus.publish({
      eventName: 'ACCOUNTING_PERIOD_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'accounting_period.create',
      resource: 'fiscal_period',
      resourceId: period.id,
      details: {
        name: period.name,
        status: period.status,
        fiscalYear: period.fiscalYear,
        periodNumber: period.periodNumber,
      },
    });

    return period;
  }

  /**
   * List fiscal periods with pagination and filters.
   */
  async findAll(
    organizationId: string,
    query: FiscalPeriodQueryDto,
  ): Promise<{
    periods: FiscalPeriod[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.FiscalPeriodWhereInput = { organizationId };

    if (query.status) where.status = query.status;
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [total, periods] = await Promise.all([
      this.prisma.fiscalPeriod.count({ where }),
      this.prisma.fiscalPeriod.findMany({
        where,
        include: {
          _count: { select: { journalEntries: true } },
          closeRuns: {
            include: { checks: true },
            orderBy: { startedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { startDate: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      periods,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find single fiscal period by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<FiscalPeriodWithDetails> {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id, organizationId },
      include: {
        _count: { select: { journalEntries: true } },
        closeRuns: {
          include: { checks: true },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!period) {
      throw new NotFoundException(
        `Fiscal period with ID ${id} not found in this organization.`,
      );
    }

    return period;
  }

  /**
   * Transition fiscal period into CLOSING state (pre-close lock).
   */
  async startClose(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<FiscalPeriodWithDetails> {
    const period = await this.findOne(organizationId, id);

    if (period.status === FiscalPeriodStatus.CLOSED) {
      throw new BadRequestException('Fiscal period is already closed.');
    }

    const updated = await this.prisma.fiscalPeriod.update({
      where: { id },
      data: { status: FiscalPeriodStatus.CLOSING },
      include: {
        _count: { select: { journalEntries: true } },
        closeRuns: {
          include: { checks: true },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'ACCOUNTING_PERIOD_CLOSE_STARTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'accounting_period.start_close',
      resource: 'fiscal_period',
      resourceId: id,
      details: { name: updated.name },
    });

    return updated;
  }

  /**
   * Validate all deterministic close checks without closing the period.
   */
  async validateClose(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<PeriodCloseExecutionSummary> {
    const period = await this.findOne(organizationId, id);

    // Create close run record
    const closeRun = await this.prisma.periodCloseRun.create({
      data: {
        organizationId,
        fiscalPeriodId: id,
        initiatedByUserId: actorUserId,
        status: PeriodCloseRunStatus.RUNNING,
      },
    });

    const summary = await this.closeEngine.evaluateAllChecks(
      organizationId,
      period,
      closeRun.id,
    );

    // Update close run record
    await this.prisma.periodCloseRun.update({
      where: { id: closeRun.id },
      data: {
        status: summary.status,
        completedAt: new Date(),
        validationSummary: summary.summaryMessage,
        failureInformation: summary.canClose
          ? Prisma.DbNull
          : (summary.checks.filter(
              (c) => c.status === 'FAILED',
            ) as unknown as Prisma.InputJsonValue),
      },
    });

    await this.eventBus.publish({
      eventName: 'ACCOUNTING_PERIOD_CLOSE_VALIDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'accounting_period.validate_close',
      resource: 'fiscal_period',
      resourceId: id,
      details: {
        runId: closeRun.id,
        status: summary.status,
        canClose: summary.canClose,
      },
    });

    return summary;
  }

  /**
   * Close a fiscal period permanently with mandatory pre-close validation.
   * If any blocking check fails, the period remains OPEN and returns diagnostics.
   */
  async close(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<FiscalPeriodWithDetails> {
    const period = await this.findOne(organizationId, id);

    if (period.status === FiscalPeriodStatus.CLOSED) {
      throw new BadRequestException('Fiscal period is already closed.');
    }

    // 1. Run full close validation checks
    const validationSummary = await this.validateClose(
      organizationId,
      id,
      actorUserId,
    );

    if (!validationSummary.canClose) {
      // Revert period to OPEN if it was in CLOSING
      if (period.status === FiscalPeriodStatus.CLOSING) {
        await this.prisma.fiscalPeriod.update({
          where: { id },
          data: { status: FiscalPeriodStatus.OPEN },
        });
      }

      await this.eventBus.publish({
        eventName: 'ACCOUNTING_PERIOD_CLOSE_FAILED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'accounting_period.close_failed',
        resource: 'fiscal_period',
        resourceId: id,
        details: {
          runId: validationSummary.runId,
          failedChecks: validationSummary.checks.filter(
            (c) => c.status === 'FAILED',
          ),
        },
      });

      throw new BadRequestException(
        `Cannot close fiscal period '${period.name}': ${validationSummary.summaryMessage} Failed checks: ${validationSummary.checks
          .filter((c) => c.status === 'FAILED')
          .map((c) => c.checkType)
          .join(', ')}`,
      );
    }

    // 2. Perform atomic closure
    const updated = await this.prisma.fiscalPeriod.update({
      where: { id },
      data: {
        status: FiscalPeriodStatus.CLOSED,
        closedAt: new Date(),
        closedByUserId: actorUserId,
        closeRunId: validationSummary.runId,
      },
      include: {
        _count: { select: { journalEntries: true } },
        closeRuns: {
          include: { checks: true },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });

    // Mark close run as CLOSED
    await this.prisma.periodCloseRun.update({
      where: { id: validationSummary.runId },
      data: { status: PeriodCloseRunStatus.CLOSED },
    });

    await this.eventBus.publish({
      eventName: 'ACCOUNTING_PERIOD_CLOSED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'accounting_period.close',
      resource: 'fiscal_period',
      resourceId: id,
      details: { name: updated.name, closeRunId: validationSummary.runId },
    });

    return updated;
  }

  /**
   * Reopen a closed fiscal period with mandatory reason and audit trail.
   */
  async reopen(
    organizationId: string,
    id: string,
    dto: ReopenPeriodDto,
    actorUserId: string,
  ): Promise<FiscalPeriodWithDetails> {
    const period = await this.findOne(organizationId, id);

    if (period.status !== FiscalPeriodStatus.CLOSED) {
      throw new BadRequestException(
        `Cannot reopen fiscal period '${period.name}' because its status is ${period.status} (only CLOSED periods can be reopened).`,
      );
    }

    const reason = dto.reason.trim();
    if (!reason || reason.length < 5) {
      throw new BadRequestException(
        'A valid justification reason of at least 5 characters is required to reopen an accounting period.',
      );
    }

    const updated = await this.prisma.fiscalPeriod.update({
      where: { id },
      data: {
        status: FiscalPeriodStatus.OPEN,
        reopenedAt: new Date(),
        reopenedByUserId: actorUserId,
        reopenReason: reason,
      },
      include: {
        _count: { select: { journalEntries: true } },
        closeRuns: {
          include: { checks: true },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'ACCOUNTING_PERIOD_REOPENED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'accounting_period.reopen',
      resource: 'fiscal_period',
      resourceId: id,
      details: { name: updated.name, reason },
    });

    return updated;
  }

  /**
   * Get all close execution runs for a period.
   */
  async getCloseRuns(
    organizationId: string,
    periodId: string,
  ): Promise<PeriodCloseRun[]> {
    await this.findOne(organizationId, periodId);
    return this.prisma.periodCloseRun.findMany({
      where: { organizationId, fiscalPeriodId: periodId },
      include: { checks: true },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Get close checks for a specific close run.
   */
  async getCloseChecks(
    organizationId: string,
    runId: string,
  ): Promise<PeriodCloseCheck[]> {
    return this.prisma.periodCloseCheck.findMany({
      where: { organizationId, closeRunId: runId },
      orderBy: { evaluatedAt: 'asc' },
    });
  }
}
