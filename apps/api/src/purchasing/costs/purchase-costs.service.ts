import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreatePurchaseCostDto } from './dto/create-cost.dto';
import { UpdatePurchaseCostDto } from './dto/update-cost.dto';
import { PurchaseCostQueryDto } from './dto/cost-query.dto';
import { PurchaseCostAllocation, Prisma } from '@prisma/client';

@Injectable()
export class PurchaseCostsService {
  private readonly logger = new Logger(PurchaseCostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * List purchase cost allocations with pagination and filters.
   */
  async findAll(organizationId: string, query: PurchaseCostQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseCostAllocationWhereInput = {
      organizationId,
    };

    if (query.costType) {
      where.costType = query.costType;
    }
    if (query.purchaseOrderId) {
      where.purchaseOrderId = query.purchaseOrderId;
    }
    if (query.goodsReceiptId) {
      where.goodsReceiptId = query.goodsReceiptId;
    }

    const [total, costs] = await Promise.all([
      this.prisma.purchaseCostAllocation.count({ where }),
      this.prisma.purchaseCostAllocation.findMany({
        where,
        include: {
          currency: {
            select: { id: true, code: true, name: true, symbol: true },
          },
          purchaseOrder: {
            select: { id: true, poNumber: true, status: true },
          },
          goodsReceipt: {
            select: { id: true, receiptNumber: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      costs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find single cost allocation by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<PurchaseCostAllocation> {
    const cost = await this.prisma.purchaseCostAllocation.findFirst({
      where: { id, organizationId },
      include: {
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
        purchaseOrder: {
          select: { id: true, poNumber: true, status: true },
        },
        goodsReceipt: {
          select: { id: true, receiptNumber: true, status: true },
        },
      },
    });

    if (!cost) {
      throw new NotFoundException(
        `Purchase cost allocation with ID ${id} not found in organization`,
      );
    }

    return cost;
  }

  /**
   * Create a purchase cost allocation record.
   */
  async create(
    organizationId: string,
    dto: CreatePurchaseCostDto,
    actorUserId?: string,
  ): Promise<PurchaseCostAllocation> {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Cost amount must be strictly greater than 0',
      );
    }

    if (dto.purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findFirst({
        where: { id: dto.purchaseOrderId, organizationId },
      });
      if (!po) {
        throw new NotFoundException(
          `Purchase order '${dto.purchaseOrderId}' not found in organization`,
        );
      }
    }

    if (dto.goodsReceiptId) {
      const receipt = await this.prisma.goodsReceipt.findFirst({
        where: { id: dto.goodsReceiptId, organizationId },
      });
      if (!receipt) {
        throw new NotFoundException(
          `Goods receipt '${dto.goodsReceiptId}' not found in organization`,
        );
      }
    }

    const currency = await this.prisma.currency.findFirst({
      where: { id: dto.currencyId, isActive: true },
    });
    if (!currency) {
      throw new NotFoundException(
        `Currency '${dto.currencyId}' not found or inactive`,
      );
    }

    const cost = await this.prisma.purchaseCostAllocation.create({
      data: {
        organizationId,
        purchaseOrderId: dto.purchaseOrderId ?? null,
        goodsReceiptId: dto.goodsReceiptId ?? null,
        costType: dto.costType,
        amount,
        currencyId: dto.currencyId,
        allocationMethod: dto.allocationMethod,
        notes: dto.notes ? dto.notes.trim() : null,
      },
      include: {
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_COST_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'purchase_cost.create',
      resource: 'purchase_cost_allocation',
      resourceId: cost.id,
      details: {
        costType: cost.costType,
        amount: cost.amount.toString(),
      },
    });

    return cost;
  }

  /**
   * Update a purchase cost allocation record.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdatePurchaseCostDto,
    actorUserId?: string,
  ): Promise<PurchaseCostAllocation> {
    const existing = await this.prisma.purchaseCostAllocation.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Purchase cost allocation with ID ${id} not found in organization`,
      );
    }

    let amount: Prisma.Decimal | undefined;
    if (dto.amount !== undefined) {
      amount = new Prisma.Decimal(dto.amount);
      if (amount.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          'Cost amount must be strictly greater than 0',
        );
      }
    }

    if (dto.currencyId) {
      const currency = await this.prisma.currency.findFirst({
        where: { id: dto.currencyId, isActive: true },
      });
      if (!currency) {
        throw new NotFoundException(
          `Currency '${dto.currencyId}' not found or inactive`,
        );
      }
    }

    const updated = await this.prisma.purchaseCostAllocation.update({
      where: { id },
      data: {
        costType: dto.costType,
        amount,
        currencyId: dto.currencyId,
        allocationMethod: dto.allocationMethod,
        notes:
          dto.notes !== undefined
            ? dto.notes
              ? dto.notes.trim()
              : null
            : undefined,
      },
      include: {
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_COST_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'purchase_cost.update',
      resource: 'purchase_cost_allocation',
      resourceId: updated.id,
      details: {
        costType: updated.costType,
        amount: updated.amount.toString(),
      },
    });

    return updated;
  }
}
