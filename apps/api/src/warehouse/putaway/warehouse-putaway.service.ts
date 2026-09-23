import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BalancesService } from '../../inventory/balances/balances.service';
import {
  CreatePutawayTaskDto,
  AssignPutawayTaskDto,
  CompletePutawayTaskDto,
  PutawayQueryDto,
} from './dto/create-putaway.dto';
import {
  PutawayTask,
  PutawayTaskLine,
  WarehouseTaskStatus,
  StockMovementType,
  Prisma,
} from '@prisma/client';

export type PutawayTaskWithDetails = PutawayTask & {
  warehouse: { id: string; code: string; name: string };
  sourceLocation: { id: string; code: string; name: string };
  targetLocation: { id: string; code: string; name: string } | null;
  lines: Array<
    PutawayTaskLine & {
      item: { id: string; sku: string; name: string };
      variant: { id: string; sku: string } | null;
      batch: { id: string; batchNumber: string } | null;
      serial: { id: string; serialNumber: string } | null;
    }
  >;
};

@Injectable()
export class WarehousePutawayService {
  private readonly logger = new Logger(WarehousePutawayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly balancesService: BalancesService,
  ) {}

  /**
   * Create an inbound putaway task.
   */
  async create(
    organizationId: string,
    dto: CreatePutawayTaskDto,
    actorUserId?: string,
  ): Promise<PutawayTaskWithDetails> {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException(
        'Putaway task must contain at least one line',
      );
    }

