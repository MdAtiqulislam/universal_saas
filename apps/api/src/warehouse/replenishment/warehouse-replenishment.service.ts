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
  CreateReplenishmentRuleDto,
  GenerateReplenishmentDto,
  ReplenishmentQueryDto,
} from './dto/create-replenishment-rule.dto';
import {
  ReplenishmentRule,
  ReplenishmentTask,
  ReplenishmentStatus,
  StockMovementType,
  Prisma,
} from '@prisma/client';

export type ReplenishmentRuleWithDetails = ReplenishmentRule & {
  warehouse: { id: string; code: string; name: string };
  item: { id: string; sku: string; name: string };
  variant: { id: string; sku: string } | null;
  sourceLocation: { id: string; code: string; name: string };
  destinationLocation: { id: string; code: string; name: string };
};

export type ReplenishmentTaskWithDetails = ReplenishmentTask & {
  warehouse: { id: string; code: string; name: string };
  item: { id: string; sku: string; name: string };
  variant: { id: string; sku: string } | null;
  sourceLocation: { id: string; code: string; name: string };
  destinationLocation: { id: string; code: string; name: string };
};

@Injectable()
export class WarehouseReplenishmentService {
  private readonly logger = new Logger(WarehouseReplenishmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly balancesService: BalancesService,
  ) {}

  /**
   * Create a bin replenishment rule.
   */
  async createRule(
    organizationId: string,
    dto: CreateReplenishmentRuleDto,
    actorUserId?: string,
  ): Promise<ReplenishmentRuleWithDetails> {
    const minQty = new Prisma.Decimal(dto.minQuantity);
    const maxQty = new Prisma.Decimal(dto.maxQuantity);
    const replQty = new Prisma.Decimal(dto.replenishQuantity);

    if (minQty.lt(0) || maxQty.lte(0) || replQty.lte(0)) {
      throw new BadRequestException(
        'Replenishment quantities must be valid positive values',
      );
    }
    if (minQty.gte(maxQty)) {
      throw new BadRequestException(
        'minQuantity must be strictly less than maxQuantity',
      );
    }
    if (dto.sourceLocationId === dto.destinationLocationId) {
      throw new BadRequestException(
        'Source and destination locations cannot be identical',
      );
    }

    const rule = await this.prisma.replenishmentRule.create({
      data: {
        organizationId,
        warehouseId: dto.warehouseId,
        itemId: dto.itemId,
        variantId: dto.variantId ?? null,
        sourceLocationId: dto.sourceLocationId,
        destinationLocationId: dto.destinationLocationId,
        minQuantity: minQty,
        maxQuantity: maxQty,
        replenishQuantity: replQty,
        isActive: dto.isActive ?? true,
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true } },
        sourceLocation: { select: { id: true, code: true, name: true } },
        destinationLocation: { select: { id: true, code: true, name: true } },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_REPLENISHMENT_RULE_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.replenishment_rule_create',
      resource: 'replenishment_rule',
      resourceId: rule.id,
      details: {
        itemId: rule.itemId,
        destinationLocationId: rule.destinationLocationId,
      },
    });

