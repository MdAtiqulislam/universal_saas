import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { CustomerReturnsService } from '../customer/customer-returns.service';
import { SupplierReturnsService } from '../supplier/supplier-returns.service';
import {
  CreateReturnRequestDto,
  UpdateReturnRequestDto,
  ReviewReturnDto,
  AuthorizeReturnDto,
  RejectReturnDto,
  QueryReturnRequestDto,
} from './dto/return-request.dto';
import { ReturnStatus, ReturnType, Prisma } from '@prisma/client';

export type ReturnRequestWithDetails = Prisma.ReturnRequestGetPayload<{
  include: {
    customer: true;
    supplier: true;
    salesOrder: true;
    deliveryOrder: true;
    shipment: true;
    reverseShipment: true;
    customerInvoice: true;
    purchaseOrder: true;
    goodsReceipt: true;
    supplierInvoice: true;
    inspectionLot: true;
    reason: true;
    lines: {
      include: {
        item: true;
        variant: true;
        reason: true;
      };
    };
    dispositions: true;
    resolutions: true;
  };
}>;

@Injectable()
export class ReturnRequestsService {
  private readonly logger = new Logger(ReturnRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly customerReturnsService: CustomerReturnsService,
    private readonly supplierReturnsService: SupplierReturnsService,
  ) {}

