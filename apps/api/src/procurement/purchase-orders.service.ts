import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BudgetControlService } from '../accounting/budgets/budget-control.service';
import { TaxCalculationService } from '../tax/tax-calculation.service';
import {
  CreateProcurementPurchaseOrderDto,
  UpdateProcurementPurchaseOrderDto,
  AcknowledgePurchaseOrderDto,
} from './dto/create-purchase-order.dto';
import { ProcurementPOQueryDto } from './dto/purchase-order-query.dto';
import {
  PurchaseOrderStatus,
  BudgetControlResult,
  BudgetControlPolicy,
  Prisma,
} from '@prisma/client';

@Injectable()
export class ProcurementPurchaseOrdersService {
  private readonly logger = new Logger(ProcurementPurchaseOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly budgetControlService: BudgetControlService,
    private readonly taxCalculationService: TaxCalculationService,
  ) {}

  /**
   * Create a new purchase order.
   */
  async create(
    organizationId: string,
    dto: CreateProcurementPurchaseOrderDto,
    userId: string,
  ) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException(
        'Purchase order must contain at least one line item.',
      );
    }

    // Verify supplier
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, organizationId },
    });
    if (!supplier) {
      throw new NotFoundException(
        `Supplier with ID ${dto.supplierId} not found in organization.`,
      );
    }

    // Verify location
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, organizationId },
    });
    if (!location) {
      throw new NotFoundException(
        `Location with ID ${dto.locationId} not found in organization.`,
      );
    }

    // Generate PO Number
    let poNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'PURCHASE_ORDER',
        userId,
      );
      poNumber = seq.formatted;
    } catch {
      const count = await this.prisma.purchaseOrder.count({
        where: { organizationId },
      });
      poNumber = `PO-${String(count + 1).padStart(6, '0')}`;
    }

    let subtotal = new Prisma.Decimal(0);
    let discountTotal = new Prisma.Decimal(0);
    let taxTotal = new Prisma.Decimal(0);

    const linesData = dto.lines.map((line) => {
      const qty = new Prisma.Decimal(line.quantity);
      const unitPrice = new Prisma.Decimal(line.unitPrice);
      const discount = new Prisma.Decimal(line.discountAmount ?? 0);
      const taxRate = new Prisma.Decimal(line.taxRate ?? 0);

      // Line calculations: LineTotal = (Qty * UnitPrice) - Discount
      const lineSubtotal = qty.times(unitPrice).minus(discount);
      const lineTax = lineSubtotal.times(taxRate.dividedBy(100));
      const lineTotal = lineSubtotal.plus(lineTax);

      subtotal = subtotal.plus(qty.times(unitPrice));
      discountTotal = discountTotal.plus(discount);
      taxTotal = taxTotal.plus(lineTax);

      return {
        organizationId,
        itemId: line.itemId,
        variantId: line.variantId,
        description: line.description,
        quantity: qty,
        unitPrice,
        discountAmount: discount,
        taxRate,
        taxAmount: lineTax,
        lineTotal,
        receivedQuantity: new Prisma.Decimal(0),
        cancelledQuantity: new Prisma.Decimal(0),
        remainingQuantity: qty,
        requiredDate: line.requiredDate ? new Date(line.requiredDate) : null,
        expectedReceiptDate: line.expectedReceiptDate
          ? new Date(line.expectedReceiptDate)
          : null,
      };
    });

    const shippingTotal = new Prisma.Decimal(dto.shippingTotal ?? 0);
    const grandTotal = subtotal
      .minus(discountTotal)
      .plus(taxTotal)
      .plus(shippingTotal);

    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          organizationId,
          poNumber,
          supplierId: dto.supplierId,
          locationId: dto.locationId,
          currencyId: dto.currencyId,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
          paymentTermsDays:
            dto.paymentTermsDays ?? supplier.paymentTermsDays ?? 0,
          status: PurchaseOrderStatus.DRAFT,
          notes: dto.notes,
          supplierReference: dto.supplierReference,
          shippingTerms: dto.shippingTerms,
          requisitionId: dto.requisitionId,
          plannedOrderId: dto.plannedOrderId,
          subtotal,
          discountTotal,
          taxTotal,
          shippingTotal,
          grandTotal,
          createdByUserId: userId,
          lines: {
            create: linesData,
          },
        },
        include: {
          supplier: true,
          location: true,
          currency: true,
          lines: { include: { item: true, variant: true } },
        },
      });

      await this.eventBus.publish({
        eventName: 'PURCHASE_ORDER_CREATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'procurement.order.create',
        resource: 'purchase_order',
        resourceId: po.id,
        details: {
          poNumber: po.poNumber,
          grandTotal: po.grandTotal.toString(),
          lineCount: po.lines.length,
        },
      });

      return po;
    });
  }

  /**
   * List purchase orders with filtering and pagination.
   */
  async findAll(organizationId: string, query: ProcurementPOQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseOrderWhereInput = { organizationId };

    if (query.status) where.status = query.status;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.requisitionId) where.requisitionId = query.requisitionId;
    if (query.plannedOrderId) where.plannedOrderId = query.plannedOrderId;

    if (query.startDate || query.endDate) {
      where.orderDate = {};
      if (query.startDate) where.orderDate.gte = new Date(query.startDate);
      if (query.endDate) where.orderDate.lte = new Date(query.endDate);
    }

    if (query.search) {
      where.OR = [
        { poNumber: { contains: query.search, mode: 'insensitive' } },
        { supplierReference: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, orders] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          location: true,
          currency: true,
          requisition: true,
          _count: {
            select: { lines: true, goodsReceipts: true, returns: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { orders, total, page, limit };
  }

  /**
   * Find single purchase order by ID.
   */
  async findOne(organizationId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: {
        supplier: true,
        location: true,
        currency: true,
        requisition: true,
        plannedOrder: true,
        lines: { include: { item: true, variant: true } },
        goodsReceipts: { include: { lines: true } },
        returns: { include: { lines: true } },
      },
    });

    if (!po) {
      throw new NotFoundException(`Purchase order with ID ${id} not found.`);
    }

    return po;
  }

  /**
   * Update draft purchase order.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateProcurementPurchaseOrderDto,
  ) {
    const po = await this.findOne(organizationId, id);

    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot modify purchase order in status ${po.status}. Must be in DRAFT status.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      let subtotal = po.subtotal;
      let discountTotal = po.discountTotal;
      let taxTotal = po.taxTotal;

      if (dto.lines && dto.lines.length > 0) {
        await tx.purchaseOrderLine.deleteMany({
          where: { purchaseOrderId: id },
        });

        subtotal = new Prisma.Decimal(0);
        discountTotal = new Prisma.Decimal(0);
        taxTotal = new Prisma.Decimal(0);

        for (const line of dto.lines) {
          const qty = new Prisma.Decimal(line.quantity);
          const unitPrice = new Prisma.Decimal(line.unitPrice);
          const discount = new Prisma.Decimal(line.discountAmount ?? 0);
          const taxRate = new Prisma.Decimal(line.taxRate ?? 0);

          const lineSubtotal = qty.times(unitPrice).minus(discount);
          const lineTax = lineSubtotal.times(taxRate.dividedBy(100));
          const lineTotal = lineSubtotal.plus(lineTax);

          subtotal = subtotal.plus(qty.times(unitPrice));
          discountTotal = discountTotal.plus(discount);
          taxTotal = taxTotal.plus(lineTax);

          await tx.purchaseOrderLine.create({
            data: {
              purchaseOrderId: id,
              organizationId,
              itemId: line.itemId,
              variantId: line.variantId,
              description: line.description,
              quantity: qty,
              unitPrice,
              discountAmount: discount,
              taxRate,
              taxAmount: lineTax,
              lineTotal,
              receivedQuantity: new Prisma.Decimal(0),
              cancelledQuantity: new Prisma.Decimal(0),
              remainingQuantity: qty,
              requiredDate: line.requiredDate
                ? new Date(line.requiredDate)
                : null,
              expectedReceiptDate: line.expectedReceiptDate
                ? new Date(line.expectedReceiptDate)
                : null,
            },
          });
        }
      }

      const shippingTotal =
        dto.shippingTotal !== undefined
          ? new Prisma.Decimal(dto.shippingTotal)
          : po.shippingTotal;

      const grandTotal = subtotal
        .minus(discountTotal)
        .plus(taxTotal)
        .plus(shippingTotal);

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: dto.supplierId,
          locationId: dto.locationId,
          currencyId: dto.currencyId,
          expectedDate: dto.expectedDate
            ? new Date(dto.expectedDate)
            : undefined,
          paymentTermsDays: dto.paymentTermsDays,
          notes: dto.notes,
          supplierReference: dto.supplierReference,
          shippingTerms: dto.shippingTerms,
          shippingTotal,
          subtotal,
          discountTotal,
          taxTotal,
          grandTotal,
        },
        include: {
          supplier: true,
          location: true,
          currency: true,
          lines: { include: { item: true, variant: true } },
        },
      });

      return updated;
    });
  }

  /**
   * Submit purchase order for approval.
   */
  async submit(organizationId: string, id: string, userId: string) {
    const po = await this.findOne(organizationId, id);

    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot submit purchase order in status ${po.status}. Must be in DRAFT status.`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.SUBMITTED },
      include: { lines: true },
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_ORDER_SUBMITTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'procurement.order.submit',
      resource: 'purchase_order',
      resourceId: updated.id,
      details: { poNumber: updated.poNumber },
    });

    return updated;
  }

  /**
   * Approve purchase order with M23 Budget Control check.
   */
  async approve(organizationId: string, id: string, userId: string) {
    const po = await this.findOne(organizationId, id);

    if (
      po.status !== PurchaseOrderStatus.SUBMITTED &&
      po.status !== PurchaseOrderStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Cannot approve purchase order in status ${po.status}. Must be in SUBMITTED or DRAFT status.`,
      );
    }

    // Budget Control Check (M23 integration)
    try {
      const budgetAccount = await this.prisma.account.findFirst({
        where: {
          organizationId,
          type: { in: ['EXPENSE', 'ASSET', 'LIABILITY'] },
          isActive: true,
        },
      });

      if (budgetAccount) {
        const budgetCheck =
          await this.budgetControlService.checkBudgetAvailability(
            organizationId,
            {
              accountId: budgetAccount.id,
              date: po.orderDate.toISOString(),
              amount: Number(po.grandTotal.toString()),
            },
            userId,
          );

        if (budgetCheck.result === BudgetControlResult.EXCEEDED) {
          await this.eventBus.publish({
            eventName: 'PURCHASE_ORDER_BUDGET_EXCEEDED',
            occurredAt: new Date(),
            organizationId,
            actorUserId: userId,
            action: 'procurement.order.budget_check',
            resource: 'purchase_order',
            resourceId: po.id,
            details: {
              poNumber: po.poNumber,
              policy: budgetCheck.policy,
              proposedAmount: budgetCheck.proposedAmount,
              remainingAmount: budgetCheck.remainingAmount,
            },
          });

          if (budgetCheck.policy === BudgetControlPolicy.BLOCK) {
            throw new BadRequestException(
              `Budget exceeded for Purchase Order ${po.poNumber}. Policy is set to BLOCK. (Remaining: ${budgetCheck.remainingAmount})`,
            );
          } else {
            this.logger.warn(
              `Purchase Order ${po.poNumber} exceeds budget under WARN policy.`,
            );
          }
        } else {
          await this.eventBus.publish({
            eventName: 'PURCHASE_ORDER_BUDGET_CHECKED',
            occurredAt: new Date(),
            organizationId,
            actorUserId: userId,
            action: 'procurement.order.budget_check',
            resource: 'purchase_order',
            resourceId: po.id,
            details: { poNumber: po.poNumber, result: budgetCheck.result },
          });
        }
      }
    } catch (err: unknown) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(
        `Budget control check skipped or failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.APPROVED,
        approvedByUserId: userId,
        approvedAt: new Date(),
      },
      include: { lines: true, supplier: true, location: true },
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_ORDER_APPROVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'procurement.order.approve',
      resource: 'purchase_order',
      resourceId: updated.id,
      details: { poNumber: updated.poNumber },
    });

    return updated;
  }

  /**
   * Reject purchase order.
   */
  async reject(organizationId: string, id: string, userId: string) {
    const po = await this.findOne(organizationId, id);

    if (po.status !== PurchaseOrderStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot reject purchase order in status ${po.status}. Must be SUBMITTED.`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.REJECTED },
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_ORDER_REJECTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'procurement.order.reject',
      resource: 'purchase_order',
      resourceId: updated.id,
      details: { poNumber: updated.poNumber },
    });

    return updated;
  }

  /**
   * Send purchase order to supplier.
   */
  async send(organizationId: string, id: string, userId: string) {
    const po = await this.findOne(organizationId, id);

    if (po.status !== PurchaseOrderStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot send purchase order in status ${po.status}. Must be APPROVED.`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.SENT },
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_ORDER_SENT',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'procurement.order.send',
      resource: 'purchase_order',
      resourceId: updated.id,
      details: { poNumber: updated.poNumber, supplier: po.supplier?.name },
    });

    return updated;
  }

  /**
   * Record supplier acknowledgement of purchase order.
   */
  async acknowledge(
    organizationId: string,
    id: string,
    dto: AcknowledgePurchaseOrderDto,
    userId: string,
  ) {
    const po = await this.findOne(organizationId, id);

    if (
      po.status !== PurchaseOrderStatus.SENT &&
      po.status !== PurchaseOrderStatus.APPROVED
    ) {
      throw new BadRequestException(
        `Cannot acknowledge purchase order in status ${po.status}. Must be SENT or APPROVED.`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        supplierReference: dto.supplierReference ?? po.supplierReference,
        confirmedDeliveryDate: dto.confirmedDeliveryDate
          ? new Date(dto.confirmedDeliveryDate)
          : po.confirmedDeliveryDate,
        confirmedQuantity: dto.confirmedQuantity
          ? new Prisma.Decimal(dto.confirmedQuantity)
          : po.confirmedQuantity,
        supplierNotes: dto.supplierNotes ?? po.supplierNotes,
      },
      include: { lines: true, supplier: true },
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_ORDER_ACKNOWLEDGED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'procurement.order.acknowledge',
      resource: 'purchase_order',
      resourceId: updated.id,
      details: {
        poNumber: updated.poNumber,
        confirmedDeliveryDate: updated.confirmedDeliveryDate,
      },
    });

    return updated;
  }

  /**
   * Cancel purchase order.
   */
  async cancel(organizationId: string, id: string, userId: string) {
    const po = await this.findOne(organizationId, id);

    if (
      po.status === PurchaseOrderStatus.PARTIALLY_RECEIVED ||
      po.status === PurchaseOrderStatus.RECEIVED ||
      po.status === PurchaseOrderStatus.CLOSED ||
      po.status === PurchaseOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel purchase order in status ${po.status}.`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.CANCELLED },
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_ORDER_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'procurement.order.cancel',
      resource: 'purchase_order',
      resourceId: updated.id,
      details: { poNumber: updated.poNumber },
    });

    return updated;
  }

  /**
   * Close purchase order.
   */
  async close(organizationId: string, id: string, userId: string) {
    const po = await this.findOne(organizationId, id);

    if (
      po.status !== PurchaseOrderStatus.RECEIVED &&
      po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED &&
      po.status !== PurchaseOrderStatus.APPROVED &&
      po.status !== PurchaseOrderStatus.SENT &&
      po.status !== PurchaseOrderStatus.ACKNOWLEDGED
    ) {
      throw new BadRequestException(
        `Cannot close purchase order in status ${po.status}.`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.CLOSED },
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_ORDER_CLOSED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'procurement.order.close',
      resource: 'purchase_order',
      resourceId: updated.id,
      details: { poNumber: updated.poNumber },
    });

    return updated;
  }
}
