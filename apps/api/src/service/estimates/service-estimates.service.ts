import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import {
  CreateServiceEstimateDto,
  ApproveEstimateDto,
  RejectEstimateDto,
} from '../dto/service-estimate.dto';
import {
  ServiceEstimate,
  ServiceEstimateStatus,
  ServiceTicketStatus,
  ServiceLineType,
  Prisma,
} from '@prisma/client';

export type ServiceEstimateWithDetails = Prisma.ServiceEstimateGetPayload<{
  include: {
    customer: true;
    customerAsset: true;
    serviceTicket: true;
    lines: {
      include: { item: true };
    };
  };
}>;

@Injectable()
export class ServiceEstimatesService {
  private readonly logger = new Logger(ServiceEstimatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<ServiceEstimateWithDetails> {
    const estimate = await this.prisma.serviceEstimate.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        customerAsset: true,
        serviceTicket: true,
        lines: {
          include: { item: true },
        },
      },
    });

    if (!estimate) {
      throw new NotFoundException(
        `Service estimate with ID ${id} not found in this organization.`,
      );
    }

    return estimate;
  }

  async create(
    organizationId: string,
    dto: CreateServiceEstimateDto,
    userId: string,
  ): Promise<ServiceEstimateWithDetails> {
    const ticket = await this.prisma.serviceTicket.findFirst({
      where: { id: dto.serviceTicketId, organizationId },
    });
    if (!ticket) {
      throw new NotFoundException(
        `Service ticket with ID ${dto.serviceTicketId} not found in this organization.`,
      );
    }

    // Generate estimateNumber
    let estimateNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'SERVICE_ESTIMATE',
        userId,
      );
      estimateNumber = seq.formatted;
    } catch {
      const count = await this.prisma.serviceEstimate.count({
        where: { organizationId },
      });
      estimateNumber = `EST-${String(count + 1).padStart(6, '0')}`;
    }

    // Calculate totals using exact Prisma.Decimal
    let subtotal = new Prisma.Decimal(0);
    let totalDiscount = new Prisma.Decimal(0);
    let totalTax = new Prisma.Decimal(0);
    let totalAmount = new Prisma.Decimal(0);
    let warrantyCoveredAmount = new Prisma.Decimal(0);
    let customerPayableAmount = new Prisma.Decimal(0);

    const calculatedLines = dto.lines.map((line) => {
      const qty = new Prisma.Decimal(line.quantity);
      const rate = new Prisma.Decimal(line.unitRate);
      const disc = new Prisma.Decimal(line.discountAmount || 0);
      const taxRate = new Prisma.Decimal(line.taxRate || 0);

      const lineSubtotal = qty.mul(rate).minus(disc);
      const lineTax = lineSubtotal.mul(taxRate).div(100);
      const lineTotal = lineSubtotal.plus(lineTax);

      subtotal = subtotal.plus(qty.mul(rate));
      totalDiscount = totalDiscount.plus(disc);
      totalTax = totalTax.plus(lineTax);
      totalAmount = totalAmount.plus(lineTotal);

      if (line.warrantyCovered) {
        warrantyCoveredAmount = warrantyCoveredAmount.plus(lineTotal);
      } else {
        customerPayableAmount = customerPayableAmount.plus(lineTotal);
      }

      return {
        lineType: line.lineType || ServiceLineType.PART,
        itemId: line.itemId || null,
        description: line.description.trim(),
        quantity: qty,
        unitRate: rate,
        discountAmount: disc,
        taxRate,
        taxAmount: lineTax,
        totalAmount: lineTotal,
        warrantyCovered: line.warrantyCovered ?? false,
      };
    });

    const now = new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const est = await tx.serviceEstimate.create({
        data: {
          organizationId,
          estimateNumber,
          serviceTicketId: ticket.id,
          customerId: ticket.customerId,
          customerAssetId: ticket.customerAssetId,
          status: ServiceEstimateStatus.DRAFT,
          subtotal,
          discountAmount: totalDiscount,
          taxAmount: totalTax,
          totalAmount,
          warrantyCoveredAmount,
          customerPayableAmount,
          notes: dto.notes || null,
          lines: {
            create: calculatedLines.map((l) => ({
              organizationId,
              ...l,
            })),
          },
        },
        include: {
          customer: true,
          customerAsset: true,
          serviceTicket: true,
          lines: {
            include: { item: true },
          },
        },
      });

      return est;
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_ESTIMATE_CREATED',
      occurredAt: now,
      organizationId,
      actorUserId: userId,
      action: 'create',
      resource: 'service_estimate',
      resourceId: created.id,
      details: {
        estimateNumber: created.estimateNumber,
        ticketNumber: ticket.ticketNumber,
        totalAmount: created.totalAmount.toString(),
        customerPayableAmount: created.customerPayableAmount.toString(),
      },
    });

    return created;
  }

  async send(organizationId: string, id: string, userId: string) {
    const estimate = await this.findOne(organizationId, id);

    if (estimate.status !== ServiceEstimateStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot send estimate in status: ${estimate.status}.`,
      );
    }

    const updated = await this.prisma.serviceEstimate.update({
      where: { id: estimate.id },
      data: { status: ServiceEstimateStatus.SENT },
      include: {
        customer: true,
        customerAsset: true,
        serviceTicket: true,
        lines: { include: { item: true } },
      },
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_ESTIMATE_SENT',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'send',
      resource: 'service_estimate',
      resourceId: updated.id,
      details: {
        estimateNumber: updated.estimateNumber,
      },
    });

    return updated;
  }

  async approve(
    organizationId: string,
    id: string,
    dto: ApproveEstimateDto,
    userId: string,
  ) {
    const estimate = await this.findOne(organizationId, id);

    if (
      estimate.status !== ServiceEstimateStatus.DRAFT &&
      estimate.status !== ServiceEstimateStatus.SENT
    ) {
      throw new BadRequestException(
        `Cannot approve estimate in status: ${estimate.status}.`,
      );
    }

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const est = await tx.serviceEstimate.update({
        where: { id: estimate.id },
        data: {
          status: ServiceEstimateStatus.APPROVED,
          approvedAt: now,
          approvedBy: dto.approvedBy.trim(),
          notes: dto.notes
            ? `${estimate.notes || ''}\n${dto.notes}`
            : estimate.notes,
        },
        include: {
          customer: true,
          customerAsset: true,
          serviceTicket: true,
          lines: { include: { item: true } },
        },
      });

      // Update ticket status to APPROVED
      await tx.serviceTicket.update({
        where: { id: estimate.serviceTicketId },
        data: {
          status: ServiceTicketStatus.APPROVED,
        },
      });

      return est;
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_ESTIMATE_APPROVED',
      occurredAt: now,
      organizationId,
      actorUserId: userId,
      action: 'approve',
      resource: 'service_estimate',
      resourceId: updated.id,
      details: {
        estimateNumber: updated.estimateNumber,
        approvedBy: dto.approvedBy,
      },
    });

    return updated;
  }

  async reject(
    organizationId: string,
    id: string,
    dto: RejectEstimateDto,
    userId: string,
  ) {
    const estimate = await this.findOne(organizationId, id);

    if (
      estimate.status !== ServiceEstimateStatus.DRAFT &&
      estimate.status !== ServiceEstimateStatus.SENT
    ) {
      throw new BadRequestException(
        `Cannot reject estimate in status: ${estimate.status}.`,
      );
    }

    const updated = await this.prisma.serviceEstimate.update({
      where: { id: estimate.id },
      data: {
        status: ServiceEstimateStatus.REJECTED,
        rejectionReason: dto.rejectionReason.trim(),
        notes: dto.notes
          ? `${estimate.notes || ''}\n${dto.notes}`
          : estimate.notes,
      },
      include: {
        customer: true,
        customerAsset: true,
        serviceTicket: true,
        lines: { include: { item: true } },
      },
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_ESTIMATE_REJECTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'reject',
      resource: 'service_estimate',
      resourceId: updated.id,
      details: {
        estimateNumber: updated.estimateNumber,
        rejectionReason: dto.rejectionReason,
      },
    });

    return updated;
  }
}
