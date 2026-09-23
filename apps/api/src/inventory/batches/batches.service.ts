import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, TrackingType, StockMovementType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { BalancesService } from '../balances/balances.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { InventoryBatch } from '@prisma/client';

@Injectable()
export class BatchesService {
  private readonly logger = new Logger(BatchesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly balancesService: BalancesService,
  ) {}

  /**
   * List all batches in an organization with filters.
   */
  async findAll(
    organizationId: string,
    filter?: {
      itemId?: string;
      locationId?: string;
      search?: string;
      expiredOnly?: boolean;
    },
  ): Promise<InventoryBatch[]> {
    const where: Record<string, unknown> = { organizationId };

    if (filter?.itemId) {
      where.itemId = filter.itemId;
    }

    if (filter?.locationId) {
      where.locationId = filter.locationId;
    }

    if (filter?.search) {
      where.batchNumber = {
        contains: filter.search.trim().toUpperCase(),
        mode: 'insensitive',
      };
    }

    if (filter?.expiredOnly) {
      where.expiresAt = { lt: new Date() };
    }

    return this.prisma.inventoryBatch.findMany({
      where,
      include: {
        item: {
          select: { id: true, sku: true, name: true, trackingType: true },
        },
        variant: {
          select: { id: true, sku: true, name: true },
        },
        location: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find a single batch by ID.
   */
  async findOne(organizationId: string, id: string): Promise<InventoryBatch> {
    const batch = await this.prisma.inventoryBatch.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        item: {
          select: { id: true, sku: true, name: true, trackingType: true },
        },
        variant: {
          select: { id: true, sku: true, name: true },
        },
        location: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException(
        `Batch with ID ${id} not found in organization`,
      );
    }

    return batch;
  }

  /**
   * Create a new inventory batch record.
   */
  async create(
    organizationId: string,
    dto: CreateBatchDto,
    actorUserId?: string,
  ): Promise<InventoryBatch> {
    const normalizedBatchNumber = dto.batchNumber.trim().toUpperCase();

    // 1. Verify Item is BATCH tracked
    const item = await this.prisma.item.findFirst({
      where: {
        id: dto.itemId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!item) {
      throw new NotFoundException(
        `Item with ID ${dto.itemId} not found in organization`,
      );
    }

    if (item.trackingType !== TrackingType.BATCH) {
      throw new BadRequestException(
        `Item '${item.sku}' trackingType is ${item.trackingType}, but BATCH tracking is required`,
      );
    }

    // 2. Verify Location
    const location = await this.prisma.location.findFirst({
      where: {
        id: dto.locationId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!location) {
      throw new NotFoundException(
        `Location with ID ${dto.locationId} not found in organization`,
      );
    }

    // 3. Verify Variant if specified
    if (dto.variantId) {
      const variant = await this.prisma.itemVariant.findFirst({
        where: {
          id: dto.variantId,
          itemId: dto.itemId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!variant) {
        throw new NotFoundException(
          `Variant with ID ${dto.variantId} not found for item in organization`,
        );
      }
    }

    // 4. Check uniqueness
    const existing = await this.prisma.inventoryBatch.findFirst({
      where: {
        organizationId,
        itemId: dto.itemId,
        variantId: dto.variantId ?? null,
        locationId: dto.locationId,
        batchNumber: normalizedBatchNumber,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Batch '${normalizedBatchNumber}' already exists for this item at location '${location.code}'`,
      );
    }

    const batch = await this.prisma.inventoryBatch.create({
      data: {
        organizationId,
        itemId: dto.itemId,
        variantId: dto.variantId ?? null,
        locationId: dto.locationId,
        batchNumber: normalizedBatchNumber,
        manufacturedAt: dto.manufacturedAt
          ? new Date(dto.manufacturedAt)
          : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        quantity: new Prisma.Decimal('0.0000'),
      },
    });

    await this.eventBus.publish({
      eventName: 'BATCH_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'batch.create',
      resource: 'inventory_batch',
      resourceId: batch.id,
      details: {
        itemId: batch.itemId,
        locationId: batch.locationId,
        batchNumber: batch.batchNumber,
      },
    });

    // If initial quantity specified, apply initial receipt
    if (dto.initialQuantity && dto.initialQuantity > 0) {
      await this.balancesService.applyStockMovement(
        organizationId,
        {
          itemId: dto.itemId,
          variantId: dto.variantId,
          locationId: dto.locationId,
          movementType: StockMovementType.RECEIPT,
          quantity: dto.initialQuantity,
          batchId: batch.id,
          reason: 'Initial batch stock registration',
          referenceType: 'BATCH_INITIALIZATION',
        },
        actorUserId,
      );

      return this.findOne(organizationId, batch.id);
    }

    return batch;
  }

  /**
   * Update batch metadata (dates).
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateBatchDto,
    actorUserId?: string,
  ): Promise<InventoryBatch> {
    const existing = await this.prisma.inventoryBatch.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Batch with ID ${id} not found in organization`,
      );
    }

    const updated = await this.prisma.inventoryBatch.update({
      where: { id },
      data: {
        manufacturedAt:
          dto.manufacturedAt !== undefined
            ? dto.manufacturedAt
              ? new Date(dto.manufacturedAt)
              : null
            : undefined,
        expiresAt:
          dto.expiresAt !== undefined
            ? dto.expiresAt
              ? new Date(dto.expiresAt)
              : null
            : undefined,
      },
    });

    await this.eventBus.publish({
      eventName: 'BATCH_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'batch.update',
      resource: 'inventory_batch',
      resourceId: updated.id,
      details: {
        batchNumber: updated.batchNumber,
      },
    });

    return updated;
  }
}
