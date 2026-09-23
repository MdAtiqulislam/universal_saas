import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import {
  CreatePurchaseRequisitionDto,
  UpdatePurchaseRequisitionDto,
} from './dto/create-requisition.dto';
import { PurchaseRequisitionQueryDto } from './dto/requisition-query.dto';
import {
  PurchaseRequisitionStatus,
  PlannedOrderStatus,
  PlannedOrderAction,
  PurchaseOrderStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class PurchaseRequisitionsService {
  private readonly logger = new Logger(PurchaseRequisitionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * Create a new draft purchase requisition.
   */
  async create(
    organizationId: string,
    dto: CreatePurchaseRequisitionDto,
    userId: string,
  ) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException(
        'Purchase requisition must contain at least one line item.',
      );
    }

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, organizationId },
      });
      if (!supplier) {
        throw new NotFoundException(
          `Supplier with ID ${dto.supplierId} not found in organization.`,
        );
      }
    }

    if (dto.locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: dto.locationId, organizationId },
      });
      if (!location) {
        throw new NotFoundException(
          `Location with ID ${dto.locationId} not found in organization.`,
        );
      }
    }

    let requisitionNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'PURCHASE_REQUISITION',
        userId,
      );
      requisitionNumber = seq.formatted;
    } catch {
      const count = await this.prisma.purchaseRequisition.count({
        where: { organizationId },
      });
      requisitionNumber = `PR-${String(count + 1).padStart(6, '0')}`;
    }

    return this.prisma.$transaction(async (tx) => {
      const pr = await tx.purchaseRequisition.create({
        data: {
          organizationId,
          requisitionNumber,
          requesterId: userId,
          departmentId: dto.departmentId,
          supplierId: dto.supplierId,
          locationId: dto.locationId,
          currencyId: dto.currencyId,
          requiredDate: new Date(dto.requiredDate),
          status: PurchaseRequisitionStatus.DRAFT,
          notes: dto.notes,
          sourcePlannedOrderId: dto.sourcePlannedOrderId,
          sourcePlanningRunId: dto.sourcePlanningRunId,
          lines: {
            create: dto.lines.map((line) => {
              const qty = new Prisma.Decimal(line.quantity);
              const unitPrice = new Prisma.Decimal(
                line.estimatedUnitPrice ?? 0,
              );
              const estTotal = qty.times(unitPrice);

              return {
                organizationId,
                itemId: line.itemId,
                variantId: line.variantId,
                quantity: qty,
                estimatedUnitPrice: unitPrice,
                estimatedTotal: estTotal,
                requiredDate: new Date(line.requiredDate),
                sourcePlanningResultId: line.sourcePlanningResultId,
              };
            }),
          },
        },
        include: {
          department: true,
          supplier: true,
          location: true,
          currency: true,
          lines: { include: { item: true, variant: true } },
        },
      });

      await this.eventBus.publish({
        eventName: 'PURCHASE_REQUISITION_CREATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'procurement.requisition.create',
        resource: 'purchase_requisition',
        resourceId: pr.id,
        details: {
          requisitionNumber: pr.requisitionNumber,
          lineCount: pr.lines.length,
        },
      });

      return pr;
    });
  }

  /**
   * List purchase requisitions with filtering and pagination.
   */
  async findAll(organizationId: string, query: PurchaseRequisitionQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseRequisitionWhereInput = { organizationId };

    if (query.status) where.status = query.status;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.requesterId) where.requesterId = query.requesterId;

    if (query.startDate || query.endDate) {
      where.requiredDate = {};
      if (query.startDate) where.requiredDate.gte = new Date(query.startDate);
      if (query.endDate) where.requiredDate.lte = new Date(query.endDate);
    }

    if (query.search) {
      where.OR = [
        { requisitionNumber: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, requisitions] = await Promise.all([
      this.prisma.purchaseRequisition.count({ where }),
      this.prisma.purchaseRequisition.findMany({
        where,
        include: {
          department: true,
          supplier: true,
          location: true,
          currency: true,
          _count: { select: { lines: true, purchaseOrders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { requisitions, total, page, limit };
  }

  /**
   * Find single purchase requisition by ID.
   */
  async findOne(organizationId: string, id: string) {
    const pr = await this.prisma.purchaseRequisition.findFirst({
      where: { id, organizationId },
      include: {
        department: true,
        supplier: true,
        location: true,
        currency: true,
        lines: { include: { item: true, variant: true } },
        purchaseOrders: true,
      },
    });

    if (!pr) {
      throw new NotFoundException(
        `Purchase requisition with ID ${id} not found.`,
      );
    }

    return pr;
  }

  /**
   * Update draft purchase requisition.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdatePurchaseRequisitionDto,
  ) {
    const pr = await this.findOne(organizationId, id);

    if (pr.status !== PurchaseRequisitionStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot modify purchase requisition in status ${pr.status}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines && dto.lines.length > 0) {
        await tx.purchaseRequisitionLine.deleteMany({
          where: { requisitionId: id },
        });

        await tx.purchaseRequisitionLine.createMany({
          data: dto.lines.map((line) => {
            const qty = new Prisma.Decimal(line.quantity);
            const unitPrice = new Prisma.Decimal(line.estimatedUnitPrice ?? 0);
            return {
              requisitionId: id,
              organizationId,
              itemId: line.itemId,
              variantId: line.variantId,
              quantity: qty,
              estimatedUnitPrice: unitPrice,
              estimatedTotal: qty.times(unitPrice),
              requiredDate: new Date(line.requiredDate),
              sourcePlanningResultId: line.sourcePlanningResultId,
            };
          }),
        });
      }

      const updated = await tx.purchaseRequisition.update({
        where: { id },
        data: {
          requiredDate: dto.requiredDate
            ? new Date(dto.requiredDate)
            : undefined,
          departmentId: dto.departmentId,
          supplierId: dto.supplierId,
          locationId: dto.locationId,
          currencyId: dto.currencyId,
          notes: dto.notes,
        },
        include: {
          department: true,
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
   * Submit purchase requisition for approval.
   */
  async submit(organizationId: string, id: string, userId: string) {
    const pr = await this.findOne(organizationId, id);

    if (pr.status !== PurchaseRequisitionStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot submit purchase requisition in status ${pr.status}. Must be in DRAFT status.`,
      );
    }

    const updated = await this.prisma.purchaseRequisition.update({
      where: { id },
      data: { status: PurchaseRequisitionStatus.SUBMITTED },
      include: { lines: true },
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_REQUISITION_SUBMITTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'procurement.requisition.submit',
      resource: 'purchase_requisition',
      resourceId: updated.id,
      details: { requisitionNumber: updated.requisitionNumber },
    });

    return updated;
  }

  /**
   * Approve purchase requisition.
   */
  async approve(organizationId: string, id: string, userId: string) {
    const pr = await this.findOne(organizationId, id);

    if (pr.status !== PurchaseRequisitionStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot approve purchase requisition in status ${pr.status}. Must be in SUBMITTED status.`,
      );
    }

    const updated = await this.prisma.purchaseRequisition.update({
      where: { id },
      data: { status: PurchaseRequisitionStatus.APPROVED },
      include: { lines: true },
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_REQUISITION_APPROVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'procurement.requisition.approve',
      resource: 'purchase_requisition',
      resourceId: updated.id,
      details: { requisitionNumber: updated.requisitionNumber },
    });

    return updated;
  }

  /**
   * Reject purchase requisition.
   */
  async reject(organizationId: string, id: string, userId: string) {
    const pr = await this.findOne(organizationId, id);

    if (pr.status !== PurchaseRequisitionStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot reject purchase requisition in status ${pr.status}. Must be in SUBMITTED status.`,
      );
    }

    const updated = await this.prisma.purchaseRequisition.update({
      where: { id },
      data: { status: PurchaseRequisitionStatus.REJECTED },
      include: { lines: true },
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_REQUISITION_REJECTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'procurement.requisition.reject',
      resource: 'purchase_requisition',
      resourceId: updated.id,
      details: { requisitionNumber: updated.requisitionNumber },
    });

    return updated;
  }

  /**
   * Cancel purchase requisition.
   */
  async cancel(organizationId: string, id: string, userId: string) {
    const pr = await this.findOne(organizationId, id);

    if (
      pr.status === PurchaseRequisitionStatus.CONVERTED ||
      pr.status === PurchaseRequisitionStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel purchase requisition in status ${pr.status}.`,
      );
    }

    const updated = await this.prisma.purchaseRequisition.update({
      where: { id },
      data: { status: PurchaseRequisitionStatus.CANCELLED },
    });

    await this.eventBus.publish({
      eventName: 'PURCHASE_REQUISITION_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'procurement.requisition.cancel',
      resource: 'purchase_requisition',
      resourceId: updated.id,
      details: { requisitionNumber: updated.requisitionNumber },
    });

    return updated;
  }

  /**
   * Convert Approved Purchase Requisition into a Purchase Order.
   */
  async convertToPO(organizationId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const pr = await tx.purchaseRequisition.findFirst({
        where: { id, organizationId },
        include: {
          lines: true,
          supplier: true,
          location: true,
          currency: true,
        },
      });

      if (!pr) {
        throw new NotFoundException(
          `Purchase requisition with ID ${id} not found.`,
        );
      }

      if (pr.status !== PurchaseRequisitionStatus.APPROVED) {
        throw new BadRequestException(
          `Cannot convert purchase requisition in status ${pr.status}. Must be APPROVED.`,
        );
      }

      if (!pr.supplierId) {
        throw new BadRequestException(
          'Cannot convert purchase requisition without a designated supplier.',
        );
      }

      if (!pr.locationId) {
        throw new BadRequestException(
          'Cannot convert purchase requisition without a receiving location.',
        );
      }

      // Resolve Currency (use PR currency or supplier default currency or organization base currency)
      let currencyId = pr.currencyId;
      if (!currencyId && pr.supplier?.currencyId) {
        currencyId = pr.supplier.currencyId;
      }
      if (!currencyId) {
        const defaultCurr = await tx.currency.findFirst({
          where: { isActive: true },
        });
        currencyId = defaultCurr?.id ?? null;
      }

      if (!currencyId) {
        throw new BadRequestException(
          'No valid currency found for Purchase Order.',
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
        const count = await tx.purchaseOrder.count({
          where: { organizationId },
        });
        poNumber = `PO-${String(count + 1).padStart(6, '0')}`;
      }

      let subtotal = new Prisma.Decimal(0);

      // Construct PO Lines
      const poLinesData = pr.lines.map((l) => {
        const qty = new Prisma.Decimal(l.quantity);
        const unitPrice = new Prisma.Decimal(l.estimatedUnitPrice);
        const lineTotal = qty.times(unitPrice);
        subtotal = subtotal.plus(lineTotal);

        return {
          organizationId,
          itemId: l.itemId,
          variantId: l.variantId,
          quantity: qty,
          unitPrice,
          lineTotal,
          receivedQuantity: new Prisma.Decimal(0),
          cancelledQuantity: new Prisma.Decimal(0),
          remainingQuantity: qty,
          requiredDate: l.requiredDate,
          expectedReceiptDate: l.requiredDate,
        };
      });

      const grandTotal = subtotal;

      // Create Purchase Order
      const po = await tx.purchaseOrder.create({
        data: {
          organizationId,
          poNumber,
          supplierId: pr.supplierId,
          locationId: pr.locationId,
          currencyId,
          requisitionId: pr.id,
          plannedOrderId: pr.sourcePlannedOrderId,
          status: PurchaseOrderStatus.DRAFT,
          orderDate: new Date(),
          expectedDate: pr.requiredDate,
          subtotal,
          taxTotal: new Prisma.Decimal(0),
          discountTotal: new Prisma.Decimal(0),
          shippingTotal: new Prisma.Decimal(0),
          grandTotal,
          createdByUserId: userId,
          lines: {
            create: poLinesData,
          },
        },
        include: {
          lines: true,
          supplier: true,
          location: true,
          currency: true,
        },
      });

      // Transition PR to CONVERTED
      await tx.purchaseRequisition.update({
        where: { id },
        data: { status: PurchaseRequisitionStatus.CONVERTED },
      });

      await this.eventBus.publish({
        eventName: 'PURCHASE_REQUISITION_CONVERTED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'procurement.requisition.convert',
        resource: 'purchase_requisition',
        resourceId: pr.id,
        details: {
          requisitionNumber: pr.requisitionNumber,
          createdPurchaseOrderId: po.id,
          createdPoNumber: po.poNumber,
        },
      });

      return po;
    });
  }

  /**
   * Convert M26 Planned Order into a Purchase Requisition.
   * Concurrency-safe, prevents double-conversion.
   */
  async convertPlannedOrder(
    organizationId: string,
    plannedOrderId: string,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const plannedOrder = await tx.plannedOrder.findFirst({
        where: { id: plannedOrderId, organizationId },
        include: {
          item: true,
          supplier: true,
          location: true,
          planningRun: true,
        },
      });

      if (!plannedOrder) {
        throw new NotFoundException(
          `Planned order with ID ${plannedOrderId} not found.`,
        );
      }

      if (plannedOrder.action !== PlannedOrderAction.PURCHASE) {
        throw new BadRequestException(
          `Cannot convert planned order with action ${plannedOrder.action} to Purchase Requisition. Action must be PURCHASE.`,
        );
      }

      if (plannedOrder.status !== PlannedOrderStatus.SUGGESTED) {
        throw new BadRequestException(
          `Cannot convert planned order in status ${plannedOrder.status}. It has already been processed.`,
        );
      }

      // Check if PR already exists for this planned order
      const existingPr = await tx.purchaseRequisition.findFirst({
        where: { organizationId, sourcePlannedOrderId: plannedOrderId },
      });

      if (existingPr) {
        throw new BadRequestException(
          `Planned order ${plannedOrderId} has already been converted to requisition ${existingPr.requisitionNumber}.`,
        );
      }

      // Resolve supplier & currency
      const supplierId = plannedOrder.supplierId;
      let currencyId: string | null = null;
      if (supplierId && plannedOrder.supplier?.currencyId) {
        currencyId = plannedOrder.supplier.currencyId;
      }

      let requisitionNumber: string;
      try {
        const seq = await this.numberingService.nextNumber(
          organizationId,
          'PURCHASE_REQUISITION',
          userId,
        );
        requisitionNumber = seq.formatted;
      } catch {
        const count = await tx.purchaseRequisition.count({
          where: { organizationId },
        });
        requisitionNumber = `PR-${String(count + 1).padStart(6, '0')}`;
      }

      // Create Requisition
      const pr = await tx.purchaseRequisition.create({
        data: {
          organizationId,
          requisitionNumber,
          requesterId: userId,
          supplierId,
          locationId: plannedOrder.locationId,
          currencyId,
          requiredDate: plannedOrder.requiredDate,
          status: PurchaseRequisitionStatus.DRAFT,
          notes: `Converted from MRP Planned Order ${plannedOrder.orderNumber}`,
          sourcePlannedOrderId: plannedOrder.id,
          sourcePlanningRunId: plannedOrder.planningRunId,
          lines: {
            create: [
              {
                organizationId,
                itemId: plannedOrder.itemId,
                variantId: plannedOrder.variantId,
                quantity: plannedOrder.quantity,
                estimatedUnitPrice: new Prisma.Decimal(0),
                estimatedTotal: new Prisma.Decimal(0),
                requiredDate: plannedOrder.requiredDate,
              },
            ],
          },
        },
        include: {
          supplier: true,
          location: true,
          lines: { include: { item: true, variant: true } },
        },
      });

      // Update PlannedOrder status to CONVERTED
      await tx.plannedOrder.update({
        where: { id: plannedOrderId },
        data: { status: PlannedOrderStatus.CONVERTED },
      });

      await this.eventBus.publish({
        eventName: 'PURCHASE_REQUISITION_CREATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'procurement.planned_order.convert',
        resource: 'purchase_requisition',
        resourceId: pr.id,
        details: {
          requisitionNumber: pr.requisitionNumber,
          sourcePlannedOrder: plannedOrder.orderNumber,
        },
      });

      return pr;
    });
  }
}