    const [warehouse, sourceLocation] = await Promise.all([
      this.prisma.location.findFirst({
        where: { id: dto.warehouseId, organizationId },
      }),
      this.prisma.location.findFirst({
        where: { id: dto.sourceLocationId, organizationId },
      }),
    ]);

    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse with ID ${dto.warehouseId} not found`,
      );
    }
    if (!sourceLocation) {
      throw new NotFoundException(
        `Source location with ID ${dto.sourceLocationId} not found`,
      );
    }

    let taskNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'PUTAWAY_TASK',
        actorUserId,
      );
      taskNumber = seq.formatted;
    } catch {
      const count = await this.prisma.putawayTask.count({
        where: { organizationId },
      });
      taskNumber = `PT-${String(count + 1).padStart(6, '0')}`;
    }

    const task = await this.prisma.putawayTask.create({
      data: {
        organizationId,
        taskNumber,
        warehouseId: dto.warehouseId,
        sourceLocationId: dto.sourceLocationId,
        targetLocationId: dto.targetLocationId ?? null,
        sourceDocumentType: dto.sourceDocumentType ?? null,
        sourceDocumentId: dto.sourceDocumentId ?? null,
        priority: dto.priority ?? 1,
        status: dto.assignedUserId
          ? WarehouseTaskStatus.ASSIGNED
          : WarehouseTaskStatus.PENDING,
        assignedUserId: dto.assignedUserId ?? null,
        notes: dto.notes?.trim() ?? null,
        lines: {
          create: dto.lines.map((l) => ({
            organizationId,
            itemId: l.itemId,
            variantId: l.variantId ?? null,
            batchId: l.batchId ?? null,
            serialId: l.serialId ?? null,
            suggestedLocationId: l.suggestedLocationId ?? null,
            quantity: new Prisma.Decimal(l.quantity),
            status: WarehouseTaskStatus.PENDING,
          })),
        },
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        sourceLocation: { select: { id: true, code: true, name: true } },
        targetLocation: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_PUTAWAY_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.putaway_create',
      resource: 'putaway_task',
      resourceId: task.id,
      details: { taskNumber: task.taskNumber, lineCount: dto.lines.length },
    });

    return task;
  }

  /**
   * List putaway tasks.
   */
  async findAll(
    organizationId: string,
    query: PutawayQueryDto,
  ): Promise<{
    data: PutawayTaskWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.PutawayTaskWhereInput = { organizationId };

    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.status) where.status = query.status as WarehouseTaskStatus;
    if (query.assignedUserId) where.assignedUserId = query.assignedUserId;

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { taskNumber: { contains: search, mode: 'insensitive' } },
        { sourceDocumentId: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.putawayTask.findMany({
        where,
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          sourceLocation: { select: { id: true, code: true, name: true } },
          targetLocation: { select: { id: true, code: true, name: true } },
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true } },
              variant: { select: { id: true, sku: true } },
              batch: { select: { id: true, batchNumber: true } },
              serial: { select: { id: true, serialNumber: true } },
            },
          },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.putawayTask.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Find single putaway task by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<PutawayTaskWithDetails> {
    const task = await this.prisma.putawayTask.findFirst({
      where: { id, organizationId },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        sourceLocation: { select: { id: true, code: true, name: true } },
        targetLocation: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Putaway task with ID ${id} not found`);
    }

    return task;
  }

  /**
   * Assign worker to putaway task.
   */
  async assign(
    organizationId: string,
    id: string,
    dto: AssignPutawayTaskDto,
    actorUserId?: string,
  ): Promise<PutawayTaskWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === WarehouseTaskStatus.COMPLETED ||
      existing.status === WarehouseTaskStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot assign putaway task in ${existing.status} status`,
      );
    }

    const updated = await this.prisma.putawayTask.update({
      where: { id },
      data: {
        assignedUserId: dto.assignedUserId,
        status:
          existing.status === WarehouseTaskStatus.PENDING
            ? WarehouseTaskStatus.ASSIGNED
            : existing.status,
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        sourceLocation: { select: { id: true, code: true, name: true } },
        targetLocation: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_PUTAWAY_ASSIGNED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.putaway_assign',
      resource: 'putaway_task',
      resourceId: updated.id,
      details: {
        taskNumber: updated.taskNumber,
        assignedUserId: dto.assignedUserId,
      },
    });

    return updated;
  }

  /**
   * Start putaway task.
   */
  async start(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<PutawayTaskWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === WarehouseTaskStatus.COMPLETED ||
      existing.status === WarehouseTaskStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot start putaway task in ${existing.status} status`,
      );
    }

    const updated = await this.prisma.putawayTask.update({
      where: { id },
      data: {
        status: WarehouseTaskStatus.IN_PROGRESS,
        startedAt: existing.startedAt || new Date(),
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        sourceLocation: { select: { id: true, code: true, name: true } },
        targetLocation: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_PUTAWAY_STARTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.putaway_start',
      resource: 'putaway_task',
      resourceId: updated.id,
      details: { taskNumber: updated.taskNumber },
    });

    return updated;
  }

  /**
   * Complete putaway task, transferring items to target storage locations.
   */
  async complete(
    organizationId: string,
    id: string,
    dto: CompletePutawayTaskDto = {},
    actorUserId?: string,
  ): Promise<PutawayTaskWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.putawayTask.findFirst({
        where: { id, organizationId },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          sourceLocation: { select: { id: true, code: true, name: true } },
          targetLocation: { select: { id: true, code: true, name: true } },
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true } },
              variant: { select: { id: true, sku: true } },
              batch: { select: { id: true, batchNumber: true } },
              serial: { select: { id: true, serialNumber: true } },
            },
          },
        },
      });

      if (!task) {
        throw new NotFoundException(`Putaway task with ID ${id} not found`);
      }

      if (task.status === WarehouseTaskStatus.COMPLETED) {
        return task; // Idempotent completion
      }

      if (task.status === WarehouseTaskStatus.CANCELLED) {
        throw new BadRequestException(
          'Cannot complete a cancelled putaway task',
        );
      }

      const lineOverrides = new Map<string, string>();
      if (dto.lines) {
        for (const ol of dto.lines) {
          lineOverrides.set(ol.lineId, ol.actualLocationId);
        }
      }

      for (const line of task.lines) {
        const actualLocId =
          lineOverrides.get(line.id) ||
          line.actualLocationId ||
          dto.targetLocationId ||
          task.targetLocationId ||
          line.suggestedLocationId;

        if (!actualLocId) {
          throw new BadRequestException(
            `Target storage location must be specified for putaway line ${line.id} (item: ${line.item.sku})`,
          );
        }

        if (actualLocId === task.sourceLocationId) {
          throw new BadRequestException(
            `Putaway destination location cannot be identical to source receiving location (${task.sourceLocation.code})`,
          );
        }

        // Execute inventory movements via BalancesService
        await this.balancesService.applyStockMovement(
          organizationId,
          {
            itemId: line.itemId,
            variantId: line.variantId ?? undefined,
            locationId: task.sourceLocationId,
            movementType: StockMovementType.TRANSFER_OUT,
            quantity: line.quantity.toNumber(),
            batchId: line.batchId ?? undefined,
            serialId: line.serialId ?? undefined,
            reason: `Putaway task ${task.taskNumber}`,
            referenceType: 'PUTAWAY_TASK',
            referenceId: task.taskNumber,
          },
          actorUserId,
        );

        await this.balancesService.applyStockMovement(
          organizationId,
          {
            itemId: line.itemId,
            variantId: line.variantId ?? undefined,
            locationId: actualLocId,
            movementType: StockMovementType.TRANSFER_IN,
            quantity: line.quantity.toNumber(),
            batchId: line.batchId ?? undefined,
            serialId: line.serialId ?? undefined,
            reason: `Putaway task ${task.taskNumber}`,
            referenceType: 'PUTAWAY_TASK',
            referenceId: task.taskNumber,
          },
          actorUserId,
        );

        await tx.putawayTaskLine.update({
          where: { id: line.id },
          data: {
            actualLocationId: actualLocId,
            status: WarehouseTaskStatus.COMPLETED,
          },
        });
      }

      await tx.putawayTask.update({
        where: { id },
        data: {
          status: WarehouseTaskStatus.COMPLETED,
          completedByUserId: actorUserId ?? null,
          completedAt: new Date(),
        },
      });

      await this.eventBus.publish({
        eventName: 'WAREHOUSE_PUTAWAY_COMPLETED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: actorUserId ?? null,
        action: 'warehouse.putaway_complete',
        resource: 'putaway_task',
        resourceId: id,
        details: { taskNumber: task.taskNumber },
      });

      return this.findOne(organizationId, id);
    });
  }

  /**
   * Cancel putaway task.
   */
  async cancel(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<PutawayTaskWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status === WarehouseTaskStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed putaway task');
    }

    const updated = await this.prisma.putawayTask.update({
      where: { id },
      data: {
        status: WarehouseTaskStatus.CANCELLED,
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        sourceLocation: { select: { id: true, code: true, name: true } },
        targetLocation: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_PUTAWAY_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.putaway_cancel',
      resource: 'putaway_task',
      resourceId: updated.id,
      details: { taskNumber: updated.taskNumber },
    });

    return updated;
  }
}
