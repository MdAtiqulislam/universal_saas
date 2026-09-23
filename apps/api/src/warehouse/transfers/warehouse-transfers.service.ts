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
  CreateWarehouseTransferDto,
  RejectWarehouseTransferDto,
  WarehouseTransferQueryDto,
} from './dto/create-warehouse-transfer.dto';
import {
  WarehouseTransfer,
  WarehouseTransferLine,
  WarehouseTransferStatus,
  StockMovementType,
  Prisma,
} from '@prisma/client';

export type WarehouseTransferWithDetails = WarehouseTransfer & {
  sourceWarehouse: { id: string; code: string; name: string };
  destinationWarehouse: { id: string; code: string; name: string };
  lines: Array<
    WarehouseTransferLine & {
      item: { id: string; sku: string; name: string };
      variant: { id: string; sku: string } | null;
      sourceLocation: { id: string; code: string; name: string };
      destinationLocation: { id: string; code: string; name: string };
      batch: { id: string; batchNumber: string } | null;
      serial: { id: string; serialNumber: string } | null;
    }
  >;
};

@Injectable()
export class WarehouseTransfersService {
  private readonly logger = new Logger(WarehouseTransfersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly balancesService: BalancesService,
  ) {}

  /**
   * Create an internal warehouse transfer request.
   */
  async create(
    organizationId: string,
    dto: CreateWarehouseTransferDto,
    actorUserId?: string,
  ): Promise<WarehouseTransferWithDetails> {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException(
        'Transfer request must have at least one line',
      );
    }

    if (dto.sourceWarehouseId === dto.destinationWarehouseId) {
      // Allowed if lines have different internal locations, but if both locations and warehouses are same, check lines
    }

    const [sourceWh, destWh] = await Promise.all([
      this.prisma.location.findFirst({
        where: { id: dto.sourceWarehouseId, organizationId },
      }),
      this.prisma.location.findFirst({
        where: { id: dto.destinationWarehouseId, organizationId },
      }),
    ]);

    if (!sourceWh) {
      throw new NotFoundException(
        `Source warehouse ID ${dto.sourceWarehouseId} not found`,
      );
    }
    if (!destWh) {
      throw new NotFoundException(
        `Destination warehouse ID ${dto.destinationWarehouseId} not found`,
      );
    }

    // Validate line source != destination and positive quantities
    for (const line of dto.lines) {
      if (line.sourceLocationId === line.destinationLocationId) {
        throw new BadRequestException(
          'Transfer source location and destination location cannot be identical',
        );
      }
      const qty = new Prisma.Decimal(line.quantity);
      if (qty.lte(0)) {
        throw new BadRequestException(
          'Transfer quantity must be strictly positive',
        );
      }
    }

