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
  CreatePickTaskDto,
  AssignPickTaskDto,
  ExecutePickTaskDto,
  PickQueryDto,
} from './dto/create-pick.dto';
import {
  PickTask,
  PickTaskLine,
  PickTaskStatus,
  StockMovementType,
  Prisma,
} from '@prisma/client';

export type PickTaskWithDetails = PickTask & {
  warehouse: { id: string; code: string; name: string };
  salesOrder: { id: string; orderNumber: string } | null;
  deliveryOrder: { id: string; deliveryNumber: string } | null;
  stagingLocation: { id: string; code: string; name: string } | null;
  lines: Array<
    PickTaskLine & {
      item: { id: string; sku: string; name: string };
      variant: { id: string; sku: string } | null;
      sourceLocation: { id: string; code: string; name: string };
      batch: { id: string; batchNumber: string } | null;
      serial: { id: string; serialNumber: string } | null;
    }
  >;
};

@Injectable()
export class WarehousePickingService {
  private readonly logger = new Logger(WarehousePickingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly balancesService: BalancesService,
  ) {}

  /**
   * Create an outbound pick task.
   */
  async create(
    organizationId: string,
    dto: CreatePickTaskDto,
    actorUserId?: string,
  ): Promise<PickTaskWithDetails> {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('Pick task must contain at least one line');
    }

