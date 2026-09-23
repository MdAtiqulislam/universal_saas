import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { InventoryCostLayersService } from './inventory-cost-layers.service';
import { ValuationQueryDto } from './dto/valuation-query.dto';
import { ItemCostHistoryQueryDto } from './dto/item-cost-history-query.dto';
import { Prisma, InventoryValuation } from '@prisma/client';

export interface ProcessInboundParams {
  itemId: string;
  variantId?: string | null;
  locationId: string;
  quantity: number | Prisma.Decimal;
  unitCost: number | Prisma.Decimal;
  batchId?: string | null;
  sourceDocument: string;
  sourceDocumentId?: string | null;
}

export interface ProcessOutboundParams {
  itemId: string;
  variantId?: string | null;
  locationId: string;
  quantity: number | Prisma.Decimal;
  sourceDocument: string;
  sourceDocumentId?: string | null;
}

export interface OutboundCostResult {
  unitCost: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  quantityIssued: Prisma.Decimal;
  valuation: InventoryValuation;
}

@Injectable()
export class InventoryValuationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly costLayersService: InventoryCostLayersService,
  ) {}

  /**
   * Helper: Find or create valuation record for (org, item, variant, location)
   */
  private async findOrCreateValuation(
    organizationId: string,
    itemId: string,
    variantId: string | null | undefined,
    locationId: string,
    client: Prisma.TransactionClient | PrismaService,
  ): Promise<InventoryValuation> {
    const existing = await client.inventoryValuation.findFirst({
      where: {
        organizationId,
        itemId,
        variantId: variantId ? variantId : null,
        locationId,
      },
    });

    if (existing) {
      return existing;
    }

    return client.inventoryValuation.create({
      data: {
        organizationId,
        itemId,
        variantId: variantId ? variantId : null,
        locationId,
        quantityOnHand: new Prisma.Decimal(0),
        averageCost: new Prisma.Decimal(0),
        totalValue: new Prisma.Decimal(0),
        lastCost: null,
      },
    });
  }

  /**
   * Process inbound inventory movement (Goods Receipt, Positive Adjustment, Customer Return).
   * Recalculates Weighted Average Cost:
   * New Avg Cost = (Existing Qty * Existing Avg Cost + Incoming Qty * Incoming Unit Cost) / (Existing Qty + Incoming Qty)
   */
  async processInbound(
    organizationId: string,
    params: ProcessInboundParams,
    existingTx?: Prisma.TransactionClient,
    actorUserId?: string,
  ): Promise<InventoryValuation> {
    const client = existingTx ?? this.prisma;
    const incomingQty = new Prisma.Decimal(params.quantity);
    const incomingCost = new Prisma.Decimal(params.unitCost);

    if (incomingQty.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Inbound quantity must be strictly positive.',
      );
    }
    if (incomingCost.lessThan(0)) {
      throw new BadRequestException('Inbound unit cost cannot be negative.');
    }

    // 1. Fetch current valuation
    const current = await this.findOrCreateValuation(
      organizationId,
      params.itemId,
      params.variantId,
      params.locationId,
      client,
    );

    // 2. Compute new WAC
    const existingQty = current.quantityOnHand;
    const existingAvgCost = current.averageCost;
    const existingTotalValue = existingQty.mul(existingAvgCost);
    const incomingTotalValue = incomingQty.mul(incomingCost);

    const newQty = existingQty.add(incomingQty);
    const newTotalValue = existingTotalValue.add(incomingTotalValue);
    const newAvgCost = newQty.greaterThan(0)
      ? newTotalValue.dividedBy(newQty)
      : incomingCost;

    // 3. Update valuation
    const updated = await client.inventoryValuation.update({
      where: { id: current.id },
      data: {
        quantityOnHand: newQty,
        averageCost: newAvgCost,
        totalValue: newTotalValue,
        lastCost: incomingCost,
        lastCalculatedAt: new Date(),
      },
    });

    // 4. Create cost layer for FIFO tracking
    await this.costLayersService.createLayer(
      organizationId,
      {
        itemId: params.itemId,
        variantId: params.variantId,
        locationId: params.locationId,
        batchId: params.batchId,
        receiptQuantity: incomingQty,
        unitCost: incomingCost,
        sourceDocument: params.sourceDocument,
        sourceDocumentId: params.sourceDocumentId,
      },
      client,
    );

    if (!existingTx) {
      await this.eventBus.publish({
        eventName: 'INVENTORY_COST_UPDATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'inventory_cost.updated',
        resource: 'inventory_valuation',
        resourceId: updated.id,
        details: {
          itemId: params.itemId,
          averageCost: newAvgCost.toFixed(4),
          quantityOnHand: newQty.toFixed(4),
          totalValue: newTotalValue.toFixed(4),
        },
      });
    }

    return updated;
  }

  /**
   * Process outbound inventory movement (Delivery Order, Stock Issue, Negative Adjustment).
   * Reduces quantity while preserving current Weighted Average Cost.
   */
  async processOutbound(
    organizationId: string,
    params: ProcessOutboundParams,
    existingTx?: Prisma.TransactionClient,
  ): Promise<OutboundCostResult> {
    const client = existingTx ?? this.prisma;
    const qtyToIssue = new Prisma.Decimal(params.quantity);

    if (qtyToIssue.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Outbound quantity must be strictly positive.',
      );
    }

    // 1. Fetch current valuation
    const current = await this.findOrCreateValuation(
      organizationId,
      params.itemId,
      params.variantId,
      params.locationId,
      client,
    );

    const unitCost = current.averageCost;
    const totalCost = qtyToIssue.mul(unitCost);

    const newQty = current.quantityOnHand.sub(qtyToIssue);
    const newTotalValue = newQty.greaterThan(0)
      ? newQty.mul(unitCost)
      : new Prisma.Decimal(0);

    // 2. Update valuation
    const updated = await client.inventoryValuation.update({
      where: { id: current.id },
      data: {
        quantityOnHand: newQty,
        totalValue: newTotalValue,
        lastCalculatedAt: new Date(),
      },
    });

    // 3. Consume FIFO cost layers
    await this.costLayersService.consumeFifo(
      organizationId,
      {
        itemId: params.itemId,
        variantId: params.variantId,
        locationId: params.locationId,
        quantity: qtyToIssue,
      },
      client,
    );

    return {
      unitCost,
      totalCost,
      quantityIssued: qtyToIssue,
      valuation: updated,
    };
  }

  /**
   * Get current valuation reports filtered by location, item, variant, category, search
   */
  async getValuation(organizationId: string, query: ValuationQueryDto) {
    const where: Prisma.InventoryValuationWhereInput = {
      organizationId,
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.variantId ? { variantId: query.variantId } : {}),
      ...(query.categoryId || query.search
        ? {
            item: {
              ...(query.categoryId ? { categoryId: query.categoryId } : {}),
              ...(query.search
                ? {
                    OR: [
                      { sku: { contains: query.search, mode: 'insensitive' } },
                      { name: { contains: query.search, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total, summary] = await Promise.all([
      this.prisma.inventoryValuation.findMany({
        where,
        include: {
          item: { include: { category: true, unit: true } },
          variant: true,
          location: true,
        },
        orderBy: [{ item: { sku: 'asc' } }, { location: { name: 'asc' } }],
        skip,
        take: limit,
      }),
      this.prisma.inventoryValuation.count({ where }),
      this.prisma.inventoryValuation.aggregate({
        where,
        _sum: {
          quantityOnHand: true,
          totalValue: true,
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalQuantityOnHand:
          summary._sum.quantityOnHand ?? new Prisma.Decimal(0),
        totalInventoryValue: summary._sum.totalValue ?? new Prisma.Decimal(0),
      },
    };
  }

  /**
   * Get historical costing and valuation changes for a specific item
   */
  async getItemCostHistory(
    organizationId: string,
    itemId: string,
    query: ItemCostHistoryQueryDto,
  ) {
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, organizationId },
    });
    if (!item) {
      throw new NotFoundException(`Item with ID ${itemId} not found.`);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const layerWhere: Prisma.InventoryCostLayerWhereInput = {
      organizationId,
      itemId,
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.variantId ? { variantId: query.variantId } : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const [layers, total] = await Promise.all([
      this.prisma.inventoryCostLayer.findMany({
        where: layerWhere,
        include: {
          variant: true,
          location: true,
          batch: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.inventoryCostLayer.count({ where: layerWhere }),
    ]);

    // Current valuations across locations
    const currentValuations = await this.prisma.inventoryValuation.findMany({
      where: {
        organizationId,
        itemId,
        ...(query.locationId ? { locationId: query.locationId } : {}),
        ...(query.variantId ? { variantId: query.variantId } : {}),
      },
      include: { location: true, variant: true },
    });

    return {
      item,
      currentValuations,
      history: layers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
