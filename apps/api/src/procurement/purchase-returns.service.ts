import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { CreatePurchaseReturnDto } from './dto/create-return.dto';
import {
  PurchaseReturnStatus,
  StockMovementType,
  Prisma,
} from '@prisma/client';

@Injectable()
export class PurchaseReturnsService {
  private readonly logger = new Logger(PurchaseReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * Create a draft purchase return against a goods receipt.
   */
  async create(
    organizationId: string,
    dto: CreatePurchaseReturnDto,
    userId: string,
  ) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException(
        'Purchase return must contain at least one line item.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const gr = await tx.goodsReceipt.findFirst({
        where: { id: dto.goodsReceiptId, organizationId },
        include: {
          purchaseOrder: true,
          lines: true,
        },
      });

      if (!gr) {
        throw new NotFoundException(
          `Goods receipt with ID ${dto.goodsReceiptId} not found in organization.`,
        );
      }

      if (gr.purchaseOrderId !== dto.purchaseOrderId) {
        throw new BadRequestException(
          `Goods receipt ${gr.receiptNumber} does not belong to purchase order ${dto.purchaseOrderId}.`,
        );
      }

      let returnNumber: string;
      try {
        const seq = await this.numberingService.nextNumber(
          organizationId,
          'PURCHASE_RETURN',
          userId,
        );
        returnNumber = seq.formatted;
      } catch {
        const count = await tx.purchaseReturn.count({
          where: { organizationId },
        });
        returnNumber = `PRN-${String(count + 1).padStart(6, '0')}`;
      }

      const grLineMap = new Map(gr.lines.map((l) => [l.id, l]));

      // Validate lines & quantities
      const linesData = [];
      for (const lineDto of dto.lines) {
        const grLine = grLineMap.get(lineDto.goodsReceiptLineId);
        if (!grLine) {
          throw new BadRequestException(
            `Goods receipt line ${lineDto.goodsReceiptLineId} not found in receipt ${gr.receiptNumber}.`,
          );
        }

        const returnQty = new Prisma.Decimal(lineDto.quantity);
        if (returnQty.lessThanOrEqualTo(0)) {
          throw new BadRequestException(
            'Return quantity must be greater than 0.',
          );
        }

        // Calculate already returned quantity for this GR line
        const existingReturns = await tx.purchaseReturnLine.findMany({
          where: {
            organizationId,
            goodsReceiptLineId: grLine.id,
            purchaseReturn: {
              status: {
                in: [PurchaseReturnStatus.DRAFT, PurchaseReturnStatus.POSTED],
              },
            },
          },
        });

        const totalAlreadyReturned = existingReturns.reduce(
          (sum, ret) => sum.plus(ret.quantity),
          new Prisma.Decimal(0),
        );

        const maxReturnable = grLine.quantity.minus(totalAlreadyReturned);
        if (returnQty.greaterThan(maxReturnable)) {
          throw new BadRequestException(
            `Cannot return ${returnQty.toString()}. Maximum returnable quantity for this line is ${maxReturnable.toString()}.`,
          );
        }

        linesData.push({
          organizationId,
          goodsReceiptLineId: grLine.id,
          itemId: grLine.itemId,
          variantId: grLine.variantId,
          quantity: returnQty,
          unitCost: grLine.unitCost,
        });
      }

      const pReturn = await tx.purchaseReturn.create({
        data: {
          organizationId,
          returnNumber,
          supplierId: gr.supplierId ?? gr.purchaseOrder.supplierId,
          purchaseOrderId: dto.purchaseOrderId,
          goodsReceiptId: dto.goodsReceiptId,
          locationId: gr.locationId,
          returnDate: dto.returnDate ? new Date(dto.returnDate) : new Date(),
          status: PurchaseReturnStatus.DRAFT,
          reason: dto.reason,
          notes: dto.notes,
          createdById: userId,
          lines: {
            create: linesData,
          },
        },
        include: {
          lines: { include: { item: true, variant: true } },
          supplier: true,
          location: true,
          purchaseOrder: true,
          goodsReceipt: true,
        },
      });

      await this.eventBus.publish({
        eventName: 'PURCHASE_RETURN_CREATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'procurement.return.create',
        resource: 'purchase_return',
        resourceId: pReturn.id,
        details: { returnNumber: pReturn.returnNumber },
      });

