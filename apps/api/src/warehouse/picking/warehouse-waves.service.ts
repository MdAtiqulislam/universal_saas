import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { CreatePickWaveDto, WaveQueryDto } from './dto/create-wave.dto';
import {
  PickWave,
  PickWaveStatus,
  PickTaskStatus,
  Prisma,
} from '@prisma/client';

export type PickWaveWithDetails = PickWave & {
  warehouse: { id: string; code: string; name: string };
  pickTasks: Array<{
    id: string;
    taskNumber: string;
    status: PickTaskStatus;
    priority: number;
  }>;
};

@Injectable()
export class WarehouseWavesService {
  private readonly logger = new Logger(WarehouseWavesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * Create a pick wave grouping multiple pick tasks.
   */
  async create(
    organizationId: string,
    dto: CreatePickWaveDto,
    actorUserId?: string,
  ): Promise<PickWaveWithDetails> {
    const warehouse = await this.prisma.location.findFirst({
      where: { id: dto.warehouseId, organizationId },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse ID ${dto.warehouseId} not found`);
    }

    let waveNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'PICK_WAVE',
        actorUserId,
      );
      waveNumber = seq.formatted;
    } catch {
      const count = await this.prisma.pickWave.count({
        where: { organizationId },
      });
      waveNumber = `WV-${String(count + 1).padStart(6, '0')}`;
    }

    const wave = await this.prisma.pickWave.create({
      data: {
        organizationId,
        waveNumber,
        warehouseId: dto.warehouseId,
        description: dto.description?.trim() ?? null,
        status: PickWaveStatus.DRAFT,
      },
    });

    if (dto.pickTaskIds && dto.pickTaskIds.length > 0) {
      for (const taskId of dto.pickTaskIds) {
        await this.prisma.pickWaveLine.create({
          data: {
            organizationId,
            waveId: wave.id,
            pickTaskId: taskId,
          },
        });

        await this.prisma.pickTask.update({
          where: { id: taskId },
          data: { waveId: wave.id },
        });
      }
    }

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_WAVE_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.wave_create',
      resource: 'pick_wave',
      resourceId: wave.id,
      details: { waveNumber: wave.waveNumber },
    });

    return this.findOne(organizationId, wave.id);
  }

  /**
   * List pick waves.
   */
  async findAll(
    organizationId: string,
    query: WaveQueryDto,
  ): Promise<{
    data: PickWaveWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.PickWaveWhereInput = { organizationId };

    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.status) where.status = query.status as PickWaveStatus;

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { waveNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.pickWave.findMany({
        where,
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          pickTasks: {
            select: {
              id: true,
              taskNumber: true,
              status: true,
              priority: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.pickWave.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Find single pick wave by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<PickWaveWithDetails> {
    const wave = await this.prisma.pickWave.findFirst({
      where: { id, organizationId },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        pickTasks: {
          select: {
            id: true,
            taskNumber: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    if (!wave) {
      throw new NotFoundException(`Pick wave with ID ${id} not found`);
    }

    return wave;
  }

  /**
   * Release pick wave for execution.
   */
  async release(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<PickWaveWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== PickWaveStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT pick waves can be released (current status: ${existing.status})`,
      );
    }

    const updated = await this.prisma.pickWave.update({
      where: { id },
      data: {
        status: PickWaveStatus.RELEASED,
        releasedAt: new Date(),
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        pickTasks: {
          select: {
            id: true,
            taskNumber: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_WAVE_RELEASED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.wave_release',
      resource: 'pick_wave',
      resourceId: updated.id,
      details: { waveNumber: updated.waveNumber },
    });

    return updated;
  }

  /**
   * Complete pick wave.
   */
  async complete(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<PickWaveWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status === PickWaveStatus.COMPLETED) {
      return existing; // idempotent
    }

    const updated = await this.prisma.pickWave.update({
      where: { id },
      data: {
        status: PickWaveStatus.COMPLETED,
        completedAt: new Date(),
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        pickTasks: {
          select: {
            id: true,
            taskNumber: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_WAVE_COMPLETED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.wave_complete',
      resource: 'pick_wave',
      resourceId: updated.id,
      details: { waveNumber: updated.waveNumber },
    });

    return updated;
  }

  /**
   * Cancel pick wave.
   */
  async cancel(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<PickWaveWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status === PickWaveStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed pick wave');
    }

    const updated = await this.prisma.pickWave.update({
      where: { id },
      data: {
        status: PickWaveStatus.CANCELLED,
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        pickTasks: {
          select: {
            id: true,
            taskNumber: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_WAVE_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.wave_cancel',
      resource: 'pick_wave',
      resourceId: updated.id,
      details: { waveNumber: updated.waveNumber },
    });

    return updated;
  }
}
