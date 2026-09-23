import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { MrpEngineService } from './mrp-engine.service';
import { CreatePlanningRunDto } from './dto/create-planning-run.dto';
import { PlanningRunQueryDto } from './dto/planning-query.dto';
import { PlanningRunStatus, Prisma } from '@prisma/client';

@Injectable()
export class PlanningRunsService {
  private readonly logger = new Logger(PlanningRunsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly mrpEngine: MrpEngineService,
  ) {}

  /**
   * Create a new draft planning run.
   */
  async create(
    organizationId: string,
    dto: CreatePlanningRunDto,
    userId: string,
  ) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException(
        'Planning horizon start date cannot be after end date.',
      );
    }

    if (dto.locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: dto.locationId, organizationId },
      });
      if (!location) {
        throw new NotFoundException(
          `Location with ID ${dto.locationId} not found in organization.`,
        );
      }
    }

    if (dto.itemId) {
      const item = await this.prisma.item.findFirst({
        where: { id: dto.itemId, organizationId },
      });
      if (!item) {
        throw new NotFoundException(
          `Item with ID ${dto.itemId} not found in organization.`,
        );
      }
    }

    let runNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'MRP_RUN',
        userId,
      );
      runNumber = seq.formatted;
    } catch {
      const count = await this.prisma.planningRun.count({
        where: { organizationId },
      });
      runNumber = `MRP-${String(count + 1).padStart(6, '0')}`;
    }

    const run = await this.prisma.planningRun.create({
      data: {
        organizationId,
        runNumber,
        name: dto.name,
        startDate,
        endDate,
        locationId: dto.locationId,
        itemId: dto.itemId,
        status: PlanningRunStatus.DRAFT,
        includeSalesOrders: dto.includeSalesOrders ?? true,
        includeProductionOrders: dto.includeProductionOrders ?? true,
        includeSafetyStock: dto.includeSafetyStock ?? true,
        createdByUserId: userId,
      },
      include: { location: true, item: true },
    });

    await this.eventBus.publish({
      eventName: 'MRP_RUN_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'planning.run.create',
      resource: 'planning_run',
      resourceId: run.id,
      details: {
        runNumber: run.runNumber,
        name: run.name,
      },
    });

    return run;
  }

  /**
   * Find planning runs with filtering.
   */
  async findAll(organizationId: string, query: PlanningRunQueryDto) {
    const where: Prisma.PlanningRunWhereInput = { organizationId };

    if (query.status) where.status = query.status;
    if (query.locationId) where.locationId = query.locationId;
    if (query.itemId) where.itemId = query.itemId;

    if (query.startDate || query.endDate) {
      where.startDate = {};
      if (query.startDate) where.startDate.gte = new Date(query.startDate);
      if (query.endDate) where.startDate.lte = new Date(query.endDate);
    }

    if (query.search) {
      where.OR = [
        { runNumber: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.planningRun.findMany({
      where,
      include: { location: true, item: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find single planning run by ID.
   */
  async findOne(organizationId: string, id: string) {
    const run = await this.prisma.planningRun.findFirst({
      where: { id, organizationId },
      include: {
        location: true,
        item: true,
        demands: { include: { item: true } },
        supplies: { include: { item: true } },
        results: { include: { item: true } },
        plannedOrders: { include: { item: true, supplier: true, bom: true } },
      },
    });

    if (!run) {
      throw new NotFoundException(`Planning run with ID ${id} not found.`);
    }

    return run;
  }

  /**
   * Execute an MRP planning run.
   * Concurrency-safe state transition DRAFT -> RUNNING -> COMPLETED.
   */
  async execute(organizationId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.planningRun.findFirst({
        where: { id, organizationId },
      });

      if (!run) {
        throw new NotFoundException(`Planning run with ID ${id} not found.`);
      }

      if (run.status !== PlanningRunStatus.DRAFT) {
        throw new BadRequestException(
          `Cannot execute planning run in status ${run.status}. Must be in DRAFT status.`,
        );
      }

      // Mark as RUNNING
      await tx.planningRun.update({
        where: { id },
        data: {
          status: PlanningRunStatus.RUNNING,
          executionStartedAt: new Date(),
        },
      });

      await this.eventBus.publish({
        eventName: 'MRP_RUN_STARTED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'planning.run.start',
        resource: 'planning_run',
        resourceId: run.id,
        details: { runNumber: run.runNumber },
      });

      try {
        // Execute MRP engine calculations
        const output = await this.mrpEngine.executeCalculation(
          {
            planningRunId: run.id,
            organizationId,
            startDate: run.startDate,
            endDate: run.endDate,
            locationId: run.locationId,
            itemId: run.itemId,
            includeSalesOrders: run.includeSalesOrders,
            includeProductionOrders: run.includeProductionOrders,
            includeSafetyStock: run.includeSafetyStock,
            userId,
          },
          tx,
        );

        // Bulk insert snapshots and results
        if (output.demandSnapshots.length > 0) {
          await tx.planningDemand.createMany({ data: output.demandSnapshots });
        }

        if (output.supplySnapshots.length > 0) {
          await tx.planningSupply.createMany({ data: output.supplySnapshots });
        }

        if (output.planningResults.length > 0) {
          await tx.planningResult.createMany({ data: output.planningResults });
        }

        if (output.plannedOrders.length > 0) {
          await tx.plannedOrder.createMany({ data: output.plannedOrders });
        }

        // Finalize planning run header
        const completedRun = await tx.planningRun.update({
          where: { id },
          data: {
            status: PlanningRunStatus.COMPLETED,
            totalDemandCount: output.demandSnapshots.length,
            totalSupplyCount: output.supplySnapshots.length,
            totalResultCount: output.planningResults.length,
            totalShortageCount: output.totalShortages,
            totalPlannedOrderCount: output.plannedOrders.length,
            executionCompletedAt: new Date(),
          },
          include: {
            results: { include: { item: true } },
            plannedOrders: {
              include: { item: true, supplier: true, bom: true },
            },
          },
        });

        await this.eventBus.publish({
          eventName: 'MRP_RUN_COMPLETED',
          occurredAt: new Date(),
          organizationId,
          actorUserId: userId,
          action: 'planning.run.complete',
          resource: 'planning_run',
          resourceId: completedRun.id,
          details: {
            runNumber: completedRun.runNumber,
            totalResults: completedRun.totalResultCount,
            totalPlannedOrders: completedRun.totalPlannedOrderCount,
          },
        });

        if (output.totalShortages > 0) {
          await this.eventBus.publish({
            eventName: 'MRP_SHORTAGE_DETECTED',
            occurredAt: new Date(),
            organizationId,
            actorUserId: userId,
            action: 'planning.shortage.detected',
            resource: 'planning_run',
            resourceId: completedRun.id,
            details: {
              runNumber: completedRun.runNumber,
              shortageCount: output.totalShortages,
            },
          });
        }

        return completedRun;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        this.logger.error(`Planning run ${id} failed: ${message}`, stack);

        await tx.planningRun.update({
          where: { id },
          data: {
            status: PlanningRunStatus.FAILED,
            errorMessage: message,
            executionCompletedAt: new Date(),
          },
        });

        await this.eventBus.publish({
          eventName: 'MRP_RUN_FAILED',
          occurredAt: new Date(),
          organizationId,
          actorUserId: userId,
          action: 'planning.run.failed',
          resource: 'planning_run',
          resourceId: id,
          details: { errorMessage: message },
        });

        throw err;
      }
    });
  }

  /**
   * Cancel draft or running planning run.
   */
  async cancel(organizationId: string, id: string, userId: string) {
    const run = await this.findOne(organizationId, id);

    if (
      run.status !== PlanningRunStatus.DRAFT &&
      run.status !== PlanningRunStatus.FAILED
    ) {
      throw new BadRequestException(
        `Cannot cancel planning run in status ${run.status}.`,
      );
    }

    const updated = await this.prisma.planningRun.update({
      where: { id },
      data: { status: PlanningRunStatus.CANCELLED },
    });

    await this.eventBus.publish({
      eventName: 'MRP_RUN_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'planning.run.cancel',
      resource: 'planning_run',
      resourceId: updated.id,
      details: { runNumber: updated.runNumber },
    });

    return updated;
  }
}