    return rule;
  }

  /**
   * List replenishment rules.
   */
  async findAllRules(
    organizationId: string,
    query: ReplenishmentQueryDto,
  ): Promise<ReplenishmentRuleWithDetails[]> {
    const where: Prisma.ReplenishmentRuleWhereInput = { organizationId };

    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.itemId) where.itemId = query.itemId;

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { item: { sku: { contains: search, mode: 'insensitive' } } },
        { item: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.replenishmentRule.findMany({
      where,
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true } },
        sourceLocation: { select: { id: true, code: true, name: true } },
        destinationLocation: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Evaluate rules and automatically generate replenishment tasks.
   */
  async generateTasks(
    organizationId: string,
    dto: GenerateReplenishmentDto,
    actorUserId?: string,
  ): Promise<ReplenishmentTaskWithDetails[]> {
    const rules = await this.prisma.replenishmentRule.findMany({
      where: {
        organizationId,
        warehouseId: dto.warehouseId,
        isActive: true,
      },
    });

    const createdTasks: ReplenishmentTaskWithDetails[] = [];

    for (const rule of rules) {
      // Check current balance at destination location
      const destBalance = await this.prisma.inventoryBalance.findFirst({
        where: {
          organizationId,
          locationId: rule.destinationLocationId,
          itemId: rule.itemId,
          variantId: rule.variantId ?? null,
        },
      });

      const currentQty = destBalance?.quantityOnHand || new Prisma.Decimal(0);

      // If currentQty < minQuantity, need replenishment
      if (currentQty.lt(rule.minQuantity)) {
        // Check if there is already an open/pending replenishment task for this rule
        const existingTask = await this.prisma.replenishmentTask.findFirst({
          where: {
            organizationId,
            ruleId: rule.id,
            status: {
              in: [
                ReplenishmentStatus.PENDING,
                ReplenishmentStatus.IN_PROGRESS,
              ],
            },
          },
        });

        if (!existingTask) {
          const needed = rule.maxQuantity.minus(currentQty);
          const taskQty = Prisma.Decimal.min(needed, rule.replenishQuantity);

          let taskNumber: string;
          try {
            const seq = await this.numberingService.nextNumber(
              organizationId,
              'REPLENISHMENT_TASK',
              actorUserId,
            );
            taskNumber = seq.formatted;
          } catch {
            const count = await this.prisma.replenishmentTask.count({
              where: { organizationId },
            });
            taskNumber = `REP-${String(count + 1).padStart(6, '0')}`;
          }

          const task = await this.prisma.replenishmentTask.create({
            data: {
              organizationId,
              taskNumber,
              ruleId: rule.id,
              warehouseId: rule.warehouseId,
              itemId: rule.itemId,
              variantId: rule.variantId,
              sourceLocationId: rule.sourceLocationId,
              destinationLocationId: rule.destinationLocationId,
              quantity: taskQty,
              status: ReplenishmentStatus.PENDING,
            },
            include: {
              warehouse: { select: { id: true, code: true, name: true } },
              item: { select: { id: true, sku: true, name: true } },
              variant: { select: { id: true, sku: true } },
              sourceLocation: { select: { id: true, code: true, name: true } },
              destinationLocation: {
                select: { id: true, code: true, name: true },
              },
            },
          });

          await this.eventBus.publish({
            eventName: 'WAREHOUSE_REPLENISHMENT_CREATED',
            occurredAt: new Date(),
            organizationId,
            actorUserId: actorUserId ?? null,
            action: 'warehouse.replenishment_create',
            resource: 'replenishment_task',
            resourceId: task.id,
            details: {
              taskNumber: task.taskNumber,
              quantity: task.quantity.toString(),
            },
          });

          createdTasks.push(task);
        }
      }
    }

    return createdTasks;
  }

  /**
   * List replenishment tasks.
   */
  async findAllTasks(
    organizationId: string,
    query: ReplenishmentQueryDto,
  ): Promise<ReplenishmentTaskWithDetails[]> {
    const where: Prisma.ReplenishmentTaskWhereInput = { organizationId };

    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.itemId) where.itemId = query.itemId;

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { taskNumber: { contains: search, mode: 'insensitive' } },
        { item: { sku: { contains: search, mode: 'insensitive' } } },
        { item: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.replenishmentTask.findMany({
      where,
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true } },
        sourceLocation: { select: { id: true, code: true, name: true } },
        destinationLocation: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Complete a replenishment task by transferring stock.
   */
  async completeTask(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<ReplenishmentTaskWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.replenishmentTask.findFirst({
        where: { id, organizationId },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          item: { select: { id: true, sku: true, name: true } },
          variant: { select: { id: true, sku: true } },
          sourceLocation: { select: { id: true, code: true, name: true } },
          destinationLocation: { select: { id: true, code: true, name: true } },
        },
      });

      if (!task) {
        throw new NotFoundException(
          `Replenishment task with ID ${id} not found`,
        );
      }

      if (task.status === ReplenishmentStatus.COMPLETED) {
        return task; // Idempotent
      }

      if (task.status === ReplenishmentStatus.CANCELLED) {
        throw new BadRequestException(
          'Cannot complete a cancelled replenishment task',
        );
      }

      // Move stock via BalancesService
      await this.balancesService.applyStockMovement(
        organizationId,
        {
          itemId: task.itemId,
          variantId: task.variantId ?? undefined,
          locationId: task.sourceLocationId,
          movementType: StockMovementType.TRANSFER_OUT,
          quantity: task.quantity.toNumber(),
          reason: `Replenishment ${task.taskNumber}`,
          referenceType: 'REPLENISHMENT_TASK',
          referenceId: task.taskNumber,
        },
        actorUserId,
      );

      await this.balancesService.applyStockMovement(
        organizationId,
        {
          itemId: task.itemId,
          variantId: task.variantId ?? undefined,
          locationId: task.destinationLocationId,
          movementType: StockMovementType.TRANSFER_IN,
          quantity: task.quantity.toNumber(),
          reason: `Replenishment ${task.taskNumber}`,
          referenceType: 'REPLENISHMENT_TASK',
          referenceId: task.taskNumber,
        },
        actorUserId,
      );

      await tx.replenishmentTask.update({
        where: { id },
        data: {
          status: ReplenishmentStatus.COMPLETED,
          completedByUserId: actorUserId ?? null,
          completedAt: new Date(),
        },
      });

      await this.eventBus.publish({
        eventName: 'WAREHOUSE_REPLENISHMENT_COMPLETED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: actorUserId ?? null,
        action: 'warehouse.replenishment_complete',
        resource: 'replenishment_task',
        resourceId: id,
        details: { taskNumber: task.taskNumber },
      });

      const result = await tx.replenishmentTask.findFirst({
        where: { id, organizationId },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          item: { select: { id: true, sku: true, name: true } },
          variant: { select: { id: true, sku: true } },
          sourceLocation: { select: { id: true, code: true, name: true } },
          destinationLocation: { select: { id: true, code: true, name: true } },
        },
      });

      return result!;
    });
  }

  /**
   * Cancel replenishment task.
   */
  async cancelTask(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<ReplenishmentTaskWithDetails> {
    const existing = await this.prisma.replenishmentTask.findFirst({
      where: { id, organizationId },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true } },
        sourceLocation: { select: { id: true, code: true, name: true } },
        destinationLocation: { select: { id: true, code: true, name: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Replenishment task with ID ${id} not found`);
    }

    if (existing.status === ReplenishmentStatus.COMPLETED) {
      throw new BadRequestException(
        'Cannot cancel a completed replenishment task',
      );
    }

    const updated = await this.prisma.replenishmentTask.update({
      where: { id },
      data: { status: ReplenishmentStatus.CANCELLED },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true } },
        sourceLocation: { select: { id: true, code: true, name: true } },
        destinationLocation: { select: { id: true, code: true, name: true } },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_REPLENISHMENT_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.replenishment_cancel',
      resource: 'replenishment_task',
      resourceId: updated.id,
      details: { taskNumber: updated.taskNumber },
    });

    return updated;
  }
}