  async findAll(
    organizationId: string,
    query?: QueryReturnRequestDto,
  ): Promise<ReturnRequestWithDetails[]> {
    const where: Prisma.ReturnRequestWhereInput = { organizationId };

    if (query?.status) {
      where.status = query.status;
    }
    if (query?.returnType) {
      where.returnType = query.returnType;
    }
    if (query?.customerId) {
      where.customerId = query.customerId;
    }
    if (query?.supplierId) {
      where.supplierId = query.supplierId;
    }
    if (query?.salesOrderId) {
      where.salesOrderId = query.salesOrderId;
    }
    if (query?.purchaseOrderId) {
      where.purchaseOrderId = query.purchaseOrderId;
    }
    if (query?.search) {
      where.OR = [
        { returnNumber: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.returnRequest.findMany({
      where,
      include: {
        customer: true,
        supplier: true,
        salesOrder: true,
        deliveryOrder: true,
        shipment: true,
        reverseShipment: true,
        customerInvoice: true,
        purchaseOrder: true,
        goodsReceipt: true,
        supplierInvoice: true,
        inspectionLot: true,
        reason: true,
        lines: {
          include: {
            item: true,
            variant: true,
            reason: true,
          },
        },
        dispositions: true,
        resolutions: true,
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<ReturnRequestWithDetails> {
    const returnRequest = await this.prisma.returnRequest.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        supplier: true,
        salesOrder: true,
        deliveryOrder: true,
        shipment: true,
        reverseShipment: true,
        customerInvoice: true,
        purchaseOrder: true,
        goodsReceipt: true,
        supplierInvoice: true,
        inspectionLot: true,
        reason: true,
        lines: {
          include: {
            item: true,
            variant: true,
            reason: true,
          },
        },
        dispositions: true,
        resolutions: true,
      },
    });

    if (!returnRequest) {
      throw new NotFoundException(
        `Return request with ID ${id} not found in this organization.`,
      );
    }

    return returnRequest;
  }

  async create(
    organizationId: string,
    dto: CreateReturnRequestDto,
    userId: string,
  ): Promise<ReturnRequestWithDetails> {
    // 1. Validate Return Reason
    const reason = await this.prisma.returnReason.findFirst({
      where: { id: dto.reasonId, organizationId, isActive: true },
    });
    if (!reason) {
      throw new BadRequestException(
        `Return reason with ID ${dto.reasonId} not found or inactive.`,
      );
    }

    // 2. Validate Customer or Supplier Context
    let validatedLines: Array<{
      itemId: string;
      variantId?: string | null;
      sourceLineId?: string | null;
      requestedQuantity: Prisma.Decimal;
      deliveredQuantity?: Prisma.Decimal;
      receivedQuantity?: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      lineAmount: Prisma.Decimal;
    }> = [];

    if (
      dto.returnType === ReturnType.CUSTOMER_RETURN ||
      dto.returnType === ReturnType.WARRANTY_RETURN ||
      dto.returnType === ReturnType.REPLACEMENT_RETURN
    ) {
      if (!dto.customerId) {
        throw new BadRequestException(
          `Customer ID is required for ${dto.returnType}.`,
        );
      }
      if (dto.supplierId) {
        throw new BadRequestException(
          `Supplier ID cannot be specified for customer return types.`,
        );
      }

      const eligibility = await this.customerReturnsService.validateEligibility(
        organizationId,
        {
          customerId: dto.customerId,
          salesOrderId: dto.salesOrderId,
          deliveryOrderId: dto.deliveryOrderId,
          shipmentId: dto.shipmentId,
          customerInvoiceId: dto.customerInvoiceId,
          lines: dto.lines,
        },
      );
      validatedLines = eligibility.validatedLines;
    } else if (dto.returnType === ReturnType.SUPPLIER_RETURN) {
      if (!dto.supplierId) {
        throw new BadRequestException(
          `Supplier ID is required for SUPPLIER_RETURN.`,
        );
      }
      if (dto.customerId) {
        throw new BadRequestException(
          `Customer ID cannot be specified for supplier returns.`,
        );
      }

      const eligibility = await this.supplierReturnsService.validateEligibility(
        organizationId,
        {
          supplierId: dto.supplierId,
          purchaseOrderId: dto.purchaseOrderId,
          goodsReceiptId: dto.goodsReceiptId,
          supplierInvoiceId: dto.supplierInvoiceId,
          lines: dto.lines,
        },
      );
      validatedLines = eligibility.validatedLines;
    } else {
      // INTERNAL_RETURN
      validatedLines = dto.lines.map((l) => ({
        itemId: l.itemId,
        variantId: l.variantId ?? null,
        sourceLineId: l.sourceLineId ?? null,
        requestedQuantity: new Prisma.Decimal(l.requestedQuantity),
        unitPrice: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
        lineAmount: new Prisma.Decimal(0),
      }));
    }

    // 3. Generate RMA Number
    let returnNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(organizationId, 'RMA');
      returnNumber = seq.formatted;
    } catch {
      const count = await this.prisma.returnRequest.count({
        where: { organizationId },
      });
      returnNumber = `RMA-${String(count + 1).padStart(6, '0')}`;
    }

    // 4. Create Return Request & Lines in Transaction
    const returnRequest = await this.prisma.$transaction(async (tx) => {
      const created = await tx.returnRequest.create({
        data: {
          organizationId,
          returnNumber,
          returnType: dto.returnType,
          status: ReturnStatus.DRAFT,
          customerId: dto.customerId ?? null,
          supplierId: dto.supplierId ?? null,
          salesOrderId: dto.salesOrderId ?? null,
          deliveryOrderId: dto.deliveryOrderId ?? null,
          shipmentId: dto.shipmentId ?? null,
          customerInvoiceId: dto.customerInvoiceId ?? null,
          purchaseOrderId: dto.purchaseOrderId ?? null,
          goodsReceiptId: dto.goodsReceiptId ?? null,
          supplierInvoiceId: dto.supplierInvoiceId ?? null,
          reasonId: dto.reasonId,
          notes: dto.notes?.trim() ?? null,
          createdByUserId: userId,
          lines: {
            create: validatedLines.map((l, index) => ({
              organizationId,
              itemId: l.itemId,
              variantId: l.variantId ?? null,
              sourceLineId: l.sourceLineId ?? null,
              requestedQuantity: l.requestedQuantity,
              authorizedQuantity: new Prisma.Decimal(0),
              shippedReturnQuantity: new Prisma.Decimal(0),
              receivedQuantity: new Prisma.Decimal(0),
              inspectedQuantity: new Prisma.Decimal(0),
              acceptedQuantity: new Prisma.Decimal(0),
              rejectedQuantity: new Prisma.Decimal(0),
              replacementQuantity: new Prisma.Decimal(0),
              financialResolutionQuantity: new Prisma.Decimal(0),
              unitPrice: l.unitPrice,
              taxAmount: l.taxAmount,
              lineAmount: l.lineAmount,
              reasonId: dto.lines[index]?.reasonId ?? dto.reasonId,
              status: 'PENDING',
            })),
          },
        },
        include: {
          customer: true,
          supplier: true,
          salesOrder: true,
          deliveryOrder: true,
          shipment: true,
          reverseShipment: true,
          customerInvoice: true,
          purchaseOrder: true,
          goodsReceipt: true,
          supplierInvoice: true,
          inspectionLot: true,
          reason: true,
          lines: {
            include: {
              item: true,
              variant: true,
              reason: true,
            },
          },
          dispositions: true,
          resolutions: true,
        },
      });

      return created;
    });

    await this.eventBus.publish({
      eventName: 'RETURN_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'returns.create',
      resource: 'return_request',
      resourceId: returnRequest.id,
      details: {
        returnNumber: returnRequest.returnNumber,
        returnType: returnRequest.returnType,
        customerId: returnRequest.customerId,
        supplierId: returnRequest.supplierId,
      },
    });

    return returnRequest;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateReturnRequestDto,
    userId: string,
  ): Promise<ReturnRequestWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.isImmutable || existing.status === ReturnStatus.CLOSED) {
      throw new BadRequestException(
        'Cannot modify an immutable or closed return request.',
      );
    }

    if (dto.reasonId) {
      const reason = await this.prisma.returnReason.findFirst({
        where: { id: dto.reasonId, organizationId, isActive: true },
      });
      if (!reason) {
        throw new NotFoundException(`Return reason ${dto.reasonId} not found.`);
      }
    }

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        notes: dto.notes !== undefined ? dto.notes.trim() : undefined,
        reasonId: dto.reasonId,
        reverseShipmentId: dto.reverseShipmentId,
      },
      include: {
        customer: true,
        supplier: true,
        salesOrder: true,
        deliveryOrder: true,
        shipment: true,
        reverseShipment: true,
        customerInvoice: true,
        purchaseOrder: true,
        goodsReceipt: true,
        supplierInvoice: true,
        inspectionLot: true,
        reason: true,
        lines: {
          include: {
            item: true,
            variant: true,
            reason: true,
          },
        },
        dispositions: true,
        resolutions: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'RETURN_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'returns.update',
      resource: 'return_request',
      resourceId: updated.id,
      details: {
        returnNumber: updated.returnNumber,
      },
    });

