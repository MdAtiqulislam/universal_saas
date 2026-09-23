import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { QuotationsService } from '../../sales/quotations/quotations.service';
import {
  SubmitQuotationDto,
  ApproveQuotationDto,
  RejectQuotationDto,
  AcceptQuotationDto,
  VoidQuotationDto,
} from '../dto/quotation-approval.dto';
import { QuotationStatus, Prisma } from '@prisma/client';

@Injectable()
export class CrmQuotationsService {
  private readonly logger = new Logger(CrmQuotationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly quotationsService: QuotationsService,
  ) {}

  async findAll(organizationId: string, query?: Record<string, unknown>) {
    return this.quotationsService.findAll(organizationId, query as any);
  }

  async findOne(organizationId: string, id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        opportunity: true,
        contact: true,
        currency: true,
        location: true,
        lines: {
          include: {
            item: true,
            variant: true,
          },
        },
        salesOrders: true,
      },
    });

    if (!quotation) {
      throw new NotFoundException(
        `Quotation with ID ${id} not found in this organization.`,
      );
    }

    return quotation;
  }

  async submit(
    organizationId: string,
    id: string,
    dto: SubmitQuotationDto,
    actorUserId: string,
  ) {
    const quotation = await this.findOne(organizationId, id);

    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot submit quotation in status: ${quotation.status}. Must be DRAFT.`,
      );
    }

    if (quotation.lines.length === 0) {
      throw new BadRequestException(
        'Cannot submit a quotation with no line items.',
      );
    }

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: {
        status: QuotationStatus.SUBMITTED,
        notes: dto.notes
          ? `${quotation.notes || ''}\n${dto.notes}`.trim()
          : undefined,
      },
      include: {
        customer: true,
        opportunity: true,
        lines: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'QUOTATION_SUBMITTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'submit_quotation',
      resource: 'quotation',
      resourceId: updated.id,
      details: { quotationNumber: updated.quotationNumber },
    });

    return updated;
  }

  async approve(
    organizationId: string,
    id: string,
    dto: ApproveQuotationDto,
    actorUserId: string,
  ) {
    const quotation = await this.findOne(organizationId, id);

    if (quotation.status !== QuotationStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot approve quotation in status: ${quotation.status}. Must be SUBMITTED.`,
      );
    }

    const now = new Date();

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: {
        status: QuotationStatus.APPROVED,
        approvedByUserId: actorUserId,
        approvedAt: now,
      },
      include: {
        customer: true,
        opportunity: true,
        lines: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'QUOTATION_APPROVED',
      occurredAt: now,
      organizationId,
      actorUserId,
      action: 'approve_quotation',
      resource: 'quotation',
      resourceId: updated.id,
      details: { quotationNumber: updated.quotationNumber },
    });

    return updated;
  }

  async reject(
    organizationId: string,
    id: string,
    dto: RejectQuotationDto,
    actorUserId: string,
  ) {
    const quotation = await this.findOne(organizationId, id);

    if (quotation.status !== QuotationStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot reject quotation in status: ${quotation.status}. Must be SUBMITTED.`,
      );
    }

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: {
        status: QuotationStatus.REJECTED,
        rejectionReason: dto.rejectionReason,
      },
      include: {
        customer: true,
        opportunity: true,
        lines: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'QUOTATION_REJECTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'reject_quotation',
      resource: 'quotation',
      resourceId: updated.id,
      details: {
        quotationNumber: updated.quotationNumber,
        rejectionReason: dto.rejectionReason,
      },
    });

    return updated;
  }

  async send(organizationId: string, id: string, actorUserId: string) {
    const quotation = await this.findOne(organizationId, id);

    if (
      quotation.status !== QuotationStatus.APPROVED &&
      quotation.status !== QuotationStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Cannot send quotation in status: ${quotation.status}. Must be APPROVED or DRAFT.`,
      );
    }

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: {
        status: QuotationStatus.SENT,
      },
      include: {
        customer: true,
        opportunity: true,
        lines: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'QUOTATION_SENT',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'send_quotation',
      resource: 'quotation',
      resourceId: updated.id,
      details: { quotationNumber: updated.quotationNumber },
    });

    return updated;
  }

  async accept(
    organizationId: string,
    id: string,
    dto: AcceptQuotationDto,
    actorUserId: string,
  ) {
    const quotation = await this.findOne(organizationId, id);

    if (
      quotation.status !== QuotationStatus.SENT &&
      quotation.status !== QuotationStatus.APPROVED
    ) {
      throw new BadRequestException(
        `Cannot accept quotation in status: ${quotation.status}. Must be SENT or APPROVED.`,
      );
    }

    const now = new Date();

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: {
        status: QuotationStatus.ACCEPTED,
        acceptedAt: now,
        acceptedBy: dto.acceptedBy,
        isImmutable: true,
      },
      include: {
        customer: true,
        opportunity: true,
        lines: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'QUOTATION_ACCEPTED',
      occurredAt: now,
      organizationId,
      actorUserId,
      action: 'accept_quotation',
      resource: 'quotation',
      resourceId: updated.id,
      details: {
        quotationNumber: updated.quotationNumber,
        acceptedBy: dto.acceptedBy,
      },
    });

    return updated;
  }

  async convert(organizationId: string, id: string, actorUserId: string) {
    const quotation = await this.findOne(organizationId, id);

    if (quotation.status === QuotationStatus.CONVERTED) {
      throw new ConflictException(
        `Quotation ${quotation.quotationNumber} has already been converted into a Sales Order.`,
      );
    }

    if (quotation.status !== QuotationStatus.ACCEPTED) {
      throw new BadRequestException(
        `Cannot convert quotation in status: ${quotation.status}. Must be ACCEPTED first.`,
      );
    }

    // Convert to Sales Order via authoritative M28 QuotationsService
    const salesOrder = await this.quotationsService.convert(
      organizationId,
      id,
      actorUserId,
    );

    // Ensure quotation is marked immutable and converted
    await this.prisma.quotation.update({
      where: { id },
      data: {
        status: QuotationStatus.CONVERTED,
        isImmutable: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'QUOTATION_CONVERTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'convert_quotation_to_sales_order',
      resource: 'quotation',
      resourceId: quotation.id,
      details: {
        quotationNumber: quotation.quotationNumber,
        salesOrderId: salesOrder.id,
        orderNumber: salesOrder.orderNumber,
      },
    });

    return {
      quotationId: quotation.id,
      quotationNumber: quotation.quotationNumber,
      salesOrder,
    };
  }

  async void(
    organizationId: string,
    id: string,
    dto: VoidQuotationDto,
    actorUserId: string,
  ) {
    const quotation = await this.findOne(organizationId, id);

    if (quotation.status === QuotationStatus.CONVERTED) {
      throw new BadRequestException('Cannot void a converted quotation.');
    }

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: {
        status: QuotationStatus.VOIDED,
        rejectionReason: dto.reason,
        isImmutable: true,
      },
      include: {
        customer: true,
        opportunity: true,
        lines: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'QUOTATION_VOIDED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'void_quotation',
      resource: 'quotation',
      resourceId: updated.id,
      details: {
        quotationNumber: updated.quotationNumber,
        reason: dto.reason,
      },
    });

    return updated;
  }
}