      return pReturn;
    });
  }

  /**
   * Post purchase return (reverses inventory balance and cost layer).
   */
  async post(organizationId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const pReturn = await tx.purchaseReturn.findFirst({
        where: { id, organizationId },
        include: {
          lines: { include: { goodsReceiptLine: true, item: true } },
          purchaseOrder: true,
          goodsReceipt: true,
        },
      });

      if (!pReturn) {
        throw new NotFoundException(`Purchase return with ID ${id} not found.`);
      }

      if (pReturn.status !== PurchaseReturnStatus.DRAFT) {
        throw new BadRequestException(
          `Cannot post purchase return in status ${pReturn.status}. Must be DRAFT.`,
        );
      }

      for (const line of pReturn.lines) {
        // 1. Create Stock Movement (ISSUE / RETURN)
        const movement = await tx.stockMovement.create({
          data: {
            organizationId,
            itemId: line.itemId,
            variantId: line.variantId,
            locationId: pReturn.locationId,
            movementType: StockMovementType.ISSUE,
            quantity: line.quantity,
            referenceType: 'PURCHASE_RETURN',
            referenceId: pReturn.id,
            reason: `Purchase Return ${pReturn.returnNumber} against GR ${pReturn.goodsReceipt.receiptNumber}`,
            actorUserId: userId,
          },
        });

        // 2. Decrement Inventory Balance
        const invBalance = await tx.inventoryBalance.findFirst({
          where: {
            organizationId,
            itemId: line.itemId,
            variantId: line.variantId ?? null,
            locationId: pReturn.locationId,
          },
        });

        if (invBalance) {
          const newQty = Prisma.Decimal.max(
            0,
            invBalance.quantityOnHand.minus(line.quantity),
          );
          await tx.inventoryBalance.update({
            where: { id: invBalance.id },
            data: {
              quantityOnHand: newQty,
            },
          });
        }

        // Update return line with movement reference
        await tx.purchaseReturnLine.update({
          where: { id: line.id },
          data: { inventoryMovementId: movement.id },
        });
      }

      const updated = await tx.purchaseReturn.update({
        where: { id },
        data: {
          status: PurchaseReturnStatus.POSTED,
          postedAt: new Date(),
        },
        include: {
          lines: { include: { item: true, variant: true } },
          supplier: true,
          location: true,
        },
      });

      await this.eventBus.publish({
        eventName: 'PURCHASE_RETURN_POSTED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'procurement.return.post',
        resource: 'purchase_return',
        resourceId: updated.id,
        details: { returnNumber: updated.returnNumber },
      });

      return updated;
    });
  }

  /**
   * Cancel draft purchase return.
   */
  async cancel(organizationId: string, id: string, userId: string) {
    const pReturn = await this.prisma.purchaseReturn.findFirst({
      where: { id, organizationId },
    });

    if (!pReturn) {
      throw new NotFoundException(`Purchase return with ID ${id} not found.`);
    }

    if (pReturn.status !== PurchaseReturnStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot cancel purchase return in status ${pReturn.status}. Posted returns are immutable.`,
      );
    }

    const updated = await this.prisma.purchaseReturn.update({
      where: { id },
      data: { status: PurchaseReturnStatus.CANCELLED },
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_RETURN_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'procurement.return.cancel',
      resource: 'purchase_return',
      resourceId: updated.id,
      details: { returnNumber: updated.returnNumber },
    });

    return updated;
  }

  /**
   * Find single purchase return by ID.
   */
  async findOne(organizationId: string, id: string) {
    const pReturn = await this.prisma.purchaseReturn.findFirst({
      where: { id, organizationId },
      include: {
        lines: {
          include: { item: true, variant: true, goodsReceiptLine: true },
        },
        supplier: true,
        location: true,
        purchaseOrder: true,
        goodsReceipt: true,
      },
    });

    if (!pReturn) {
      throw new NotFoundException(`Purchase return with ID ${id} not found.`);
    }

    return pReturn;
  }

  /**
   * List purchase returns.
   */
  async findAll(
    organizationId: string,
    query: {
      page?: number;
      limit?: number;
      status?: PurchaseReturnStatus;
      supplierId?: string;
      purchaseOrderId?: string;
      goodsReceiptId?: string;
      search?: string;
    },
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseReturnWhereInput = { organizationId };

    if (query.status) where.status = query.status;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.purchaseOrderId) where.purchaseOrderId = query.purchaseOrderId;
    if (query.goodsReceiptId) where.goodsReceiptId = query.goodsReceiptId;

    if (query.search) {
      where.OR = [
        { returnNumber: { contains: query.search, mode: 'insensitive' } },
        { reason: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, returns] = await Promise.all([
      this.prisma.purchaseReturn.count({ where }),
      this.prisma.purchaseReturn.findMany({
        where,
        include: {
          supplier: true,
          location: true,
          purchaseOrder: { select: { id: true, poNumber: true } },
          goodsReceipt: { select: { id: true, receiptNumber: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { returns, total, page, limit };
  }
}
