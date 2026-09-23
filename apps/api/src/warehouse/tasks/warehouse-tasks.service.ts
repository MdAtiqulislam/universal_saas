import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import {
  CreateWarehouseTaskDto,
  AssignWarehouseTaskDto,
  WarehouseTaskQueryDto,
} from './dto/create-task.dto';
import { WarehouseTask, WarehouseTaskStatus, Prisma } from '@prisma/client';

export type WarehouseTaskWithWarehouse = WarehouseTask & {
  warehouse: { id: string; code: string; name: string };
};

@Injectable()
export class WarehouseTasksService {
  private readonly logger = new Logger(WarehouseTasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * Create an operational warehouse task.
   */
  async create(
    organizationId: string,
    dto: CreateWarehouseTaskDto,
    actorUserId?: string,
  ): Promise<WarehouseTaskWithWarehouse> {
    const warehouse = await this.prisma.location.findFirst({
      where: { id: dto.warehouseId, organizationId },
    });

    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse location with ID ${dto.warehouseId} not found`,
      );
    }

    let taskNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'WAREHOUSE_TASK',
        actorUserId,
      );
      taskNumber = seq.formatted;
    } catch {
      const count = await this.prisma.warehouseTask.count({
        where: { organizationId },
      });
      taskNumber = `WT-${String(count + 1).padStart(6, '0')}`;
    }

    const task = await this.prisma.warehouseTask.create({
      data: {
        organizationId,
        taskNumber,
        taskType: dto.taskType,
        priority: dto.priority ?? 1,
        status: dto.assignedUserId
          ? WarehouseTaskStatus.ASSIGNED
          : WarehouseTaskStatus.PENDING,
        warehouseId: dto.warehouseId,
        sourceLocationId: dto.sourceLocationId ?? null,
        targetLocationId: dto.targetLocationId ?? null,
        assignedUserId: dto.assignedUserId ?? null,
        sourceDocumentType: dto.sourceDocumentType ?? null,
        sourceDocumentId: dto.sourceDocumentId ?? null,
        notes: dto.notes?.trim() ?? null,
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_TASK_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse_task.create',
      resource: 'warehouse_task',
      resourceId: task.id,
      details: {
        taskNumber: task.taskNumber,
        taskType: task.taskType,
        warehouseId: task.warehouseId,
      },
    });

    return task;
  }

  /**
   * List warehouse tasks with pagination and filters.
   */
  async findAll(
    organizationId: string,
    query: WarehouseTaskQueryDto,
  ): Promise<{
    data: WarehouseTaskWithWarehouse[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.WarehouseTaskWhereInput = { organizationId };

    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.taskType) where.taskType = query.taskType;
    if (query.status) where.status = query.status as WarehouseTaskStatus;
    if (query.assignedUserId) where.assignedUserId = query.assignedUserId;

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { taskNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { sourceDocumentId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.warehouseTask.findMany({
        where,
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.warehouseTask.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Find single warehouse task by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<WarehouseTaskWithWarehouse> {
    const task = await this.prisma.warehouseTask.findFirst({
      where: { id, organizationId },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
      },
    });

    if (!task) {
      throw new NotFoundException(`Warehouse task with ID ${id} not found`);
    }

    return task;
  }

  /**
   * Assign worker to task.
   */
  async assign(
    organizationId: string,
    id: string,
    dto: AssignWarehouseTaskDto,
    actorUserId?: string,
  ): Promise<WarehouseTaskWithWarehouse> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === WarehouseTaskStatus.COMPLETED ||
      existing.status === WarehouseTaskStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot assign task in terminal status ${existing.status}`,
      );
    }

    const updated = await this.prisma.warehouseTask.update({
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
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_TASK_ASSIGNED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse_task.assign',
      resource: 'warehouse_task',
      resourceId: updated.id,
      details: {
        taskNumber: updated.taskNumber,
        assignedUserId: dto.assignedUserId,
      },
    });

    return updated;
  }

  /**
   * Start warehouse task.
   */
  async start(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<WarehouseTaskWithWarehouse> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === WarehouseTaskStatus.COMPLETED ||
      existing.status === WarehouseTaskStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot start task in ${existing.status} status`,
      );
    }

    const updated = await this.prisma.warehouseTask.update({
      where: { id },
      data: {
        status: WarehouseTaskStatus.IN_PROGRESS,
        startedAt: existing.startedAt || new Date(),
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_TASK_STARTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse_task.start',
      resource: 'warehouse_task',
      resourceId: updated.id,
      details: { taskNumber: updated.taskNumber },
    });

    return updated;
  }

  /**
   * Complete warehouse task.
   */
  async complete(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<WarehouseTaskWithWarehouse> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status === WarehouseTaskStatus.COMPLETED) {
      return existing; // idempotent
    }

    if (existing.status === WarehouseTaskStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot complete a cancelled warehouse task',
      );
    }

    const updated = await this.prisma.warehouseTask.update({
      where: { id },
      data: {
        status: WarehouseTaskStatus.COMPLETED,
        completedByUserId: actorUserId ?? null,
        completedAt: new Date(),
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_TASK_COMPLETED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse_task.complete',
      resource: 'warehouse_task',
      resourceId: updated.id,
      details: { taskNumber: updated.taskNumber },
    });

    return updated;
  }

  /**
   * Cancel warehouse task.
   */
  async cancel(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<WarehouseTaskWithWarehouse> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status === WarehouseTaskStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed warehouse task');
    }

    const updated = await this.prisma.warehouseTask.update({
      where: { id },
      data: {
        status: WarehouseTaskStatus.CANCELLED,
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_TASK_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse_task.cancel',
      resource: 'warehouse_task',
      resourceId: updated.id,
      details: { taskNumber: updated.taskNumber },
    });

    return updated;
  }
}
