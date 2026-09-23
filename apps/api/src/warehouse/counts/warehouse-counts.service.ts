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
  CreateCycleCountDto,
  RecordCountDto,
  RecountDto,
  CycleCountQueryDto,
} from './dto/create-count.dto';
import {
  CycleCount,
  CycleCountLine,
  CycleCountStatus,
  StockMovementType,
  Prisma,
} from '@prisma/client';

export type CycleCountWithDetails = CycleCount & {
  warehouse: { id: string; code: string; name: string };
  zone: { id: string; code: string; name: string } | null;
  lines: Array<
    CycleCountLine & {
      location: { id: string; code: string; name: string };
      item: { id: string; sku: string; name: string };
      variant: { id: string; sku: string } | null;
      batch: { id: string; batchNumber: string } | null;
      serial: { id: string; serialNumber: string } | null;
    }
  >;
};

@Injectable()
export class WarehouseCountsService {
  private readonly logger = new Logger(WarehouseCountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly balancesService: BalancesService,
  ) {}

  /**
   * Create a physical cycle count plan.
   */
  async create(
    organizationId: string,
    dto: CreateCycleCountDto,
    actorUserId?: string,
  ): Promise<CycleCountWithDetails> {
    const warehouse = await this.prisma.location.findFirst({
      where: { id: dto.warehouseId, organizationId },
    });

    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse with ID ${dto.warehouseId} not found`,
      );
    }

    let countNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'CYCLE_COUNT',
        actorUserId,
      );
      countNumber = seq.formatted;
    } catch {
      const count = await this.prisma.cycleCount.count({
        where: { organizationId },
      });
      countNumber = `CC-${String(count + 1).padStart(6, '0')}`;
    }

    const linesToCreate: Array<{
      organizationId: string;
      locationId: string;
      itemId: string;
      variantId: string | null;
      batchId: string | null;
      serialId: string | null;
      systemQuantity: Prisma.Decimal;
    }> = [];

    if (dto.lines && dto.lines.length > 0) {
      for (const l of dto.lines) {
        let sysQty = new Prisma.Decimal(l.systemQuantity ?? 0);
        if (l.systemQuantity === undefined) {
          const bal = await this.prisma.inventoryBalance.findFirst({
            where: {
              organizationId,
              locationId: l.locationId,
              itemId: l.itemId,
              variantId: l.variantId ?? null,
            },
          });
          sysQty = bal?.quantityOnHand || new Prisma.Decimal(0);
        }

        linesToCreate.push({
          organizationId,
          locationId: l.locationId,
          itemId: l.itemId,
          variantId: l.variantId ?? null,
          batchId: l.batchId ?? null,
          serialId: l.serialId ?? null,
          systemQuantity: sysQty,
        });
      }
    } else {
      // Auto-populate from all inventory balances in warehouse locations
      const balances = await this.prisma.inventoryBalance.findMany({
        where: {
          organizationId,
          location: {
            OR: [{ id: dto.warehouseId }, { parentId: dto.warehouseId }],
          },
        },
      });

      for (const bal of balances) {
        linesToCreate.push({
          organizationId,
          locationId: bal.locationId,
          itemId: bal.itemId,
          variantId: bal.variantId,
          batchId: null,
          serialId: null,
          systemQuantity: bal.quantityOnHand,
        });
      }
    }

    const cycleCount = await this.prisma.cycleCount.create({
      data: {
        organizationId,
        countNumber,
        warehouseId: dto.warehouseId,
        zoneId: dto.zoneId ?? null,
        isBlind: dto.isBlind ?? false,
        description: dto.description?.trim() ?? null,
        assignedCounterUserId: dto.assignedCounterUserId ?? null,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
        status: CycleCountStatus.DRAFT,
        lines: {
          create: linesToCreate,
        },
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        zone: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            location: { select: { id: true, code: true, name: true } },
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_COUNT_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.count_create',
      resource: 'cycle_count',
      resourceId: cycleCount.id,
      details: {
        countNumber: cycleCount.countNumber,
        lineCount: linesToCreate.length,
      },
    });

    return cycleCount;
  }

  /**
   * List cycle counts.
   */
  async findAll(
    organizationId: string,
    query: CycleCountQueryDto,
  ): Promise<{
    data: CycleCountWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.CycleCountWhereInput = { organizationId };

    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.zoneId) where.zoneId = query.zoneId;
    if (query.status) where.status = query.status as CycleCountStatus;

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { countNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.cycleCount.findMany({
        where,
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          zone: { select: { id: true, code: true, name: true } },
          lines: {
            include: {
              location: { select: { id: true, code: true, name: true } },
              item: { select: { id: true, sku: true, name: true } },
              variant: { select: { id: true, sku: true } },
              batch: { select: { id: true, batchNumber: true } },
              serial: { select: { id: true, serialNumber: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.cycleCount.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Find single cycle count by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<CycleCountWithDetails> {
    const cycleCount = await this.prisma.cycleCount.findFirst({
      where: { id, organizationId },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        zone: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            location: { select: { id: true, code: true, name: true } },
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    if (!cycleCount) {
      throw new NotFoundException(`Cycle count with ID ${id} not found`);
    }

    return cycleCount;
  }

  /**
   * Start counting.
   */
  async start(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<CycleCountWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === CycleCountStatus.POSTED ||
      existing.status === CycleCountStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot start cycle count in ${existing.status} status`,
      );
    }

    const updated = await this.prisma.cycleCount.update({
      where: { id },
      data: {
        status: CycleCountStatus.IN_PROGRESS,
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        zone: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            location: { select: { id: true, code: true, name: true } },
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_COUNT_STARTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.count_start',
      resource: 'cycle_count',
      resourceId: updated.id,
      details: { countNumber: updated.countNumber },
    });

    return updated;
  }

  /**
   * Record physical count quantities and compute variances.
   */
  async recordCount(
    organizationId: string,
    id: string,
    dto: RecordCountDto,
    actorUserId?: string,
  ): Promise<CycleCountWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === CycleCountStatus.POSTED ||
      existing.status === CycleCountStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot record counts on a ${existing.status} cycle count`,
      );
    }

    for (const inputLine of dto.lines) {
      const line = existing.lines.find((l) => l.id === inputLine.lineId);
      if (!line) {
        throw new BadRequestException(
          `Line ID ${inputLine.lineId} not found on cycle count`,
        );
      }

      const countedQty = new Prisma.Decimal(inputLine.countedQuantity);
      const varianceQty = countedQty.minus(line.systemQuantity);

      await this.prisma.cycleCountLine.update({
        where: { id: line.id },
        data: {
          countedQuantity: countedQty,
          varianceQuantity: varianceQty,
          notes: inputLine.notes?.trim() ?? line.notes,
          countedAt: new Date(),
        },
      });
    }

    const updated = await this.prisma.cycleCount.update({
      where: { id },
      data: {
        status: CycleCountStatus.COUNTED,
        countedAt: new Date(),
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        zone: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            location: { select: { id: true, code: true, name: true } },
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_COUNTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.counted',
      resource: 'cycle_count',
      resourceId: updated.id,
      details: { countNumber: updated.countNumber },
    });

    return updated;
  }

  /**
   * Record recount on specific lines.
   */
  async recount(
    organizationId: string,
    id: string,
    dto: RecountDto,
    actorUserId?: string,
  ): Promise<CycleCountWithDetails> {
    const existing = await this.findOne(organizationId, id);

    for (const inputLine of dto.lines) {
      const line = existing.lines.find((l) => l.id === inputLine.lineId);
      if (!line) {
        throw new BadRequestException(
          `Line ID ${inputLine.lineId} not found on cycle count`,
        );
      }

      const recountQty = new Prisma.Decimal(inputLine.recountQuantity);
      const varianceQty = recountQty.minus(line.systemQuantity);

      await this.prisma.cycleCountLine.update({
        where: { id: line.id },
        data: {
          recountQuantity: recountQty,
          countedQuantity: recountQty,
          varianceQuantity: varianceQty,
          notes: inputLine.notes?.trim() ?? line.notes,
        },
      });
    }

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_COUNT_RECOUNTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.count_recount',
      resource: 'cycle_count',
      resourceId: id,
      details: { countNumber: existing.countNumber },
    });

    return this.findOne(organizationId, id);
  }

  /**
   * Review cycle count.
   */
  async review(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<CycleCountWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== CycleCountStatus.COUNTED) {
      throw new BadRequestException(
        `Only COUNTED cycle counts can be reviewed (current status: ${existing.status})`,
      );
    }

    const updated = await this.prisma.cycleCount.update({
      where: { id },
      data: {
        status: CycleCountStatus.REVIEWED,
        reviewedByUserId: actorUserId ?? null,
        reviewedAt: new Date(),
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        zone: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            location: { select: { id: true, code: true, name: true } },
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_COUNT_REVIEWED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.count_review',
      resource: 'cycle_count',
      resourceId: updated.id,
      details: { countNumber: updated.countNumber },
    });

    return updated;
  }

  /**
   * Post approved variances as authoritative M09 inventory adjustments.
   */
  async post(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<CycleCountWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const cycleCount = await tx.cycleCount.findFirst({
        where: { id, organizationId },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          zone: { select: { id: true, code: true, name: true } },
          lines: {
            include: {
              location: { select: { id: true, code: true, name: true } },
              item: { select: { id: true, sku: true, name: true } },
              variant: { select: { id: true, sku: true } },
              batch: { select: { id: true, batchNumber: true } },
              serial: { select: { id: true, serialNumber: true } },
            },
          },
        },
      });

      if (!cycleCount) {
        throw new NotFoundException(`Cycle count with ID ${id} not found`);
      }

      if (cycleCount.status === CycleCountStatus.POSTED) {
        return cycleCount; // Idempotent
      }

      if (
        cycleCount.status !== CycleCountStatus.REVIEWED &&
        cycleCount.status !== CycleCountStatus.COUNTED
      ) {
        throw new BadRequestException(
          `Cannot post cycle count in ${cycleCount.status} status (must be COUNTED or REVIEWED)`,
        );
      }

      // Execute inventory adjustment for each line with non-zero variance
      for (const line of cycleCount.lines) {
        const variance = line.varianceQuantity || new Prisma.Decimal(0);

        if (variance.gt(0)) {
          // Positive variance -> ADJUSTMENT_IN
          await this.balancesService.applyStockMovement(
            organizationId,
            {
              itemId: line.itemId,
              variantId: line.variantId ?? undefined,
              locationId: line.locationId,
              movementType: StockMovementType.ADJUSTMENT_IN,
              quantity: variance.toNumber(),
              batchId: line.batchId ?? undefined,
              serialId: line.serialId ?? undefined,
              reason: `Cycle count variance gain (${cycleCount.countNumber})`,
              referenceType: 'CYCLE_COUNT',
              referenceId: cycleCount.countNumber,
            },
            actorUserId,
          );
        } else if (variance.lt(0)) {
          // Negative variance -> ADJUSTMENT_OUT
          await this.balancesService.applyStockMovement(
            organizationId,
            {
              itemId: line.itemId,
              variantId: line.variantId ?? undefined,
              locationId: line.locationId,
              movementType: StockMovementType.ADJUSTMENT_OUT,
              quantity: variance.abs().toNumber(),
              batchId: line.batchId ?? undefined,
              serialId: line.serialId ?? undefined,
              reason: `Cycle count variance shrinkage (${cycleCount.countNumber})`,
              referenceType: 'CYCLE_COUNT',
              referenceId: cycleCount.countNumber,
            },
            actorUserId,
          );
        }
      }

      await tx.cycleCount.update({
        where: { id },
        data: {
          status: CycleCountStatus.POSTED,
          postedByUserId: actorUserId ?? null,
          postedAt: new Date(),
        },
      });

      await this.eventBus.publish({
        eventName: 'WAREHOUSE_COUNT_POSTED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: actorUserId ?? null,
        action: 'warehouse.count_post',
        resource: 'cycle_count',
        resourceId: id,
        details: { countNumber: cycleCount.countNumber },
      });

      return this.findOne(organizationId, id);
    });
  }

  /**
   * Cancel cycle count.
   */
  async cancel(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<CycleCountWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status === CycleCountStatus.POSTED) {
      throw new BadRequestException('Cannot cancel a posted cycle count');
    }

    const updated = await this.prisma.cycleCount.update({
      where: { id },
      data: {
        status: CycleCountStatus.CANCELLED,
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        zone: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            location: { select: { id: true, code: true, name: true } },
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_COUNT_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.count_cancel',
      resource: 'cycle_count',
      resourceId: updated.id,
      details: { countNumber: updated.countNumber },
    });

    return updated;
  }
}