    return updated;
  }

  async submit(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<ReturnRequestWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== ReturnStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT returns can be submitted. Current status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: { status: ReturnStatus.SUBMITTED },
      include: {
        customer: true,
        supplier: true,
        salesOrder: true,
        deliveryOrder: true,
        shipment: true,
        reverseShipment: true,
        customerInvoice: true,
        purchaseOrder: true,
        goodsReceipt: true,
        supplierInvoice: true,
        inspectionLot: true,
        reason: true,
        lines: {
          include: {
            item: true,
            variant: true,
            reason: true,
          },
        },
        dispositions: true,
        resolutions: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'RETURN_SUBMITTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'returns.submit',
      resource: 'return_request',
      resourceId: updated.id,
      details: {
        returnNumber: updated.returnNumber,
      },
    });

    return updated;
  }

  async review(
    organizationId: string,
    id: string,
    dto: ReviewReturnDto,
    userId: string,
  ): Promise<ReturnRequestWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status !== ReturnStatus.SUBMITTED &&
      existing.status !== ReturnStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Cannot review return in status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        status: ReturnStatus.UNDER_REVIEW,
        notes: dto.reviewNotes
          ? `${existing.notes ? existing.notes + '\n' : ''}[Review Note]: ${dto.reviewNotes}`
          : existing.notes,
      },
      include: {
        customer: true,
        supplier: true,
        salesOrder: true,
        deliveryOrder: true,
        shipment: true,
        reverseShipment: true,
        customerInvoice: true,
        purchaseOrder: true,
        goodsReceipt: true,
        supplierInvoice: true,
        inspectionLot: true,
        reason: true,
        lines: {
          include: {
            item: true,
            variant: true,
            reason: true,
          },
        },
        dispositions: true,
        resolutions: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'RETURN_REVIEW_STARTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'returns.review',
      resource: 'return_request',
      resourceId: updated.id,
      details: {
        returnNumber: updated.returnNumber,
      },
    });

    return updated;
  }

  async authorize(
    organizationId: string,
    id: string,
    dto: AuthorizeReturnDto,
    userId: string,
  ): Promise<ReturnRequestWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status !== ReturnStatus.UNDER_REVIEW &&
      existing.status !== ReturnStatus.SUBMITTED &&
      existing.status !== ReturnStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Cannot authorize return in status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Update line authorizations
      if (dto.lineAuthorizations && dto.lineAuthorizations.length > 0) {
        for (const lineAuth of dto.lineAuthorizations) {
          const targetLine = existing.lines.find(
            (l) => l.id === lineAuth.lineId,
          );
          if (!targetLine) {
            throw new BadRequestException(
              `Return line ${lineAuth.lineId} not found on this RMA.`,
            );
          }

          const authQty = new Prisma.Decimal(lineAuth.authorizedQuantity);
          if (authQty.greaterThan(targetLine.requestedQuantity)) {
            throw new BadRequestException(
              `Authorized quantity (${authQty.toString()}) cannot exceed requested quantity (${targetLine.requestedQuantity.toString()}) for line ${targetLine.id}.`,
            );
          }

          await tx.returnRequestLine.update({
            where: { id: lineAuth.lineId },
            data: {
              authorizedQuantity: authQty,
              status: authQty.greaterThan(0) ? 'AUTHORIZED' : 'REJECTED',
            },
          });
        }
      } else {
        // Authorize 100% of requested quantity for all lines by default
        for (const line of existing.lines) {
          await tx.returnRequestLine.update({
            where: { id: line.id },
            data: {
              authorizedQuantity: line.requestedQuantity,
              status: 'AUTHORIZED',
            },
          });
        }
      }

      // 2. Transition RMA Header Status
      const authorizedRma = await tx.returnRequest.update({
        where: { id },
        data: {
          status: ReturnStatus.AUTHORIZED,
          authorizedAt: new Date(),
          authorizedByUserId: userId,
          authorizationNotes: dto.authorizationNotes?.trim() ?? null,
        },
        include: {
          customer: true,
          supplier: true,
          salesOrder: true,
          deliveryOrder: true,
          shipment: true,
          reverseShipment: true,
          customerInvoice: true,
          purchaseOrder: true,
          goodsReceipt: true,
          supplierInvoice: true,
          inspectionLot: true,
          reason: true,
          lines: {
            include: {
              item: true,
              variant: true,
              reason: true,
            },
          },
          dispositions: true,
          resolutions: true,
        },
      });

      return authorizedRma;
    });

    await this.eventBus.publish({
      eventName: 'RETURN_AUTHORIZED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'returns.authorize',
      resource: 'return_request',
      resourceId: updated.id,
      details: {
        returnNumber: updated.returnNumber,
        authorizedAt: updated.authorizedAt,
      },
    });

    return updated;
  }

  async reject(
    organizationId: string,
    id: string,
    dto: RejectReturnDto,
    userId: string,
  ): Promise<ReturnRequestWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === ReturnStatus.CLOSED ||
      existing.status === ReturnStatus.RESOLVED ||
      existing.status === ReturnStatus.RECEIVED
    ) {
      throw new BadRequestException(
        `Cannot reject return in status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.returnRequestLine.updateMany({
        where: { returnRequestId: id },
        data: { status: 'REJECTED' },
      });

      const rejected = await tx.returnRequest.update({
        where: { id },
        data: {
          status: ReturnStatus.REJECTED,
          rejectionReason: dto.rejectionReason.trim(),
        },
        include: {
          customer: true,
          supplier: true,
          salesOrder: true,
          deliveryOrder: true,
          shipment: true,
          reverseShipment: true,
          customerInvoice: true,
          purchaseOrder: true,
          goodsReceipt: true,
          supplierInvoice: true,
          inspectionLot: true,
          reason: true,
          lines: {
            include: {
              item: true,
              variant: true,
              reason: true,
            },
          },
          dispositions: true,
          resolutions: true,
        },
      });

      return rejected;
    });

    await this.eventBus.publish({
      eventName: 'RETURN_REJECTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'returns.reject',
      resource: 'return_request',
      resourceId: updated.id,
      details: {
        returnNumber: updated.returnNumber,
        rejectionReason: updated.rejectionReason,
      },
    });

    return updated;
  }

  async cancel(
    organizationId: string,
    id: string,
    reason?: string,
    userId?: string,
  ): Promise<ReturnRequestWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === ReturnStatus.CLOSED ||
      existing.status === ReturnStatus.RESOLVED ||
      existing.status === ReturnStatus.RECEIVED
    ) {
      throw new BadRequestException(
        `Cannot cancel return in status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.returnRequestLine.updateMany({
        where: { returnRequestId: id },
        data: { status: 'CANCELLED' },
      });

      const cancelled = await tx.returnRequest.update({
        where: { id },
        data: {
          status: ReturnStatus.CANCELLED,
          rejectionReason: reason?.trim() ?? 'Cancelled by user',
        },
        include: {
          customer: true,
          supplier: true,
          salesOrder: true,
          deliveryOrder: true,
          shipment: true,
          reverseShipment: true,
          customerInvoice: true,
          purchaseOrder: true,
          goodsReceipt: true,
          supplierInvoice: true,
          inspectionLot: true,
          reason: true,
          lines: {
            include: {
              item: true,
              variant: true,
              reason: true,
            },
          },
          dispositions: true,
          resolutions: true,
        },
      });

      return cancelled;
    });

    await this.eventBus.publish({
      eventName: 'RETURN_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'returns.cancel',
      resource: 'return_request',
      resourceId: updated.id,
      details: {
        returnNumber: updated.returnNumber,
      },
    });

    return updated;
  }

  async void(
    organizationId: string,
    id: string,
    reason?: string,
    userId?: string,
  ): Promise<ReturnRequestWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status === ReturnStatus.CLOSED) {
      throw new BadRequestException('Cannot void a closed return request.');
    }

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        status: ReturnStatus.VOIDED,
        rejectionReason: reason?.trim() ?? 'Voided by user',
      },
      include: {
        customer: true,
        supplier: true,
        salesOrder: true,
        deliveryOrder: true,
        shipment: true,
        reverseShipment: true,
        customerInvoice: true,
        purchaseOrder: true,
        goodsReceipt: true,
        supplierInvoice: true,
        inspectionLot: true,
        reason: true,
        lines: {
          include: {
            item: true,
            variant: true,
            reason: true,
          },
        },
        dispositions: true,
        resolutions: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'RETURN_VOIDED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'returns.void',
      resource: 'return_request',
      resourceId: updated.id,
      details: {
        returnNumber: updated.returnNumber,
      },
    });

    return updated;
  }

  async close(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<ReturnRequestWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status === ReturnStatus.CLOSED) {
      throw new BadRequestException('Return is already closed.');
    }

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        status: ReturnStatus.CLOSED,
        closedAt: new Date(),
        isImmutable: true,
      },
      include: {
        customer: true,
        supplier: true,
        salesOrder: true,
        deliveryOrder: true,
        shipment: true,
        reverseShipment: true,
        customerInvoice: true,
        purchaseOrder: true,
        goodsReceipt: true,
        supplierInvoice: true,
        inspectionLot: true,
        reason: true,
        lines: {
          include: {
            item: true,
            variant: true,
            reason: true,
          },
        },
        dispositions: true,
        resolutions: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'RETURN_CLOSED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'returns.close',
      resource: 'return_request',
      resourceId: updated.id,
      details: {
        returnNumber: updated.returnNumber,
        closedAt: updated.closedAt,
      },
    });

    return updated;
  }
}
