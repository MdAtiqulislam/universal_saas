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
import { CreatePricingTierDto } from './dto/create-pricing-tier.dto';
import { UpdatePricingTierDto } from './dto/update-pricing-tier.dto';
import { CreateItemPriceDto } from './dto/create-item-price.dto';
import { UpdateItemPriceDto } from './dto/update-item-price.dto';
import { PricingTier, ItemPrice } from '@prisma/client';

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  // ----------------------------------------------------------------------------
  // PRICING TIERS
  // ----------------------------------------------------------------------------

  /**
   * List all pricing tiers for an organization.
   */
  async findAllPricingTiers(
    organizationId: string,
    filter?: { isActive?: boolean; search?: string },
  ): Promise<PricingTier[]> {
    const where: Record<string, unknown> = { organizationId };

    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter?.search) {
      const searchTerm = filter.search.trim();
      where.OR = [
        { code: { contains: searchTerm, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    return this.prisma.pricingTier.findMany({
      where,
      include: {
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Find single pricing tier by ID.
   */
  async findOnePricingTier(
    organizationId: string,
    id: string,
  ): Promise<PricingTier> {
    const tier = await this.prisma.pricingTier.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        currency: {
          select: {
            id: true,
            code: true,
            name: true,
            symbol: true,
            decimalPlaces: true,
          },
        },
      },
    });

    if (!tier) {
      throw new NotFoundException(
        `Pricing tier with ID ${id} not found in organization`,
      );
    }

    return tier;
  }

  /**
   * Create a new pricing tier.
   */
  async createPricingTier(
    organizationId: string,
    dto: CreatePricingTierDto,
    actorUserId?: string,
  ): Promise<PricingTier> {
    const normalizedCode = dto.code.trim().toUpperCase();

    const existing = await this.prisma.pricingTier.findFirst({
      where: {
        organizationId,
        code: normalizedCode,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Pricing tier code '${normalizedCode}' already exists in this organization`,
      );
    }

    // Verify global currency exists and is active
    const currency = await this.prisma.currency.findFirst({
      where: { id: dto.currencyId },
    });

    if (!currency) {
      throw new BadRequestException(
        `Currency with ID '${dto.currencyId}' does not exist`,
      );
    }

    if (!currency.isActive) {
      throw new BadRequestException(
        `Currency '${currency.code}' is inactive and cannot be used for pricing tiers`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        // Unset any existing default tier for this organization
        await tx.pricingTier.updateMany({
          where: {
            organizationId,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }

      const tier = await tx.pricingTier.create({
        data: {
          organizationId,
          code: normalizedCode,
          name: dto.name.trim(),
          description: dto.description?.trim() ?? null,
          currencyId: dto.currencyId,
          isDefault: dto.isDefault ?? false,
          isActive: true,
        },
        include: {
          currency: {
            select: { id: true, code: true, name: true, symbol: true },
          },
        },
      });

      await this.eventBus.publish({
        eventName: 'PRICING_TIER_CREATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: actorUserId ?? null,
        action: 'pricing_tier.create',
        resource: 'pricing_tier',
        resourceId: tier.id,
        details: {
          code: tier.code,
          name: tier.name,
          isDefault: tier.isDefault,
        },
      });

      return tier;
    });
  }

  /**
   * Update a pricing tier.
   */
  async updatePricingTier(
    organizationId: string,
    id: string,
    dto: UpdatePricingTierDto,
    actorUserId?: string,
  ): Promise<PricingTier> {
    const existing = await this.prisma.pricingTier.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Pricing tier with ID ${id} not found in organization`,
      );
    }

    if (dto.currencyId) {
      const currency = await this.prisma.currency.findFirst({
        where: { id: dto.currencyId },
      });

      if (!currency || !currency.isActive) {
        throw new BadRequestException(
          `Currency with ID '${dto.currencyId}' is invalid or inactive`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.pricingTier.updateMany({
          where: {
            organizationId,
            isDefault: true,
            id: { not: id },
          },
          data: { isDefault: false },
        });
      }

      const updated = await tx.pricingTier.update({
        where: { id },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          description:
            dto.description !== undefined
              ? dto.description
                ? dto.description.trim()
                : null
              : undefined,
          currencyId: dto.currencyId !== undefined ? dto.currencyId : undefined,
          isDefault: dto.isDefault,
          isActive: dto.isActive,
        },
        include: {
          currency: {
            select: { id: true, code: true, name: true, symbol: true },
          },
        },
      });

      await this.eventBus.publish({
        eventName: 'PRICING_TIER_UPDATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: actorUserId ?? null,
        action: 'pricing_tier.update',
        resource: 'pricing_tier',
        resourceId: updated.id,
        details: {
          code: updated.code,
          name: updated.name,
        },
      });

      return updated;
    });
  }

  // ----------------------------------------------------------------------------
  // ITEM & VARIANT PRICES
  // ----------------------------------------------------------------------------

  /**
   * List active prices for a specific item.
   */
  async findPricesByItem(
    organizationId: string,
    itemId: string,
  ): Promise<ItemPrice[]> {
    const item = await this.prisma.item.findFirst({
      where: {
        id: itemId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!item) {
      throw new NotFoundException(
        `Item with ID ${itemId} not found in organization`,
      );
    }

    return this.prisma.itemPrice.findMany({
      where: {
        organizationId,
        itemId,
        isActive: true,
      },
      include: {
        pricingTier: {
          select: { id: true, code: true, name: true, currencyId: true },
        },
      },
      orderBy: { minQuantity: 'asc' },
    });
  }

  /**
   * List active prices for a specific variant.
   */
  async findPricesByVariant(
    organizationId: string,
    variantId: string,
  ): Promise<ItemPrice[]> {
    const variant = await this.prisma.itemVariant.findFirst({
      where: {
        id: variantId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!variant) {
      throw new NotFoundException(
        `Item variant with ID ${variantId} not found in organization`,
      );
    }

    return this.prisma.itemPrice.findMany({
      where: {
        organizationId,
        variantId,
        isActive: true,
      },
      include: {
        pricingTier: {
          select: { id: true, code: true, name: true, currencyId: true },
        },
      },
      orderBy: { minQuantity: 'asc' },
    });
  }

  /**
   * Create an item or variant price with strict XOR target validation.
   */
  async createPrice(
    organizationId: string,
    target: { itemId?: string; variantId?: string },
    dto: CreateItemPriceDto,
    actorUserId?: string,
  ): Promise<ItemPrice> {
    // 1. Strict XOR validation: exactly one target must be provided
    const hasItem = !!target.itemId;
    const hasVariant = !!target.variantId;

    if ((hasItem && hasVariant) || (!hasItem && !hasVariant)) {
      throw new BadRequestException(
        'A price entry must target either an itemId OR a variantId, never both and never neither',
      );
    }

    // 2. Validate amount and minQuantity
    if (dto.amount <= 0) {
      throw new BadRequestException(
        'Price amount must be strictly greater than 0',
      );
    }

    const minQty = dto.minQuantity ?? 1;
    if (minQty <= 0) {
      throw new BadRequestException(
        'Minimum quantity must be strictly greater than 0',
      );
    }

    // 3. Verify target exists in tenant
    if (target.itemId) {
      const item = await this.prisma.item.findFirst({
        where: {
          id: target.itemId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!item) {
        throw new NotFoundException(
          `Item with ID '${target.itemId}' not found in organization`,
        );
      }
    }

    if (target.variantId) {
      const variant = await this.prisma.itemVariant.findFirst({
        where: {
          id: target.variantId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!variant) {
        throw new NotFoundException(
          `Item variant with ID '${target.variantId}' not found in organization`,
        );
      }
    }

    // 4. Verify pricing tier exists in tenant and is active
    const tier = await this.prisma.pricingTier.findFirst({
      where: {
        id: dto.pricingTierId,
        organizationId,
      },
    });

    if (!tier) {
      throw new BadRequestException(
        `Pricing tier '${dto.pricingTierId}' does not exist in this organization`,
      );
    }

    if (!tier.isActive) {
      throw new BadRequestException(
        `Pricing tier '${tier.code}' is inactive and cannot receive new prices`,
      );
    }

    const price = await this.prisma.itemPrice.create({
      data: {
        organizationId,
        itemId: target.itemId ?? null,
        variantId: target.variantId ?? null,
        pricingTierId: dto.pricingTierId,
        amount: new Prisma.Decimal(dto.amount.toFixed(4)),
        minQuantity: new Prisma.Decimal(minQty.toFixed(4)),
        isActive: true,
      },
      include: {
        pricingTier: {
          select: { id: true, code: true, name: true, currencyId: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'PRICE_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'price.create',
      resource: 'item_price',
      resourceId: price.id,
      details: {
        itemId: price.itemId,
        variantId: price.variantId,
        pricingTierId: price.pricingTierId,
        amount: price.amount.toString(),
      },
    });

    return price;
  }

  /**
   * Update an existing price entry.
   */
  async updatePrice(
    organizationId: string,
    id: string,
    dto: UpdateItemPriceDto,
    actorUserId?: string,
  ): Promise<ItemPrice> {
    const existing = await this.prisma.itemPrice.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Price entry with ID ${id} not found in organization`,
      );
    }

    if (dto.amount !== undefined && dto.amount <= 0) {
      throw new BadRequestException(
        'Price amount must be strictly greater than 0',
      );
    }

    if (dto.minQuantity !== undefined && dto.minQuantity <= 0) {
      throw new BadRequestException(
        'Minimum quantity must be strictly greater than 0',
      );
    }

    const updated = await this.prisma.itemPrice.update({
      where: { id },
      data: {
        amount:
          dto.amount !== undefined
            ? new Prisma.Decimal(dto.amount.toFixed(4))
            : undefined,
        minQuantity:
          dto.minQuantity !== undefined
            ? new Prisma.Decimal(dto.minQuantity.toFixed(4))
            : undefined,
        isActive: dto.isActive,
      },
      include: {
        pricingTier: {
          select: { id: true, code: true, name: true, currencyId: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'PRICE_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'price.update',
      resource: 'item_price',
      resourceId: updated.id,
      details: {
        amount: updated.amount.toString(),
        isActive: updated.isActive,
      },
    });

    return updated;
  }

  /**
   * Delete a price entry.
   */
  async deletePrice(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.itemPrice.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Price entry with ID ${id} not found in organization`,
      );
    }

    await this.prisma.itemPrice.delete({
      where: { id },
    });

    await this.eventBus.publish({
      eventName: 'PRICE_DELETED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'price.delete',
      resource: 'item_price',
      resourceId: existing.id,
      details: {
        itemId: existing.itemId,
        variantId: existing.variantId,
        pricingTierId: existing.pricingTierId,
      },
    });

    return {
      success: true,
      message: `Price entry ${id} deleted successfully`,
    };
  }
}
