import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BalancesService } from '../../inventory/balances/balances.service';
import { CreateGoodsReceiptDto } from './dto/create-receipt.dto';
import { GoodsReceiptQueryDto } from './dto/receipt-query.dto';
import {
  GoodsReceiptStatus,
  PurchaseOrderStatus,
  StockMovementType,
  TrackingType,
  SerialStatus,
  Prisma,
} from '@prisma/client';

export type GoodsReceiptWithDetails = Prisma.GoodsReceiptGetPayload<{
  include: {
    location: { select: { id: true; code: true; name: true } };
    purchaseOrder: {
      select: {
        id: true;
        poNumber: true;
        status: true;
        supplier: { select: { id: true; code: true; name: true } };
      };
    };
    lines: {
      include: {
        item: {
          select: { id: true; sku: true; name: true; trackingType: true };
        };
        variant: { select: { id: true; sku: true; name: true } };
        purchaseOrderLine: {
          select: {
            id: true;
            quantity: true;
            receivedQuantity: true;
            unitPrice: true;
          };
        };
      };
    };
  };
}>;

@Injectable()
export class GoodsReceiptsService {
  private readonly logger = new Logger(GoodsReceiptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly balancesService: BalancesService,
  ) {}

  /**
   * List goods receipts with pagination and filters.
   */
  async findAll(organizationId: string, query: GoodsReceiptQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Prisma.GoodsReceiptWhereInput = {
      organizationId,
    };

    if (query.status) {
      where.status = query.status;
    }
    if (query.purchaseOrderId) {
      where.purchaseOrderId = query.purchaseOrderId;
    }
    if (query.locationId) {
      where.locationId = query.locationId;
    }
    if (query.search) {
      const searchNormalized = query.search.trim();
      where.OR = [
        { receiptNumber: { contains: searchNormalized, mode: 'insensitive' } },
        { notes: { contains: searchNormalized, mode: 'insensitive' } },
      ];
    }

    const [total, receipts] = await Promise.all([
      this.prisma.goodsReceipt.count({ where }),
      this.prisma.goodsReceipt.findMany({
        where,
        include: {
          location: {
            select: { id: true, code: true, name: true },
          },
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              status: true,
              supplier: { select: { id: true, code: true, name: true } },
            },
          },
          _count: {
            select: { lines: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      receipts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find single goods receipt by ID with lines.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<GoodsReceiptWithDetails> {
    const receipt = await this.prisma.goodsReceipt.findFirst({
      where: { id, organizationId },
      include: {
        location: {
          select: { id: true, code: true, name: true },
        },
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            status: true,
            supplier: { select: { id: true, code: true, name: true } },
          },
        },
        lines: {
          include: {
            item: {
              select: {
                id: true,
                sku: true,
                name: true,
                trackingType: true,
              },
            },
            variant: {
              select: { id: true, sku: true, name: true },
            },
            purchaseOrderLine: {
              select: {
                id: true,
                quantity: true,
                receivedQuantity: true,
                unitPrice: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException(
        `Goods receipt with ID ${id} not found in organization`,
      );
    }

    return receipt;
  }

  /**
   * Create draft goods receipt.
   */
  async createDraft(
    organizationId: string,
    dto: CreateGoodsReceiptDto,
    actorUserId: string,
  ): Promise<GoodsReceiptWithDetails> {
    // 1. Validate PO
    const purchaseOrder = await this.prisma.purchaseOrder.findFirst({
      where: {
        id: dto.purchaseOrderId,
        organizationId,
      },
      include: {
        lines: {
          include: {
            item: true,
            variant: true,
          },
        },
      },
    });

    if (!purchaseOrder) {
      throw new NotFoundException(
        `Purchase order with ID ${dto.purchaseOrderId} not found in organization`,
      );
    }

    if (
      purchaseOrder.status !== PurchaseOrderStatus.APPROVED &&
      purchaseOrder.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
    ) {
      throw new BadRequestException(
        `Purchase order must be in APPROVED or PARTIALLY_RECEIVED status to create receipts. Current status: ${purchaseOrder.status}`,
      );
    }

    const locationId = dto.locationId ?? purchaseOrder.locationId;
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        organizationId,
        isActive: true,
        deletedAt: null,
      },
    });
    if (!location) {
      throw new NotFoundException(
        `Destination location '${locationId}' not found or inactive`,
      );
    }

    // 2. Validate Lines and remaining quantities
    const validatedLines: Array<{
      purchaseOrderLineId: string;
      itemId: string;
      variantId: string | null;
      quantity: Prisma.Decimal;
      unitCost: Prisma.Decimal;
      batchId: string | null;
      serialId: string | null;
      notes: string | null;
    }> = [];

    for (const lineDto of dto.lines) {
      const poLine = purchaseOrder.lines.find(
        (l) => l.id === lineDto.purchaseOrderLineId,
      );

      if (!poLine) {
        throw new NotFoundException(
          `Purchase order line '${lineDto.purchaseOrderLineId}' not found in purchase order '${purchaseOrder.poNumber}'`,
        );
      }

      const receiptQty = new Prisma.Decimal(lineDto.quantity);
      if (receiptQty.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          'Receipt quantity must be strictly greater than 0',
        );
      }

      const remainingQty = poLine.quantity.minus(poLine.receivedQuantity);
      if (receiptQty.greaterThan(remainingQty)) {
        throw new BadRequestException(
          `Receipt quantity ${receiptQty.toString()} exceeds remaining quantity ${remainingQty.toString()} for item '${poLine.item.sku}'`,
        );
      }

      const unitCost =
        lineDto.unitCost !== undefined
          ? new Prisma.Decimal(lineDto.unitCost)
          : poLine.unitPrice;

      let batchId: string | null = lineDto.batchId ?? null;
      let serialId: string | null = lineDto.serialId ?? null;

      // Handle Batch
      if (poLine.item.trackingType === TrackingType.BATCH) {
        if (!batchId && lineDto.batchNumber) {
          const batchNumber = lineDto.batchNumber.trim();
          let batch = await this.prisma.inventoryBatch.findFirst({
            where: {
              organizationId,
              itemId: poLine.itemId,
              variantId: poLine.variantId ?? null,
              locationId,
              batchNumber,
            },
          });

          if (!batch) {
            batch = await this.prisma.inventoryBatch.create({
              data: {
                organizationId,
                itemId: poLine.itemId,
                variantId: poLine.variantId ?? null,
                locationId,
                batchNumber,
                manufacturedAt: lineDto.manufacturedAt
                  ? new Date(lineDto.manufacturedAt)
                  : null,
                expiresAt: lineDto.expiresAt
                  ? new Date(lineDto.expiresAt)
                  : null,
                quantity: new Prisma.Decimal(0),
              },
            });
          }
          batchId = batch.id;
        } else if (!batchId) {
          throw new BadRequestException(
            `Batch number or batch ID is required for batch-tracked item '${poLine.item.sku}'`,
          );
        }
      }

      // Handle Serial
      if (poLine.item.trackingType === TrackingType.SERIAL) {
        if (!receiptQty.equals(1)) {
          throw new BadRequestException(
            `Serial-tracked item '${poLine.item.sku}' must be received in quantity of exactly 1 per line`,
          );
        }

        if (!serialId && lineDto.serialNumber) {
          const serialNumber = lineDto.serialNumber.trim();
          let serial = await this.prisma.inventorySerial.findFirst({
            where: { organizationId, serialNumber },
          });

          if (!serial) {
            serial = await this.prisma.inventorySerial.create({
              data: {
                organizationId,
                itemId: poLine.itemId,
                variantId: poLine.variantId ?? null,
                locationId,
                serialNumber,
                status: SerialStatus.AVAILABLE,
              },
            });
          }
          serialId = serial.id;
        } else if (!serialId) {
          throw new BadRequestException(
            `Serial number or serial ID is required for serial-tracked item '${poLine.item.sku}'`,
          );
        }
      }

      validatedLines.push({
        purchaseOrderLineId: poLine.id,
        itemId: poLine.itemId,
        variantId: poLine.variantId,
        quantity: receiptQty,
        unitCost,
        batchId,
        serialId,
        notes: lineDto.notes?.trim() ?? null,
      });
    }

    // 3. Generate Receipt Number
    let receiptNumber: string;
    try {
      const generated = await this.numberingService.nextNumber(
        organizationId,
        'GOODS_RECEIPT',
        actorUserId,
      );
      receiptNumber = generated.formatted;
    } catch {
      const count = await this.prisma.goodsReceipt.count({
        where: { organizationId },
      });
      receiptNumber = `GR-${String(count + 1).padStart(6, '0')}`;
    }

    // 4. Create in transaction
    const receipt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.goodsReceipt.create({
        data: {
          organizationId,
          receiptNumber,
          purchaseOrderId: dto.purchaseOrderId,
          locationId,
          status: GoodsReceiptStatus.DRAFT,
          receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
          receivedByUserId: actorUserId,
          notes: dto.notes ? dto.notes.trim() : null,
        },
      });

      await tx.goodsReceiptLine.createMany({
        data: validatedLines.map((l) => ({
          ...l,
          goodsReceiptId: created.id,
          organizationId,
        })),
      });

      return tx.goodsReceipt.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          location: {
            select: { id: true, code: true, name: true },
          },
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              status: true,
              supplier: { select: { id: true, code: true, name: true } },
            },
          },
          lines: {
            include: {
              item: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  trackingType: true,
                },
              },
              variant: {
                select: { id: true, sku: true, name: true },
              },
              purchaseOrderLine: {
                select: {
                  id: true,
                  quantity: true,
                  receivedQuantity: true,
                  unitPrice: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'GOODS_RECEIPT_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'goods_receipt.create',
      resource: 'goods_receipt',
      resourceId: receipt.id,
      details: {
        receiptNumber: receipt.receiptNumber,
        poNumber: purchaseOrder.poNumber,
      },
    });

    return receipt;
  }

  /**
   * Atomically post draft goods receipt, apply inventory stock movements, and update PO received quantities.
   * Concurrency-safe and idempotent.
   */
  async postReceipt(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<GoodsReceiptWithDetails> {
    const existing = await this.prisma.goodsReceipt.findFirst({
      where: { id, organizationId },
      include: {
        lines: true,
        purchaseOrder: {
          include: {
            lines: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Goods receipt with ID ${id} not found`);
    }

    if (existing.status === GoodsReceiptStatus.POSTED) {
      throw new BadRequestException('Goods receipt is already posted');
    }

    if (existing.status === GoodsReceiptStatus.CANCELLED) {
      throw new BadRequestException('Cannot post a cancelled goods receipt');
    }

    const po = existing.purchaseOrder;
    if (
      po.status !== PurchaseOrderStatus.APPROVED &&
      po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
    ) {
      throw new BadRequestException(
        `Purchase order must be APPROVED or PARTIALLY_RECEIVED to post receipts. Current status: ${po.status}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Process each line and apply stock movement
      for (const line of existing.lines) {
        const poLine = await tx.purchaseOrderLine.findUniqueOrThrow({
          where: { id: line.purchaseOrderLineId },
        });

        const remaining = poLine.quantity.minus(poLine.receivedQuantity);
        if (line.quantity.greaterThan(remaining)) {
          throw new BadRequestException(
            `Receipt quantity ${line.quantity.toString()} exceeds remaining quantity ${remaining.toString()} for PO line ${poLine.id}`,
          );
        }

        // Apply Stock Movement via centralized M09 engine
        await this.balancesService.applyStockMovement(
          organizationId,
          {
            locationId: existing.locationId,
            itemId: line.itemId,
            variantId: line.variantId ?? undefined,
            movementType: StockMovementType.RECEIPT,
            quantity: Number(line.quantity),
            batchId: line.batchId ?? undefined,
            serialId: line.serialId ?? undefined,
            referenceType: 'GOODS_RECEIPT',
            referenceId: existing.receiptNumber,
            reason: `Goods receipt for PO ${po.poNumber}`,
          },
          actorUserId,
          tx,
        );

        // Increment received quantity on PO Line
        await tx.purchaseOrderLine.update({
          where: { id: poLine.id },
          data: {
            receivedQuantity: {
              increment: line.quantity,
            },
          },
        });
      }

      // 2. Recalculate Purchase Order Status
      const allPoLines = await tx.purchaseOrderLine.findMany({
        where: { purchaseOrderId: po.id },
      });

      const isFullyReceived = allPoLines.every((l) =>
        l.receivedQuantity.greaterThanOrEqualTo(l.quantity),
      );

      const newPoStatus = isFullyReceived
        ? PurchaseOrderStatus.RECEIVED
        : PurchaseOrderStatus.PARTIALLY_RECEIVED;

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: newPoStatus },
      });

      // 3. Mark Receipt as POSTED
      await tx.goodsReceipt.update({
        where: { id },
        data: { status: GoodsReceiptStatus.POSTED },
      });

      return tx.goodsReceipt.findUniqueOrThrow({
        where: { id },
        include: {
          location: {
            select: { id: true, code: true, name: true },
          },
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              status: true,
              supplier: { select: { id: true, code: true, name: true } },
            },
          },
          lines: {
            include: {
              item: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  trackingType: true,
                },
              },
              variant: {
                select: { id: true, sku: true, name: true },
              },
              purchaseOrderLine: {
                select: {
                  id: true,
                  quantity: true,
                  receivedQuantity: true,
                  unitPrice: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'GOODS_RECEIPT_POSTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'goods_receipt.post',
      resource: 'goods_receipt',
      resourceId: updated.id,
      details: {
        receiptNumber: updated.receiptNumber,
        poNumber: po.poNumber,
      },
    });

    return updated;
  }

  /**
   * Cancel draft goods receipt.
   */
  async cancel(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<GoodsReceiptWithDetails> {
    const existing = await this.prisma.goodsReceipt.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(`Goods receipt with ID ${id} not found`);
    }

    if (existing.status !== GoodsReceiptStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT goods receipts can be cancelled. Current status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.goodsReceipt.update({
      where: { id },
      data: { status: GoodsReceiptStatus.CANCELLED },
      include: {
        location: {
          select: { id: true, code: true, name: true },
        },
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            status: true,
            supplier: { select: { id: true, code: true, name: true } },
          },
        },
        lines: {
          include: {
            item: {
              select: {
                id: true,
                sku: true,
                name: true,
                trackingType: true,
              },
            },
            variant: {
              select: { id: true, sku: true, name: true },
            },
            purchaseOrderLine: {
              select: {
                id: true,
                quantity: true,
                receivedQuantity: true,
                unitPrice: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'GOODS_RECEIPT_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'goods_receipt.cancel',
      resource: 'goods_receipt',
      resourceId: updated.id,
      details: { receiptNumber: updated.receiptNumber },
    });

    return updated;
  }
}
