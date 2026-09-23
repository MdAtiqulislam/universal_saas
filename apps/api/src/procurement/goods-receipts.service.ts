import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { CostingService } from '../inventory/costing/costing.service';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import {
  PurchaseOrderStatus,
  GoodsReceiptStatus,
  StockMovementType,
  TrackingType,
  Prisma,
} from '@prisma/client';

@Injectable()
export class ProcurementGoodsReceiptsService {
  private readonly logger = new Logger(ProcurementGoodsReceiptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly costingService: CostingService,
  ) {}

  /**
   * Receive goods against a purchase order.
   * Atomically updates PO lines, stock balances, movements, cost layers, and GL entries.
   */
  async receivePurchaseOrder(
    organizationId: string,
    purchaseOrderId: string,
    dto: ReceivePurchaseOrderDto,
    userId: string,
  ) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException(
        'Receipt must contain at least one line item.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch PO with lines and related data
      const po = await tx.purchaseOrder.findFirst({
        where: { id: purchaseOrderId, organizationId },
        include: {
          supplier: true,
          location: true,
          currency: true,
          lines: {
            include: { item: true, variant: true },
          },
        },
      });

      if (!po) {
        throw new NotFoundException(
          `Purchase order with ID ${purchaseOrderId} not found.`,
        );
      }

      if (
        po.status !== PurchaseOrderStatus.APPROVED &&
        po.status !== PurchaseOrderStatus.SENT &&
        po.status !== PurchaseOrderStatus.ACKNOWLEDGED &&
        po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
      ) {
        throw new BadRequestException(
          `Cannot receive goods for purchase order in status ${po.status}. Must be APPROVED, SENT, ACKNOWLEDGED, or PARTIALLY_RECEIVED.`,
        );
      }

      // Generate Receipt Number
      let receiptNumber: string;
      try {
        const seq = await this.numberingService.nextNumber(
          organizationId,
          'GOODS_RECEIPT',
          userId,
        );
        receiptNumber = seq.formatted;
      } catch {
        const count = await tx.goodsReceipt.count({
          where: { organizationId },
        });
        receiptNumber = `GR-${String(count + 1).padStart(6, '0')}`;
      }

      const receiptDate = dto.receivedAt
        ? new Date(dto.receivedAt)
        : new Date();

      // Create GoodsReceipt header
      const goodsReceipt = await tx.goodsReceipt.create({
        data: {
          organizationId,
          receiptNumber,
          purchaseOrderId: po.id,
          supplierId: po.supplierId,
          locationId: po.locationId,
          status: GoodsReceiptStatus.POSTED,
          receivedAt: receiptDate,
          receivedByUserId: userId,
          notes: dto.notes,
        },
      });

      const poLineMap = new Map(po.lines.map((l) => [l.id, l]));

      for (const lineDto of dto.lines) {
        const poLine = poLineMap.get(lineDto.purchaseOrderLineId);
        if (!poLine) {
          throw new BadRequestException(
            `Purchase order line ${lineDto.purchaseOrderLineId} not found in PO ${po.poNumber}.`,
          );
        }

        const receiveQty = new Prisma.Decimal(lineDto.quantity);
        if (receiveQty.lessThanOrEqualTo(0)) {
          throw new BadRequestException(
            'Received quantity must be greater than 0.',
          );
        }

        // Check for over-receipt
        const currentRemaining = poLine.quantity
          .minus(poLine.receivedQuantity)
          .minus(poLine.cancelledQuantity);

        if (receiveQty.greaterThan(currentRemaining)) {
          throw new BadRequestException(
            `Cannot receive ${receiveQty.toString()} for item ${poLine.item.sku}. Maximum remaining quantity is ${currentRemaining.toString()}. Over-receipt is not allowed.`,
          );
        }

        // Batch / Serial tracking handling
        let batchId: string | null = null;
        let serialId: string | null = null;

        if (poLine.item.trackingType === TrackingType.BATCH) {
          if (!lineDto.batchNumber) {
            throw new BadRequestException(
              `Item ${poLine.item.sku} requires a batch number on receipt.`,
            );
          }
          let batch = await tx.inventoryBatch.findFirst({
            where: {
              organizationId,
              itemId: poLine.itemId,
              variantId: poLine.variantId ?? null,
              locationId: po.locationId,
              batchNumber: lineDto.batchNumber,
            },
          });
          if (!batch) {
            batch = await tx.inventoryBatch.create({
              data: {
                organizationId,
                itemId: poLine.itemId,
                variantId: poLine.variantId,
                locationId: po.locationId,
                batchNumber: lineDto.batchNumber,
                expiresAt: lineDto.batchExpiryDate
                  ? new Date(lineDto.batchExpiryDate)
                  : null,
                quantity: receiveQty,
              },
            });
          } else {
            await tx.inventoryBatch.update({
              where: { id: batch.id },
              data: { quantity: batch.quantity.plus(receiveQty) },
            });
          }
          batchId = batch.id;
        } else if (poLine.item.trackingType === TrackingType.SERIAL) {
          if (
            !lineDto.serialNumbers ||
            lineDto.serialNumbers.length !== Number(receiveQty.toString())
          ) {
            throw new BadRequestException(
              `Item ${poLine.item.sku} requires exactly ${receiveQty.toString()} serial number(s). Provided: ${lineDto.serialNumbers?.length ?? 0}.`,
            );
          }
          for (const sNum of lineDto.serialNumbers) {
            const existingSerial = await tx.inventorySerial.findFirst({
              where: {
                organizationId,
                itemId: poLine.itemId,
                serialNumber: sNum,
              },
            });
            if (existingSerial) {
              throw new BadRequestException(
                `Serial number ${sNum} already exists in organization.`,
              );
            }
            const newSerial = await tx.inventorySerial.create({
              data: {
                organizationId,
                itemId: poLine.itemId,
                variantId: poLine.variantId,
                locationId: po.locationId,
                serialNumber: sNum,
              },
            });
            serialId = newSerial.id;
          }
        }

        // 1. Stock Movement (M09)
        const movement = await tx.stockMovement.create({
          data: {
            organizationId,
            itemId: poLine.itemId,
            variantId: poLine.variantId,
            locationId: po.locationId,
            movementType: StockMovementType.RECEIPT,
            quantity: receiveQty,
            batchId,
            serialId,
            referenceType: 'GOODS_RECEIPT',
            referenceId: goodsReceipt.id,
            reason: lineDto.notes ?? `Receipt against PO ${po.poNumber}`,
            actorUserId: userId,
          },
        });

        // 2. Inventory Balance (M09)
        const invBalance = await tx.inventoryBalance.findFirst({
          where: {
            organizationId,
            itemId: poLine.itemId,
            variantId: poLine.variantId ?? null,
            locationId: po.locationId,
          },
        });

        if (invBalance) {
          await tx.inventoryBalance.update({
            where: { id: invBalance.id },
            data: {
              quantityOnHand: invBalance.quantityOnHand.plus(receiveQty),
            },
          });
        } else {
          await tx.inventoryBalance.create({
            data: {
              organizationId,
              itemId: poLine.itemId,
              variantId: poLine.variantId,
              locationId: po.locationId,
              quantityOnHand: receiveQty,
              quantityReserved: new Prisma.Decimal(0),
            },
          });
        }

        // 3. Inventory Cost Layer (M19)
        const costLayer = await tx.inventoryCostLayer.create({
          data: {
            organizationId,
            itemId: poLine.itemId,
            variantId: poLine.variantId,
            locationId: po.locationId,
            batchId,
            receiptQuantity: receiveQty,
            remainingQuantity: receiveQty,
            consumedQuantity: new Prisma.Decimal(0),
            unitCost: poLine.unitPrice,
            sourceDocument: 'GOODS_RECEIPT',
            sourceDocumentId: goodsReceipt.id,
          },
        });

        // 4. Create GoodsReceiptLine
        await tx.goodsReceiptLine.create({
          data: {
            organizationId,
            goodsReceiptId: goodsReceipt.id,
            purchaseOrderLineId: poLine.id,
            itemId: poLine.itemId,
            variantId: poLine.variantId,
            quantity: receiveQty,
            unitCost: poLine.unitPrice,
            batchId,
            serialId,
            inventoryMovementId: movement.id,
            costLayerId: costLayer.id,
            notes: lineDto.notes,
          },
        });

        // 5. Update PO Line Quantities
        const updatedReceivedQty = poLine.receivedQuantity.plus(receiveQty);
        const updatedRemainingQty = poLine.quantity
          .minus(updatedReceivedQty)
          .minus(poLine.cancelledQuantity);

        await tx.purchaseOrderLine.update({
          where: { id: poLine.id },
          data: {
            receivedQuantity: updatedReceivedQty,
            remainingQuantity: updatedRemainingQty,
          },
        });
      }

      // Check overall PO fulfillment
      const allLines = await tx.purchaseOrderLine.findMany({
        where: { purchaseOrderId: po.id },
      });

      const isFullyReceived = allLines.every((l) =>
        l.remainingQuantity.lessThanOrEqualTo(0),
      );

      const newPoStatus = isFullyReceived
        ? PurchaseOrderStatus.RECEIVED
        : PurchaseOrderStatus.PARTIALLY_RECEIVED;

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: newPoStatus },
      });

      const resultGR = await tx.goodsReceipt.findFirst({
        where: { id: goodsReceipt.id },
        include: {
          lines: { include: { item: true, variant: true } },
          purchaseOrder: true,
          supplier: true,
          location: true,
        },
      });

      await this.eventBus.publish({
        eventName: 'GOODS_RECEIPT_POSTED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'procurement.receipt.post',
        resource: 'goods_receipt',
        resourceId: goodsReceipt.id,
        details: {
          receiptNumber: goodsReceipt.receiptNumber,
          poNumber: po.poNumber,
          newPoStatus,
        },
      });

      return resultGR;
    });
  }

  /**
   * Find single goods receipt by ID.
   */
  async findOne(organizationId: string, id: string) {
    const gr = await this.prisma.goodsReceipt.findFirst({
      where: { id, organizationId },
      include: {
        purchaseOrder: { include: { lines: true } },
        supplier: true,
        location: true,
        lines: {
          include: { item: true, variant: true, batch: true, serial: true },
        },
        returns: { include: { lines: true } },
      },
    });

    if (!gr) {
      throw new NotFoundException(`Goods receipt with ID ${id} not found.`);
    }

    return gr;
  }

  /**
   * List goods receipts.
   */
  async findAll(
    organizationId: string,
    query: {
      page?: number;
      limit?: number;
      status?: GoodsReceiptStatus;
      purchaseOrderId?: string;
      supplierId?: string;
      locationId?: string;
      search?: string;
    },
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Prisma.GoodsReceiptWhereInput = { organizationId };

    if (query.status) where.status = query.status;
    if (query.purchaseOrderId) where.purchaseOrderId = query.purchaseOrderId;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.locationId) where.locationId = query.locationId;

    if (query.search) {
      where.OR = [
        { receiptNumber: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, receipts] = await Promise.all([
      this.prisma.goodsReceipt.count({ where }),
      this.prisma.goodsReceipt.findMany({
        where,
        include: {
          purchaseOrder: { select: { id: true, poNumber: true, status: true } },
          supplier: true,
          location: true,
          _count: { select: { lines: true, returns: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { receipts, total, page, limit };
  }

  /**
   * Cancel draft goods receipt (posted receipts are immutable).
   */
  async cancel(organizationId: string, id: string) {
    const gr = await this.findOne(organizationId, id);

    if (gr.status === GoodsReceiptStatus.POSTED) {
      throw new BadRequestException(
        'Posted Goods Receipts are immutable and cannot be cancelled directly. Use Purchase Returns to return received goods.',
      );
    }

    const updated = await this.prisma.goodsReceipt.update({
      where: { id },
      data: { status: GoodsReceiptStatus.CANCELLED },
    });

    return updated;
  }
}
