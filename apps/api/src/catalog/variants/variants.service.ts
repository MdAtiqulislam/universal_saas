import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { ItemVariant } from '@prisma/client';

@Injectable()
export class VariantsService {
  private readonly logger = new Logger(VariantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * List all variants for a specific item within an organization.
   */
  async findAllByItem(
    organizationId: string,
    itemId: string,
  ): Promise<ItemVariant[]> {
    const parentItem = await this.prisma.item.findFirst({
      where: {
        id: itemId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!parentItem) {
      throw new NotFoundException(
        `Item with ID ${itemId} not found in organization`,
      );
    }

    return this.prisma.itemVariant.findMany({
      where: {
        itemId,
        organizationId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Find single variant by ID within an organization.
   */
  async findOne(organizationId: string, id: string): Promise<ItemVariant> {
    const variant = await this.prisma.itemVariant.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        item: {
          select: { id: true, sku: true, name: true },
        },
        prices: {
          where: { isActive: true },
          include: {
            pricingTier: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException(
        `Item variant with ID ${id} not found in organization`,
      );
    }

    return variant;
  }

  /**
   * Create a new variant for an item.
   */
  async create(
    organizationId: string,
    itemId: string,
    dto: CreateVariantDto,
    actorUserId?: string,
  ): Promise<ItemVariant> {
    const normalizedSku = dto.sku.trim().toUpperCase();

    // Verify parent item in tenant
    const parentItem = await this.prisma.item.findFirst({
      where: {
        id: itemId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!parentItem) {
      throw new NotFoundException(
        `Item with ID ${itemId} not found in organization`,
      );
    }

    if (!parentItem.isActive) {
      throw new BadRequestException(
        `Cannot create variants for inactive item '${parentItem.sku}'`,
      );
    }

    // Verify variant SKU uniqueness within tenant
    const existing = await this.prisma.itemVariant.findFirst({
      where: {
        organizationId,
        sku: normalizedSku,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Variant with SKU '${normalizedSku}' already exists in this organization`,
      );
    }

    const variant = await this.prisma.itemVariant.create({
      data: {
        organizationId,
        itemId,
        sku: normalizedSku,
        name: dto.name?.trim() ?? null,
        attributes: dto.attributes
          ? (dto.attributes as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        isActive: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'VARIANT_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'variant.create',
      resource: 'item_variant',
      resourceId: variant.id,
      details: {
        itemId,
        sku: variant.sku,
        name: variant.name,
      },
    });

    return variant;
  }

  /**
   * Update variant attributes.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateVariantDto,
    actorUserId?: string,
  ): Promise<ItemVariant> {
    const existing = await this.prisma.itemVariant.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Item variant with ID ${id} not found in organization`,
      );
    }

    const updated = await this.prisma.itemVariant.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        attributes:
          dto.attributes !== undefined
            ? dto.attributes
              ? (dto.attributes as Prisma.InputJsonValue)
              : Prisma.JsonNull
            : undefined,
        isActive: dto.isActive,
      },
    });

    await this.eventBus.publish({
      eventName: 'VARIANT_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'variant.update',
      resource: 'item_variant',
      resourceId: updated.id,
      details: {
        sku: updated.sku,
        name: updated.name,
      },
    });

    return updated;
  }

  /**
   * Soft-delete/archive a variant.
   */
  async softDelete(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.itemVariant.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Item variant with ID ${id} not found in organization`,
      );
    }

    await this.prisma.itemVariant.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    await this.eventBus.publish({
      eventName: 'VARIANT_ARCHIVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'variant.archive',
      resource: 'item_variant',
      resourceId: existing.id,
      details: {
        sku: existing.sku,
        name: existing.name,
      },
    });

    return {
      success: true,
      message: `Item variant '${existing.sku}' archived successfully`,
    };
  }
}
