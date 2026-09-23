import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  Prisma,
  StockMovementType,
  TrackingType,
  SerialStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { BalanceQueryDto } from './dto/balance-query.dto';
import { InventoryBalance, StockMovement } from '@prisma/client';

export interface StockMovementParams {
  itemId: string;
  variantId?: string | null;
  locationId: string;
  movementType: StockMovementType;
  quantity: number;
  batchId?: string | null;
  serialId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
}

export interface StockMovementResult {
  balance: InventoryBalance;
  movement: StockMovement;
}

@Injectable()
export class BalancesService {
  private readonly logger = new Logger(BalancesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Centralized transactional stock mutation engine.
   */
  async applyStockMovement(
    organizationId: string,
    params: StockMovementParams,
    actorUserId?: string,
    existingTx?: Prisma.TransactionClient,
  ): Promise<StockMovementResult> {
    const execute = async (
      tx: Prisma.TransactionClient,
    ): Promise<StockMovementResult> => {
      // 1. Quantity validation
      if (params.quantity <= 0) {
        throw new BadRequestException(
          'Movement quantity must be strictly greater than 0',
        );
      }

      const qtyDecimal = new Prisma.Decimal(params.quantity.toFixed(4));

      // 2. Validate Item in Tenant
      const item = await tx.item.findFirst({
        where: {
          id: params.itemId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!item) {
        throw new NotFoundException(
          `Item with ID '${params.itemId}' not found in organization`,
        );
      }

      if (!item.isActive) {
        throw new BadRequestException(
          `Cannot perform inventory movements on inactive item '${item.sku}'`,
        );
      }

      // 3. Validate Variant if provided
      if (params.variantId) {
        const variant = await tx.itemVariant.findFirst({
          where: {
            id: params.variantId,
            itemId: params.itemId,
            organizationId,
            deletedAt: null,
          },
        });

        if (!variant) {
          throw new NotFoundException(
            `Item variant with ID '${params.variantId}' not found for item '${item.sku}'`,
          );
        }

        if (!variant.isActive) {
          throw new BadRequestException(
            `Cannot perform inventory movements on inactive variant '${variant.sku}'`,
          );
        }
      }

      // 4. Validate Location in Tenant
      const location = await tx.location.findFirst({
        where: {
          id: params.locationId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!location) {
        throw new NotFoundException(
          `Location with ID '${params.locationId}' not found in organization`,
        );
      }

      if (!location.isActive) {
        throw new BadRequestException(
          `Cannot perform inventory movements on inactive location '${location.code}'`,
        );
      }

      // 5. Validate Tracking Type Invariants
      const outflowMovementTypes: StockMovementType[] = [
        StockMovementType.ISSUE,
        StockMovementType.ADJUSTMENT_OUT,
        StockMovementType.TRANSFER_OUT,
      ];
      const isOutflow = outflowMovementTypes.includes(params.movementType);

      if (item.trackingType === TrackingType.NONE) {
        if (params.batchId || params.serialId) {
          throw new BadRequestException(
            `Item '${item.sku}' does not use batch or serial tracking`,
          );
        }
      } else if (item.trackingType === TrackingType.BATCH) {
        if (!params.batchId) {
          throw new BadRequestException(
            `Batch ID is required for batch-tracked item '${item.sku}'`,
          );
        }

        const batch = await tx.inventoryBatch.findFirst({
          where: {
            id: params.batchId,
            organizationId,
            itemId: params.itemId,
            variantId: params.variantId ?? null,
            locationId: params.locationId,
          },
        });

        if (!batch) {
          throw new BadRequestException(
            `Batch '${params.batchId}' not found for item at location '${location.code}'`,
          );
        }

        if (isOutflow && batch.quantity.lessThan(qtyDecimal)) {
          throw new BadRequestException(
            `Insufficient stock in batch '${batch.batchNumber}'. Available: ${batch.quantity.toString()}, requested: ${qtyDecimal.toString()}`,
          );
        }
      } else if (item.trackingType === TrackingType.SERIAL) {
        if (!params.serialId) {
          throw new BadRequestException(
            `Serial ID is required for serial-tracked item '${item.sku}'`,
          );
        }

        if (params.quantity !== 1) {
          throw new BadRequestException(
            'Serial tracking movements must have a quantity of exactly 1',
          );
        }

        const serial = await tx.inventorySerial.findFirst({
          where: {
            id: params.serialId,
            organizationId,
            itemId: params.itemId,
            variantId: params.variantId ?? null,
          },
        });

        if (!serial) {
          throw new BadRequestException(
            `Serial '${params.serialId}' not found for item in organization`,
          );
        }

        if (isOutflow) {
          if (serial.locationId !== params.locationId) {
            throw new BadRequestException(
              `Serial '${serial.serialNumber}' is not currently at location '${location.code}'`,
            );
          }
          if (serial.status !== SerialStatus.AVAILABLE) {
            throw new BadRequestException(
              `Serial '${serial.serialNumber}' is not available (status: ${serial.status})`,
            );
          }
        }
      }

      // 6. Find or Create Inventory Balance
      let balance = await tx.inventoryBalance.findFirst({
        where: {
          organizationId,
          locationId: params.locationId,
          itemId: params.itemId,
          variantId: params.variantId ?? null,
        },
      });

      if (!balance) {
        balance = await tx.inventoryBalance.create({
          data: {
            organizationId,
            locationId: params.locationId,
            itemId: params.itemId,
            variantId: params.variantId ?? null,
            quantityOnHand: new Prisma.Decimal('0.0000'),
            quantityReserved: new Prisma.Decimal('0.0000'),
          },
        });
      }

      // 7. Calculate New Quantity
      const currentOnHand = balance.quantityOnHand;
      const newOnHand = isOutflow
        ? currentOnHand.minus(qtyDecimal)
        : currentOnHand.plus(qtyDecimal);

      if (newOnHand.isNegative()) {
        throw new BadRequestException(
          `Insufficient stock at location '${location.code}'. Current on-hand: ${currentOnHand.toString()}, requested outflow: ${qtyDecimal.toString()}`,
        );
      }

      // 8. Update Balance
      const updatedBalance = await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: { quantityOnHand: newOnHand },
      });

      // 9. Update Batch Quantity if BATCH tracking
      if (item.trackingType === TrackingType.BATCH && params.batchId) {
        const batch = await tx.inventoryBatch.findUnique({
          where: { id: params.batchId },
        });

        if (batch) {
          const newBatchQty = isOutflow
            ? batch.quantity.minus(qtyDecimal)
            : batch.quantity.plus(qtyDecimal);

          await tx.inventoryBatch.update({
            where: { id: params.batchId },
            data: { quantity: newBatchQty },
          });
        }
      }

      // 10. Update Serial Status/Location if SERIAL tracking
      if (item.trackingType === TrackingType.SERIAL && params.serialId) {
        let newStatus: SerialStatus = SerialStatus.AVAILABLE;
        if (params.movementType === StockMovementType.ISSUE) {
          newStatus = SerialStatus.SOLD;
        } else if (params.movementType === StockMovementType.ADJUSTMENT_OUT) {
          newStatus = SerialStatus.LOST;
        } else if (params.movementType === StockMovementType.TRANSFER_OUT) {
          newStatus = SerialStatus.TRANSFERRED;
        } else if (
          params.movementType === StockMovementType.RECEIPT ||
          params.movementType === StockMovementType.ADJUSTMENT_IN ||
          params.movementType === StockMovementType.TRANSFER_IN
        ) {
          newStatus = SerialStatus.AVAILABLE;
        }

        await tx.inventorySerial.update({
          where: { id: params.serialId },
          data: {
            status: newStatus,
            locationId: params.locationId,
          },
        });
      }

      // 11. Create Immutable Stock Movement Ledger Entry
      const movement = await tx.stockMovement.create({
        data: {
          organizationId,
          itemId: params.itemId,
          variantId: params.variantId ?? null,
          locationId: params.locationId,
          movementType: params.movementType,
          quantity: qtyDecimal,
          batchId: params.batchId ?? null,
          serialId: params.serialId ?? null,
          referenceType: params.referenceType ?? null,
          referenceId: params.referenceId ?? null,
          reason: params.reason ?? null,
          actorUserId: actorUserId ?? null,
        },
      });

      return { balance: updatedBalance, movement };
    };

    let result: StockMovementResult;
    if (existingTx) {
      result = await execute(existingTx);
    } else {
      result = await this.prisma.$transaction(execute);
    }

    // 12. Publish Domain Event
    await this.eventBus.publish({
      eventName: isOutflowEvent(params.movementType)
        ? 'STOCK_ISSUED'
        : params.movementType === StockMovementType.ADJUSTMENT_IN ||
            params.movementType === StockMovementType.ADJUSTMENT_OUT
          ? 'INVENTORY_ADJUSTED'
          : 'STOCK_RECEIVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: `stock.${params.movementType.toLowerCase()}`,
      resource: 'stock_movement',
      resourceId: result.movement.id,
      details: {
        itemId: params.itemId,
        variantId: params.variantId,
        locationId: params.locationId,
        movementType: params.movementType,
        quantity: params.quantity,
        newOnHand: result.balance.quantityOnHand.toString(),
      },
    });

    return result;
  }

  /**
   * List inventory balances with filters, availability calculation, and pagination.
   */
  async findAll(organizationId: string, query: BalanceQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { organizationId };

    if (query.locationId) {
      where.locationId = query.locationId;
    }

    if (query.itemId) {
      where.itemId = query.itemId;
    }

    if (query.variantId) {
      where.variantId = query.variantId;
    }

    const [total, balances] = await Promise.all([
      this.prisma.inventoryBalance.count({ where }),
      this.prisma.inventoryBalance.findMany({
        where,
        include: {
          location: {
            select: { id: true, code: true, name: true, type: true },
          },
          item: {
            select: {
              id: true,
              sku: true,
              name: true,
              itemType: true,
              trackingType: true,
            },
          },
          variant: {
            select: { id: true, sku: true, name: true, attributes: true },
          },
        },
        orderBy: [{ itemId: 'asc' }, { locationId: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    const formatted = balances.map((b) => {
      const onHand = b.quantityOnHand;
      const reserved = b.quantityReserved;
      const available = onHand.minus(reserved);

      return {
        ...b,
        quantityAvailable: available.toString(),
        quantityOnHand: onHand.toString(),
        quantityReserved: reserved.toString(),
      };
    });

    return {
      balances: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all location balances for a specific item.
   */
  async findOneByItem(organizationId: string, itemId: string) {
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

    const balances = await this.prisma.inventoryBalance.findMany({
      where: {
        organizationId,
        itemId,
      },
      include: {
        location: {
          select: { id: true, code: true, name: true, type: true },
        },
        variant: {
          select: { id: true, sku: true, name: true },
        },
      },
    });

    return balances.map((b) => ({
      ...b,
      quantityAvailable: b.quantityOnHand.minus(b.quantityReserved).toString(),
      quantityOnHand: b.quantityOnHand.toString(),
      quantityReserved: b.quantityReserved.toString(),
    }));
  }
}

function isOutflowEvent(movementType: StockMovementType): boolean {
  const outflowEventTypes: StockMovementType[] = [
    StockMovementType.ISSUE,
    StockMovementType.TRANSFER_OUT,
  ];
  return outflowEventTypes.includes(movementType);
}