    let transferNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'WAREHOUSE_TRANSFER',
        actorUserId,
      );
      transferNumber = seq.formatted;
    } catch {
      const count = await this.prisma.warehouseTransfer.count({
        where: { organizationId },
      });
      transferNumber = `WTR-${String(count + 1).padStart(6, '0')}`;
    }

    const transfer = await this.prisma.warehouseTransfer.create({
      data: {
        organizationId,
        transferNumber,
        sourceWarehouseId: dto.sourceWarehouseId,
        destinationWarehouseId: dto.destinationWarehouseId,
        status: WarehouseTransferStatus.DRAFT,
        reason: dto.reason?.trim() ?? null,
        lines: {
          create: dto.lines.map((l) => ({
            organizationId,
            itemId: l.itemId,
            variantId: l.variantId ?? null,
            sourceLocationId: l.sourceLocationId,
            destinationLocationId: l.destinationLocationId,
            quantity: new Prisma.Decimal(l.quantity),
            batchId: l.batchId ?? null,
            serialId: l.serialId ?? null,
          })),
        },
      },
      include: {
        sourceWarehouse: { select: { id: true, code: true, name: true } },
        destinationWarehouse: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            sourceLocation: { select: { id: true, code: true, name: true } },
            destinationLocation: {
              select: { id: true, code: true, name: true },
            },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_TRANSFER_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.transfer_create',
      resource: 'warehouse_transfer',
      resourceId: transfer.id,
      details: { transferNumber: transfer.transferNumber },
    });

    return transfer;
  }

  /**
   * List warehouse transfers.
   */
  async findAll(
    organizationId: string,
    query: WarehouseTransferQueryDto,
  ): Promise<{
    data: WarehouseTransferWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.WarehouseTransferWhereInput = { organizationId };

    if (query.sourceWarehouseId)
      where.sourceWarehouseId = query.sourceWarehouseId;
    if (query.destinationWarehouseId)
      where.destinationWarehouseId = query.destinationWarehouseId;
    if (query.status) where.status = query.status as WarehouseTransferStatus;

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { transferNumber: { contains: search, mode: 'insensitive' } },
        { reason: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.warehouseTransfer.findMany({
        where,
        include: {
          sourceWarehouse: { select: { id: true, code: true, name: true } },
          destinationWarehouse: {
            select: { id: true, code: true, name: true },
          },
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true } },
              variant: { select: { id: true, sku: true } },
              sourceLocation: { select: { id: true, code: true, name: true } },
              destinationLocation: {
                select: { id: true, code: true, name: true },
              },
              batch: { select: { id: true, batchNumber: true } },
              serial: { select: { id: true, serialNumber: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.warehouseTransfer.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Find single warehouse transfer by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<WarehouseTransferWithDetails> {
    const transfer = await this.prisma.warehouseTransfer.findFirst({
      where: { id, organizationId },
      include: {
        sourceWarehouse: { select: { id: true, code: true, name: true } },
        destinationWarehouse: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            sourceLocation: { select: { id: true, code: true, name: true } },
            destinationLocation: {
              select: { id: true, code: true, name: true },
            },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException(`Warehouse transfer with ID ${id} not found`);
    }

    return transfer;
  }

  /**
   * Submit transfer request for approval.
   */
  async submit(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<WarehouseTransferWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== WarehouseTransferStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT transfers can be submitted (current status: ${existing.status})`,
      );
    }

    const updated = await this.prisma.warehouseTransfer.update({
      where: { id },
      data: {
        status: WarehouseTransferStatus.SUBMITTED,
        submittedByUserId: actorUserId ?? null,
        submittedAt: new Date(),
      },
      include: {
        sourceWarehouse: { select: { id: true, code: true, name: true } },
        destinationWarehouse: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            sourceLocation: { select: { id: true, code: true, name: true } },
            destinationLocation: {
              select: { id: true, code: true, name: true },
            },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_TRANSFER_SUBMITTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.transfer_submit',
      resource: 'warehouse_transfer',
      resourceId: updated.id,
      details: { transferNumber: updated.transferNumber },
    });

    return updated;
  }

  /**
   * Approve transfer request.
   */
  async approve(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<WarehouseTransferWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status !== WarehouseTransferStatus.SUBMITTED &&
      existing.status !== WarehouseTransferStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Only DRAFT or SUBMITTED transfers can be approved (current status: ${existing.status})`,
      );
    }

    const updated = await this.prisma.warehouseTransfer.update({
      where: { id },
      data: {
        status: WarehouseTransferStatus.APPROVED,
        approvedByUserId: actorUserId ?? null,
        approvedAt: new Date(),
      },
      include: {
        sourceWarehouse: { select: { id: true, code: true, name: true } },
        destinationWarehouse: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            sourceLocation: { select: { id: true, code: true, name: true } },
            destinationLocation: {
              select: { id: true, code: true, name: true },
            },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_TRANSFER_APPROVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.transfer_approve',
      resource: 'warehouse_transfer',
      resourceId: updated.id,
      details: { transferNumber: updated.transferNumber },
    });

    return updated;
  }

  /**
   * Reject transfer request.
   */
  async reject(
    organizationId: string,
    id: string,
    dto: RejectWarehouseTransferDto,
    actorUserId?: string,
  ): Promise<WarehouseTransferWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === WarehouseTransferStatus.COMPLETED ||
      existing.status === WarehouseTransferStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot reject transfer in ${existing.status} status`,
      );
    }

    const updated = await this.prisma.warehouseTransfer.update({
      where: { id },
      data: {
        status: WarehouseTransferStatus.REJECTED,
        reason: dto.rejectionReason.trim(),
      },
      include: {
        sourceWarehouse: { select: { id: true, code: true, name: true } },
        destinationWarehouse: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            sourceLocation: { select: { id: true, code: true, name: true } },
            destinationLocation: {
              select: { id: true, code: true, name: true },
            },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_TRANSFER_REJECTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.transfer_reject',
      resource: 'warehouse_transfer',
      resourceId: updated.id,
      details: { transferNumber: updated.transferNumber },
    });

    return updated;
  }

  /**
   * Start executing transfer.
   */
  async start(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<WarehouseTransferWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== WarehouseTransferStatus.APPROVED) {
      throw new BadRequestException(
        `Only APPROVED transfers can be started (current status: ${existing.status})`,
      );
    }

    const updated = await this.prisma.warehouseTransfer.update({
      where: { id },
      data: {
        status: WarehouseTransferStatus.IN_PROGRESS,
      },
      include: {
        sourceWarehouse: { select: { id: true, code: true, name: true } },
        destinationWarehouse: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            sourceLocation: { select: { id: true, code: true, name: true } },
            destinationLocation: {
              select: { id: true, code: true, name: true },
            },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_TRANSFER_STARTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.transfer_start',
      resource: 'warehouse_transfer',
      resourceId: updated.id,
      details: { transferNumber: updated.transferNumber },
    });

    return updated;
  }

  /**
   * Complete transfer, moving stock from source to destination.
   */
  async complete(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<WarehouseTransferWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.warehouseTransfer.findFirst({
        where: { id, organizationId },
        include: {
          sourceWarehouse: { select: { id: true, code: true, name: true } },
          destinationWarehouse: {
            select: { id: true, code: true, name: true },
          },
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true } },
              variant: { select: { id: true, sku: true } },
              sourceLocation: { select: { id: true, code: true, name: true } },
              destinationLocation: {
                select: { id: true, code: true, name: true },
              },
              batch: { select: { id: true, batchNumber: true } },
              serial: { select: { id: true, serialNumber: true } },
            },
          },
        },
      });

      if (!transfer) {
        throw new NotFoundException(
          `Warehouse transfer with ID ${id} not found`,
        );
      }

      if (transfer.status === WarehouseTransferStatus.COMPLETED) {
        return transfer; // Idempotent
      }

      if (
        transfer.status === WarehouseTransferStatus.CANCELLED ||
        transfer.status === WarehouseTransferStatus.REJECTED
      ) {
        throw new BadRequestException(
          `Cannot complete transfer in ${transfer.status} status`,
        );
      }

      // Execute inventory balance movements for each line
      for (const line of transfer.lines) {
        await this.balancesService.applyStockMovement(
          organizationId,
          {
            itemId: line.itemId,
            variantId: line.variantId ?? undefined,
            locationId: line.sourceLocationId,
            movementType: StockMovementType.TRANSFER_OUT,
            quantity: line.quantity.toNumber(),
            batchId: line.batchId ?? undefined,
            serialId: line.serialId ?? undefined,
            reason: `Transfer ${transfer.transferNumber}`,
            referenceType: 'WAREHOUSE_TRANSFER',
            referenceId: transfer.transferNumber,
          },
          actorUserId,
        );

        await this.balancesService.applyStockMovement(
          organizationId,
          {
            itemId: line.itemId,
            variantId: line.variantId ?? undefined,
            locationId: line.destinationLocationId,
            movementType: StockMovementType.TRANSFER_IN,
            quantity: line.quantity.toNumber(),
            batchId: line.batchId ?? undefined,
            serialId: line.serialId ?? undefined,
            reason: `Transfer ${transfer.transferNumber}`,
            referenceType: 'WAREHOUSE_TRANSFER',
            referenceId: transfer.transferNumber,
          },
          actorUserId,
        );
      }

      await tx.warehouseTransfer.update({
        where: { id },
        data: {
          status: WarehouseTransferStatus.COMPLETED,
          completedByUserId: actorUserId ?? null,
          completedAt: new Date(),
        },
      });

      await this.eventBus.publish({
        eventName: 'WAREHOUSE_TRANSFER_COMPLETED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: actorUserId ?? null,
        action: 'warehouse.transfer_complete',
        resource: 'warehouse_transfer',
        resourceId: id,
        details: { transferNumber: transfer.transferNumber },
      });

      return this.findOne(organizationId, id);
    });
  }

  /**
   * Cancel transfer request.
   */
  async cancel(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<WarehouseTransferWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status === WarehouseTransferStatus.COMPLETED) {
      throw new BadRequestException(
        'Cannot cancel a completed warehouse transfer',
      );
    }

    const updated = await this.prisma.warehouseTransfer.update({
      where: { id },
      data: {
        status: WarehouseTransferStatus.CANCELLED,
      },
      include: {
        sourceWarehouse: { select: { id: true, code: true, name: true } },
        destinationWarehouse: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item: { select: { id: true, sku: true, name: true } },
            variant: { select: { id: true, sku: true } },
            sourceLocation: { select: { id: true, code: true, name: true } },
            destinationLocation: {
              select: { id: true, code: true, name: true },
            },
            batch: { select: { id: true, batchNumber: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_TRANSFER_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.transfer_cancel',
      resource: 'warehouse_transfer',
      resourceId: updated.id,
      details: { transferNumber: updated.transferNumber },
    });

    return updated;
  }
}
