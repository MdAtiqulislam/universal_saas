import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateCustomerPriceDto } from './dto/create-customer-price.dto';
import { UpdateCustomerPriceDto } from './dto/update-customer-price.dto';
import { CustomerPriceQueryDto } from './dto/customer-price-query.dto';
import { CustomerPrice, Prisma } from '@prisma/client';

export type CustomerPriceWithDetails = Prisma.CustomerPriceGetPayload<{
  include: {
    customer: { select: { id: true; code: true; name: true } };
    customerGroup: { select: { id: true; code: true; name: true } };
    item: { select: { id: true; sku: true; name: true } };
    variant: { select: { id: true; sku: true; name: true } };
    currency: { select: { id: true; code: true; symbol: true } };
  };
}>;

@Injectable()
export class CustomerPricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Create a customer/group pricing rule.
   */
  async create(
    organizationId: string,
    dto: CreateCustomerPriceDto,
    actorUserId?: string,
  ): Promise<CustomerPrice> {
    // 1. Validate Customer/Group XOR
    const hasCustomer = Boolean(dto.customerId);
    const hasGroup = Boolean(dto.customerGroupId);
    if ((hasCustomer && hasGroup) || (!hasCustomer && !hasGroup)) {
      throw new BadRequestException(
        'A pricing rule must target either a specific Customer OR a Customer Group, never both or neither.',
      );
    }

    // 2. Validate Item/Variant XOR
    const hasItem = Boolean(dto.itemId);
    const hasVariant = Boolean(dto.variantId);
    if ((hasItem && hasVariant) || (!hasItem && !hasVariant)) {
      throw new BadRequestException(
        'A pricing rule must target either a base Item OR an Item Variant, never both or neither.',
      );
    }

    // 3. Verify Customer / Group exists
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, organizationId, deletedAt: null },
      });
      if (!customer) {
        throw new NotFoundException(
          `Customer with ID ${dto.customerId} not found in this organization`,
        );
      }
    }

    if (dto.customerGroupId) {
      const group = await this.prisma.customerGroup.findFirst({
        where: { id: dto.customerGroupId, organizationId, deletedAt: null },
      });
      if (!group) {
        throw new NotFoundException(
          `Customer group with ID ${dto.customerGroupId} not found in this organization`,
        );
      }
    }

    // 4. Verify Item / Variant exists
    if (dto.itemId) {
      const item = await this.prisma.item.findFirst({
        where: { id: dto.itemId, organizationId, deletedAt: null },
      });
      if (!item) {
        throw new NotFoundException(
          `Item with ID ${dto.itemId} not found in this organization`,
        );
      }
    }

    if (dto.variantId) {
      const variant = await this.prisma.itemVariant.findFirst({
        where: { id: dto.variantId, organizationId, deletedAt: null },
      });
      if (!variant) {
        throw new NotFoundException(
          `Item variant with ID ${dto.variantId} not found in this organization`,
        );
      }
    }

    // 5. Verify Currency exists
    const currency = await this.prisma.currency.findFirst({
      where: { id: dto.currencyId, isActive: true },
    });
    if (!currency) {
      throw new BadRequestException(
        `Currency with ID ${dto.currencyId} not found or inactive`,
      );
    }

    // 6. Validate Dates
    let validFrom: Date | null = null;
    let validUntil: Date | null = null;
    if (dto.validFrom) validFrom = new Date(dto.validFrom);
    if (dto.validUntil) validUntil = new Date(dto.validUntil);
    if (validFrom && validUntil && validFrom > validUntil) {
      throw new BadRequestException(
        'validFrom date cannot be after validUntil date',
      );
    }

    const price = await this.prisma.customerPrice.create({
      data: {
        organizationId,
        customerId: dto.customerId ?? null,
        customerGroupId: dto.customerGroupId ?? null,
        itemId: dto.itemId ?? null,
        variantId: dto.variantId ?? null,
        currencyId: dto.currencyId,
        minQuantity: new Prisma.Decimal(dto.minQuantity ?? 1),
        unitPrice: new Prisma.Decimal(dto.unitPrice),
        validFrom,
        validUntil,
        isActive: dto.isActive ?? true,
      },
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_PRICE_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_price.create',
      resource: 'customer_price',
      resourceId: price.id,
      details: {
        customerId: price.customerId,
        customerGroupId: price.customerGroupId,
        itemId: price.itemId,
        variantId: price.variantId,
        unitPrice: price.unitPrice.toString(),
      },
    });

    return price;
  }

  /**
   * List customer prices with filters and pagination.
   */
  async findAll(
    organizationId: string,
    query: CustomerPriceQueryDto,
  ): Promise<{
    prices: CustomerPriceWithDetails[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerPriceWhereInput = { organizationId };
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.customerId) where.customerId = query.customerId;
    if (query.customerGroupId) where.customerGroupId = query.customerGroupId;
    if (query.itemId) where.itemId = query.itemId;
    if (query.variantId) where.variantId = query.variantId;

    const [total, prices] = await Promise.all([
      this.prisma.customerPrice.count({ where }),
      this.prisma.customerPrice.findMany({
        where,
        include: {
          customer: { select: { id: true, code: true, name: true } },
          customerGroup: { select: { id: true, code: true, name: true } },
          item: { select: { id: true, sku: true, name: true } },
          variant: { select: { id: true, sku: true, name: true } },
          currency: { select: { id: true, code: true, symbol: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      prices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find single customer price rule.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<CustomerPriceWithDetails> {
    const price = await this.prisma.customerPrice.findFirst({
      where: { id, organizationId },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        customerGroup: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true, name: true } },
        currency: { select: { id: true, code: true, symbol: true } },
      },
    });

    if (!price) {
      throw new NotFoundException(`Customer price with ID ${id} not found`);
    }

    return price;
  }

  /**
   * Update customer price rule.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateCustomerPriceDto,
    actorUserId?: string,
  ): Promise<CustomerPrice> {
    await this.findOne(organizationId, id);

    const data: Prisma.CustomerPriceUpdateInput = {};
    if (dto.minQuantity !== undefined) {
      data.minQuantity = new Prisma.Decimal(dto.minQuantity);
    }
    if (dto.unitPrice !== undefined) {
      data.unitPrice = new Prisma.Decimal(dto.unitPrice);
    }
    if (dto.validFrom !== undefined) {
      data.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    }
    if (dto.validUntil !== undefined) {
      data.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    const updated = await this.prisma.customerPrice.update({
      where: { id },
      data,
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_PRICE_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_price.update',
      resource: 'customer_price',
      resourceId: updated.id,
      details: { unitPrice: updated.unitPrice.toString() },
    });

    return updated;
  }

  /**
   * Delete customer price rule.
   */
  async remove(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<{ success: boolean }> {
    await this.findOne(organizationId, id);

    await this.prisma.customerPrice.delete({
      where: { id },
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_PRICE_DELETED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_price.delete',
      resource: 'customer_price',
      resourceId: id,
      details: {},
    });

    return { success: true };
  }
}
