import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemQueryDto } from './dto/item-query.dto';
import { Item, ItemType, TrackingType } from '@prisma/client';

export interface PaginatedItemsResult {
  items: Item[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ItemsService {
  private readonly logger = new Logger(ItemsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * List items with pagination, filtering, and search.
   */
  async findAll(
    organizationId: string,
    query: ItemQueryDto,
  ): Promise<PaginatedItemsResult> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
    };

    if (query.isActive !== undefined) {
      where.isActive =
        query.isActive === 'true'
          ? true
          : query.isActive === 'false'
            ? false
            : undefined;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.itemType) {
      where.itemType = query.itemType;
    }

    if (query.search) {
      const searchTerm = query.search.trim();
      where.OR = [
        { sku: { contains: searchTerm, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.item.count({ where }),
      this.prisma.item.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true, code: true },
          },
          unit: {
            select: { id: true, name: true, code: true, symbol: true },
          },
          _count: {
            select: { variants: true, prices: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a single item by ID with full details.
   */
  async findOne(organizationId: string, id: string): Promise<Item> {
    const item = await this.prisma.item.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        category: {
          select: { id: true, name: true, code: true },
        },
        unit: {
          select: {
            id: true,
            name: true,
            code: true,
            symbol: true,
            decimalPlaces: true,
          },
        },
        variants: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
        prices: {
          where: { isActive: true },
          include: {
            pricingTier: {
              select: { id: true, code: true, name: true, currencyId: true },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(
        `Item with ID ${id} not found in organization`,
      );
    }

    return item;
  }

  /**
   * Create a new item / product master record.
   */
  async create(
    organizationId: string,
    dto: CreateItemDto,
    actorUserId?: string,
  ): Promise<Item> {
    const normalizedSku = dto.sku.trim().toUpperCase();

    // Check SKU uniqueness in tenant
    const existing = await this.prisma.item.findFirst({
      where: {
        organizationId,
        sku: normalizedSku,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Item with SKU '${normalizedSku}' already exists in this organization`,
      );
    }

    // Validate Unit of Measure in tenant
    const unit = await this.prisma.unitOfMeasure.findFirst({
      where: {
        id: dto.unitId,
        organizationId,
      },
    });

    if (!unit) {
      throw new BadRequestException(
        `Unit of measure '${dto.unitId}' does not exist in this organization`,
      );
    }

    if (!unit.isActive) {
      throw new BadRequestException(
        `Unit of measure '${unit.code}' is inactive and cannot be assigned to new items`,
      );
    }

    // Validate Category in tenant if specified
    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: dto.categoryId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!category) {
        throw new BadRequestException(
          `Category '${dto.categoryId}' does not exist in this organization`,
        );
      }

      if (!category.isActive) {
        throw new BadRequestException(
          `Category '${category.code}' is inactive and cannot be assigned to new items`,
        );
      }
    }

    const item = await this.prisma.item.create({
      data: {
        organizationId,
        sku: normalizedSku,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        categoryId: dto.categoryId ?? null,
        unitId: dto.unitId,
        itemType: dto.itemType ?? ItemType.PRODUCT,
        trackingType: dto.trackingType ?? TrackingType.NONE,
        isActive: true,
      },
      include: {
        category: {
          select: { id: true, name: true, code: true },
        },
        unit: {
          select: { id: true, name: true, code: true, symbol: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'ITEM_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'item.create',
      resource: 'item',
      resourceId: item.id,
      details: {
        sku: item.sku,
        name: item.name,
        itemType: item.itemType,
      },
    });

    return item;
  }

  /**
   * Update an existing item.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateItemDto,
    actorUserId?: string,
  ): Promise<Item> {
    const existing = await this.prisma.item.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Item with ID ${id} not found in organization`,
      );
    }

    if (dto.unitId) {
      const unit = await this.prisma.unitOfMeasure.findFirst({
        where: {
          id: dto.unitId,
          organizationId,
        },
      });

      if (!unit) {
        throw new BadRequestException(
          `Unit of measure '${dto.unitId}' does not exist in this organization`,
        );
      }
    }

    if (dto.categoryId !== undefined && dto.categoryId !== null) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: dto.categoryId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!category) {
        throw new BadRequestException(
          `Category '${dto.categoryId}' does not exist in this organization`,
        );
      }
    }

    const updated = await this.prisma.item.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        description:
          dto.description !== undefined
            ? dto.description
              ? dto.description.trim()
              : null
            : undefined,
        categoryId: dto.categoryId !== undefined ? dto.categoryId : undefined,
        unitId: dto.unitId !== undefined ? dto.unitId : undefined,
        itemType: dto.itemType !== undefined ? dto.itemType : undefined,
        trackingType:
          dto.trackingType !== undefined ? dto.trackingType : undefined,
        isActive: dto.isActive,
      },
      include: {
        category: {
          select: { id: true, name: true, code: true },
        },
        unit: {
          select: { id: true, name: true, code: true, symbol: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'ITEM_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'item.update',
      resource: 'item',
      resourceId: updated.id,
      details: {
        sku: updated.sku,
        name: updated.name,
      },
    });

    return updated;
  }

  /**
   * Soft-delete/archive an item and its variants.
   */
  async softDelete(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.item.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Item with ID ${id} not found in organization`,
      );
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.item.update({
        where: { id },
        data: {
          isActive: false,
          deletedAt: now,
        },
      }),
      this.prisma.itemVariant.updateMany({
        where: {
          itemId: id,
          organizationId,
          deletedAt: null,
        },
        data: {
          isActive: false,
          deletedAt: now,
        },
      }),
    ]);

    await this.eventBus.publish({
      eventName: 'ITEM_ARCHIVED',
      occurredAt: now,
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'item.archive',
      resource: 'item',
      resourceId: existing.id,
      details: {
        sku: existing.sku,
        name: existing.name,
      },
    });

    return {
      success: true,
      message: `Item '${existing.name}' (${existing.sku}) archived successfully`,
    };
  }
}
