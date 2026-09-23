import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface CreateCostLayerParams {
  itemId: string;
  variantId?: string | null;
  locationId: string;
  batchId?: string | null;
  receiptQuantity: number | Prisma.Decimal;
  unitCost: number | Prisma.Decimal;
  sourceDocument: string;
  sourceDocumentId?: string | null;
}

export interface ConsumeFifoParams {
  itemId: string;
  variantId?: string | null;
  locationId: string;
  quantity: number | Prisma.Decimal;
}

export interface FifoConsumptionResult {
  consumedLayers: Array<{
    layerId: string;
    unitCost: Prisma.Decimal;
    quantity: Prisma.Decimal;
    costAmount: Prisma.Decimal;
  }>;
  totalQuantity: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  averageUnitCost: Prisma.Decimal;
  uncoveredQuantity: Prisma.Decimal;
}

@Injectable()
export class InventoryCostLayersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an inbound inventory cost layer.
   */
  async createLayer(
    organizationId: string,
    params: CreateCostLayerParams,
    existingTx?: Prisma.TransactionClient,
  ) {
    const client = existingTx ?? this.prisma;
    const receiptQty = new Prisma.Decimal(params.receiptQuantity);
    const unitCost = new Prisma.Decimal(params.unitCost);

    if (receiptQty.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Receipt quantity must be strictly positive.',
      );
    }
    if (unitCost.lessThan(0)) {
      throw new BadRequestException('Unit cost cannot be negative.');
    }

    return client.inventoryCostLayer.create({
      data: {
        organizationId,
        itemId: params.itemId,
        variantId: params.variantId ?? null,
        locationId: params.locationId,
        batchId: params.batchId ?? null,
        receiptQuantity: receiptQty,
        unitCost,
        remainingQuantity: receiptQty,
        consumedQuantity: new Prisma.Decimal(0),
        sourceDocument: params.sourceDocument,
        sourceDocumentId: params.sourceDocumentId ?? null,
      },
    });
  }

  /**
   * Consume inventory cost layers using FIFO (First-In, First-Out).
   */
  async consumeFifo(
    organizationId: string,
    params: ConsumeFifoParams,
    existingTx?: Prisma.TransactionClient,
  ): Promise<FifoConsumptionResult> {
    const client = existingTx ?? this.prisma;
    let qtyToConsume = new Prisma.Decimal(params.quantity);

    if (qtyToConsume.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Quantity to consume must be strictly positive.',
      );
    }

    // Query active layers with remaining quantity > 0 ordered chronologically (FIFO)
    const layers = await client.inventoryCostLayer.findMany({
      where: {
        organizationId,
        itemId: params.itemId,
        variantId: params.variantId ? params.variantId : null,
        locationId: params.locationId,
        remainingQuantity: { gt: 0 },
      },
      orderBy: { createdAt: 'asc' },
    });

    const consumedLayers: Array<{
      layerId: string;
      unitCost: Prisma.Decimal;
      quantity: Prisma.Decimal;
      costAmount: Prisma.Decimal;
    }> = [];

    let totalCost = new Prisma.Decimal(0);
    let totalQtyConsumed = new Prisma.Decimal(0);

    for (const layer of layers) {
      if (qtyToConsume.isZero()) break;

      const availableInLayer = layer.remainingQuantity;
      const consumedFromLayer = Prisma.Decimal.min(
        qtyToConsume,
        availableInLayer,
      );
      const layerCostAmount = consumedFromLayer.mul(layer.unitCost);

      const newRemaining = availableInLayer.sub(consumedFromLayer);
      const newConsumed = layer.consumedQuantity.add(consumedFromLayer);

      await client.inventoryCostLayer.update({
        where: { id: layer.id },
        data: {
          remainingQuantity: newRemaining,
          consumedQuantity: newConsumed,
        },
      });

      consumedLayers.push({
        layerId: layer.id,
        unitCost: layer.unitCost,
        quantity: consumedFromLayer,
        costAmount: layerCostAmount,
      });

      totalCost = totalCost.add(layerCostAmount);
      totalQtyConsumed = totalQtyConsumed.add(consumedFromLayer);
      qtyToConsume = qtyToConsume.sub(consumedFromLayer);
    }

    const averageUnitCost = totalQtyConsumed.greaterThan(0)
      ? totalCost.dividedBy(totalQtyConsumed)
      : new Prisma.Decimal(0);

    return {
      consumedLayers,
      totalQuantity: totalQtyConsumed,
      totalCost,
      averageUnitCost,
      uncoveredQuantity: qtyToConsume,
    };
  }

  /**
   * Find cost layers for an item/location with filters.
   */
  async getLayers(
    organizationId: string,
    filter: {
      itemId?: string;
      variantId?: string;
      locationId?: string;
      remainingOnly?: boolean;
      limit?: number;
    },
  ) {
    return this.prisma.inventoryCostLayer.findMany({
      where: {
        organizationId,
        ...(filter.itemId ? { itemId: filter.itemId } : {}),
        ...(filter.variantId ? { variantId: filter.variantId } : {}),
        ...(filter.locationId ? { locationId: filter.locationId } : {}),
        ...(filter.remainingOnly ? { remainingQuantity: { gt: 0 } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filter.limit ?? 50,
      include: {
        item: true,
        variant: true,
        location: true,
        batch: true,
      },
    });
  }
}