    const warehouse = await this.prisma.location.findFirst({
      where: { id: dto.warehouseId, organizationId },
    });

    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse with ID ${dto.warehouseId} not found`,
      );
    }

    let taskNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'PICK_TASK',
        actorUserId,
      );
      taskNumber = seq.formatted;
    } catch {
      const count = await this.prisma.pickTask.count({
        where: { organizationId },
      });
      taskNumber = `PK-${String(count + 1).padStart(6, '0')}`;
    }

    const task = await this.prisma.pickTask.create({
      data: {
        organizationId,
        taskNumber,
        warehouseId: dto.warehouseId,
        salesOrderId: dto.salesOrderId ?? null,
        deliveryOrderId: dto.deliveryOrderId ?? null,
        stagingLocationId: dto.stagingLocationId ?? null,
        priority: dto.priority ?? 1,
        status: dto.assignedUserId
          ? PickTaskStatus.ASSIGNED
          : PickTaskStatus.PENDING,
        assignedUserId: dto.assignedUserId ?? null,
        notes: dto.notes?.trim() ?? null,
        lines: {
          create: dto.lines.map((l) => ({
            organizationId,
            salesOrderLineId: l.salesOrderLineId ?? null,
            deliveryOrderLineId: l.deliveryOrderLineId ?? null,
            reservationId: l.reservationId ?? null,
            itemId: l.itemId,
            variantId: l.variantId ?? null,
            sourceLocationId: l.sourceLocationId,
            requestedQuantity: new Prisma.Decimal(l.requestedQuantity),
            pickedQuantity: new Prisma.Decimal(0),
            batchId: l.batchId ?? null,
            serialId: l.serialId ?? null,
            status: PickTaskStatus.PENDING,
          })),
        },
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        salesOrder: { select: { id: true, orderNumber: true } },
        deliveryOrder: { select: { id: true, deliveryNumber: true } },
        stagingLocation: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            sourceLocation: { select: { id: true, code: true, name: true } },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_PICK_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.pick_create',
      resource: 'pick_task',
      resourceId: task.id,
      details: { taskNumber: task.taskNumber, lineCount: dto.lines.length },
    });

    return task;
  }

  /**
   * List pick tasks.
   */
  async findAll(
    organizationId: string,
    query: PickQueryDto,
  ): Promise<{
    data: PickTaskWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.PickTaskWhereInput = { organizationId };

    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.salesOrderId) where.salesOrderId = query.salesOrderId;
    if (query.deliveryOrderId) where.deliveryOrderId = query.deliveryOrderId;
    if (query.waveId) where.waveId = query.waveId;
    if (query.status) where.status = query.status as PickTaskStatus;
    if (query.assignedUserId) where.assignedUserId = query.assignedUserId;

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { taskNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.pickTask.findMany({
        where,
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          salesOrder: { select: { id: true, orderNumber: true } },
          deliveryOrder: { select: { id: true, deliveryNumber: true } },
          stagingLocation: { select: { id: true, code: true, name: true } },
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true } },
              variant: { select: { id: true, sku: true } },
              sourceLocation: { select: { id: true, code: true, name: true } },
              batch: { select: { id: true, batchNumber: true } },
              serial: { select: { id: true, serialNumber: true } },
            },
          },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.pickTask.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Find single pick task by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<PickTaskWithDetails> {
    const task = await this.prisma.pickTask.findFirst({
      where: { id, organizationId },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        salesOrder: { select: { id: true, orderNumber: true } },
        deliveryOrder: { select: { id: true, deliveryNumber: true } },
        stagingLocation: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            sourceLocation: { select: { id: true, code: true, name: true } },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Pick task with ID ${id} not found`);
    }

    return task;
  }

  /**
   * Assign worker to pick task.
   */
  async assign(
    organizationId: string,
    id: string,
    dto: AssignPickTaskDto,
    actorUserId?: string,
  ): Promise<PickTaskWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === PickTaskStatus.PICKED ||
      existing.status === PickTaskStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot assign pick task in ${existing.status} status`,
      );
    }

    const updated = await this.prisma.pickTask.update({
      where: { id },
      data: {
        assignedUserId: dto.assignedUserId,
        status:
          existing.status === PickTaskStatus.PENDING
            ? PickTaskStatus.ASSIGNED
            : existing.status,
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        salesOrder: { select: { id: true, orderNumber: true } },
        deliveryOrder: { select: { id: true, deliveryNumber: true } },
        stagingLocation: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            sourceLocation: { select: { id: true, code: true, name: true } },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_PICK_ASSIGNED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.pick_assign',
      resource: 'pick_task',
      resourceId: updated.id,
      details: {
        taskNumber: updated.taskNumber,
        assignedUserId: dto.assignedUserId,
      },
    });

    return updated;
  }

  /**
   * Start pick task.
   */
  async start(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<PickTaskWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === PickTaskStatus.PICKED ||
      existing.status === PickTaskStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot start pick task in ${existing.status} status`,
      );
    }

    const updated = await this.prisma.pickTask.update({
      where: { id },
      data: {
        status: PickTaskStatus.IN_PROGRESS,
        startedAt: existing.startedAt || new Date(),
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        salesOrder: { select: { id: true, orderNumber: true } },
        deliveryOrder: { select: { id: true, deliveryNumber: true } },
        stagingLocation: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            sourceLocation: { select: { id: true, code: true, name: true } },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_PICK_STARTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.pick_start',
      resource: 'pick_task',
      resourceId: updated.id,
      details: { taskNumber: updated.taskNumber },
    });

    return updated;
  }

  /**
   * Execute pick lines and stage picked stock into staging location.
   */
  async executePick(
    organizationId: string,
    id: string,
    dto: ExecutePickTaskDto,
    actorUserId?: string,
  ): Promise<PickTaskWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.pickTask.findFirst({
        where: { id, organizationId },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          salesOrder: { select: { id: true, orderNumber: true } },
          deliveryOrder: { select: { id: true, deliveryNumber: true } },
          stagingLocation: { select: { id: true, code: true, name: true } },
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true } },
              variant: { select: { id: true, sku: true } },
              sourceLocation: { select: { id: true, code: true, name: true } },
              batch: { select: { id: true, batchNumber: true } },
              serial: { select: { id: true, serialNumber: true } },
            },
          },
        },
      });

      if (!task) {
        throw new NotFoundException(`Pick task with ID ${id} not found`);
      }

      if (task.status === PickTaskStatus.PICKED) {
        return task; // Idempotent
      }

      if (task.status === PickTaskStatus.CANCELLED) {
        throw new BadRequestException('Cannot execute a cancelled pick task');
      }

      // Determine staging location
      let stagingLocId = dto.stagingLocationId || task.stagingLocationId;
      if (!stagingLocId) {
        // Look up default staging location
        const config = await tx.warehouseConfiguration.findUnique({
          where: { organizationId },
        });
        stagingLocId = config?.defaultStagingLocationId ?? null;
      }

      for (const inputLine of dto.lines) {
        const line = task.lines.find((l) => l.id === inputLine.lineId);
        if (!line) {
          throw new BadRequestException(
            `Pick line with ID ${inputLine.lineId} not found on task`,
          );
        }

        const qtyToPick = new Prisma.Decimal(inputLine.pickedQuantity);
        if (qtyToPick.lte(0)) {
          throw new BadRequestException(
            'Picked quantity must be strictly positive',
          );
        }

        const remainingUnpicked = line.requestedQuantity.minus(
          line.pickedQuantity,
        );
        if (qtyToPick.gt(remainingUnpicked)) {
          throw new BadRequestException(
            `Picked quantity ${qtyToPick.toString()} exceeds remaining unpicked quantity ${remainingUnpicked.toString()} for item ${line.item.sku}`,
          );
        }

        // If staging location is configured, move stock from source to staging
        if (stagingLocId && stagingLocId !== line.sourceLocationId) {
          await this.balancesService.applyStockMovement(
            organizationId,
            {
              itemId: line.itemId,
              variantId: line.variantId ?? undefined,
              locationId: line.sourceLocationId,
              movementType: StockMovementType.TRANSFER_OUT,
              quantity: qtyToPick.toNumber(),
              batchId: inputLine.batchId ?? line.batchId ?? undefined,
              serialId: inputLine.serialId ?? line.serialId ?? undefined,
              reason: `Pick task ${task.taskNumber}`,
              referenceType: 'PICK_TASK',
              referenceId: task.taskNumber,
            },
            actorUserId,
          );

          await this.balancesService.applyStockMovement(
            organizationId,
            {
              itemId: line.itemId,
              variantId: line.variantId ?? undefined,
              locationId: stagingLocId,
              movementType: StockMovementType.TRANSFER_IN,
              quantity: qtyToPick.toNumber(),
              batchId: inputLine.batchId ?? line.batchId ?? undefined,
              serialId: inputLine.serialId ?? line.serialId ?? undefined,
              reason: `Pick task ${task.taskNumber}`,
              referenceType: 'PICK_TASK',
              referenceId: task.taskNumber,
            },
            actorUserId,
          );
        }

        const newPickedQty = line.pickedQuantity.plus(qtyToPick);
        const newLineStatus = newPickedQty.gte(line.requestedQuantity)
          ? PickTaskStatus.PICKED
          : PickTaskStatus.PARTIALLY_PICKED;

        await tx.pickTaskLine.update({
          where: { id: line.id },
          data: {
            pickedQuantity: newPickedQty,
            status: newLineStatus,
            batchId: inputLine.batchId ?? line.batchId,
            serialId: inputLine.serialId ?? line.serialId,
          },
        });
      }

      // Re-query lines to check if all are fully picked
      const updatedLines = await tx.pickTaskLine.findMany({
        where: { pickTaskId: id },
      });

      const allPicked = updatedLines.every((l) =>
        l.pickedQuantity.gte(l.requestedQuantity),
      );
      const anyPicked = updatedLines.some((l) => l.pickedQuantity.gt(0));

      const nextTaskStatus = allPicked
        ? PickTaskStatus.PICKED
        : anyPicked
          ? PickTaskStatus.PARTIALLY_PICKED
          : PickTaskStatus.IN_PROGRESS;

      await tx.pickTask.update({
        where: { id },
        data: {
          status: nextTaskStatus,
          stagingLocationId: stagingLocId,
          completedByUserId: allPicked ? (actorUserId ?? null) : null,
          completedAt: allPicked ? new Date() : null,
        },
      });

      await this.eventBus.publish({
        eventName: 'WAREHOUSE_PICK_EXECUTED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: actorUserId ?? null,
        action: 'warehouse.pick_execute',
        resource: 'pick_task',
        resourceId: id,
        details: {
          taskNumber: task.taskNumber,
          status: nextTaskStatus,
        },
      });

      return this.findOne(organizationId, id);
    });
  }

  /**
   * Cancel pick task.
   */
  async cancel(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<PickTaskWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status === PickTaskStatus.PICKED) {
      throw new BadRequestException('Cannot cancel a completed pick task');
    }

    const updated = await this.prisma.pickTask.update({
      where: { id },
      data: {
        status: PickTaskStatus.CANCELLED,
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        salesOrder: { select: { id: true, orderNumber: true } },
        deliveryOrder: { select: { id: true, deliveryNumber: true } },
        stagingLocation: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            sourceLocation: { select: { id: true, code: true, name: true } },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_PICK_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.pick_cancel',
      resource: 'pick_task',
      resourceId: updated.id,
      details: { taskNumber: updated.taskNumber },
    });

    return updated;
  }
}
