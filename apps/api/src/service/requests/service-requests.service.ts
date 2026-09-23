import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { WarrantyEligibilityService } from '../warranty/warranty-eligibility.service';
import {
  CreateServiceRequestDto,
  UpdateServiceRequestDto,
  TriageServiceRequestDto,
  QueryServiceRequestDto,
} from '../dto/service-request.dto';
import {
  ServiceRequest,
  ServiceRequestStatus,
  ServiceTicketStatus,
  ServiceSlaStatus,
  Prisma,
} from '@prisma/client';

export type ServiceRequestWithDetails = Prisma.ServiceRequestGetPayload<{
  include: {
    customer: true;
    customerAsset: true;
    item: true;
    variant: true;
    sourceRma: true;
    tickets: true;
  };
}>;

@Injectable()
export class ServiceRequestsService {
  private readonly logger = new Logger(ServiceRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly warrantyEligibilityService: WarrantyEligibilityService,
  ) {}

  async findAll(
    organizationId: string,
    query?: QueryServiceRequestDto,
  ): Promise<ServiceRequestWithDetails[]> {
    const where: Prisma.ServiceRequestWhereInput = { organizationId };

    if (query?.customerId) where.customerId = query.customerId;
    if (query?.customerAssetId) where.customerAssetId = query.customerAssetId;
    if (query?.status) where.status = query.status;
    if (query?.priority) where.priority = query.priority;
    if (query?.requestType) where.requestType = query.requestType;
    if (query?.search) {
      where.OR = [
        { requestNumber: { contains: query.search, mode: 'insensitive' } },
        { subject: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { issueCategory: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.serviceRequest.findMany({
      where,
      include: {
        customer: true,
        customerAsset: true,
        item: true,
        variant: true,
        sourceRma: true,
        tickets: true,
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<ServiceRequestWithDetails> {
    const req = await this.prisma.serviceRequest.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        customerAsset: true,
        item: true,
        variant: true,
        sourceRma: true,
        tickets: true,
      },
    });

    if (!req) {
      throw new NotFoundException(
        `Service request with ID ${id} not found in this organization.`,
      );
    }

    return req;
  }

  async create(
    organizationId: string,
    dto: CreateServiceRequestDto,
    userId: string,
  ): Promise<ServiceRequest> {
    // 1. Validate customer
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId },
    });
    if (!customer) {
      throw new BadRequestException(
        `Customer with ID ${dto.customerId} does not belong to this organization.`,
      );
    }

    // 2. Validate item
    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, organizationId },
    });
    if (!item) {
      throw new BadRequestException(
        `Item with ID ${dto.itemId} does not belong to this organization.`,
      );
    }

    // 3. Validate asset if provided
    let warrantyEligibilityResult: any = null;
    if (dto.customerAssetId) {
      const asset = await this.prisma.customerAsset.findFirst({
        where: { id: dto.customerAssetId, organizationId },
      });
      if (!asset) {
        throw new BadRequestException(
          `Customer asset with ID ${dto.customerAssetId} does not belong to this organization.`,
        );
      }

      // Check warranty eligibility
      warrantyEligibilityResult =
        await this.warrantyEligibilityService.checkEligibility(
          organizationId,
          {
            customerAssetId: asset.id,
            serviceDate: new Date().toISOString(),
            issueCategory: dto.issueCategory,
          },
          userId,
        );
    }

    // 4. Validate source RMA if provided
    if (dto.sourceRmaId) {
      const rma = await this.prisma.returnRequest.findFirst({
        where: { id: dto.sourceRmaId, organizationId },
      });
      if (!rma) {
        throw new BadRequestException(
          `Return request with ID ${dto.sourceRmaId} does not belong to this organization.`,
        );
      }
    }

    // Generate requestNumber
    let requestNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'SERVICE_REQUEST',
        userId,
      );
      requestNumber = seq.formatted;
    } catch {
      const count = await this.prisma.serviceRequest.count({
        where: { organizationId },
      });
      requestNumber = `SR-${String(count + 1).padStart(6, '0')}`;
    }

    const created = await this.prisma.serviceRequest.create({
      data: {
        organizationId,
        requestNumber,
        customerId: dto.customerId,
        customerAssetId: dto.customerAssetId || null,
        itemId: dto.itemId,
        variantId: dto.variantId || null,
        serialNumber: dto.serialNumber || null,
        requestType: dto.requestType,
        priority: dto.priority,
        issueCategory: dto.issueCategory.trim(),
        subject: dto.subject.trim(),
        description: dto.description.trim(),
        sourceRmaId: dto.sourceRmaId || null,
        preferredServiceDate: dto.preferredServiceDate
          ? new Date(dto.preferredServiceDate)
          : null,
        warrantyEligibility: warrantyEligibilityResult,
        status: ServiceRequestStatus.SUBMITTED,
        createdByUserId: userId,
      },
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_REQUEST_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'create',
      resource: 'service_request',
      resourceId: created.id,
      details: {
        requestNumber: created.requestNumber,
        customerId: created.customerId,
        priority: created.priority,
        status: created.status,
      },
    });

    return created;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateServiceRequestDto,
    userId: string,
  ): Promise<ServiceRequest> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === ServiceRequestStatus.CANCELLED ||
      existing.status === ServiceRequestStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Cannot update service request in status: ${existing.status}.`,
      );
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id: existing.id },
      data: {
        priority: dto.priority ?? existing.priority,
        issueCategory: dto.issueCategory
          ? dto.issueCategory.trim()
          : existing.issueCategory,
        subject: dto.subject ? dto.subject.trim() : existing.subject,
        description: dto.description
          ? dto.description.trim()
          : existing.description,
        preferredServiceDate: dto.preferredServiceDate
          ? new Date(dto.preferredServiceDate)
          : existing.preferredServiceDate,
      },
    });

    return updated;
  }

  async triage(
    organizationId: string,
    id: string,
    dto: TriageServiceRequestDto,
    userId: string,
  ) {
    const req = await this.findOne(organizationId, id);

    if (
      req.status !== ServiceRequestStatus.SUBMITTED &&
      req.status !== ServiceRequestStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Cannot triage service request in status: ${req.status}.`,
      );
    }

    // Generate ticketNumber
    let ticketNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'SERVICE_TICKET',
        userId,
      );
      ticketNumber = seq.formatted;
    } catch {
      const count = await this.prisma.serviceTicket.count({
        where: { organizationId },
      });
      ticketNumber = `ST-${String(count + 1).padStart(6, '0')}`;
    }

    // Fetch config for SLA calculation
    const config = await this.prisma.serviceConfiguration.findFirst({
      where: { organizationId },
    });
    const slaHours = config?.defaultServiceSlaHours ?? 48;
    const now = new Date();
    const resolutionDueAt = new Date(now.getTime() + slaHours * 3600 * 1000);
    const firstResponseDueAt = new Date(now.getTime() + 4 * 3600 * 1000); // 4 hours

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create Ticket
      const ticket = await tx.serviceTicket.create({
        data: {
          organizationId,
          ticketNumber,
          serviceRequestId: req.id,
          customerId: req.customerId,
          customerAssetId: req.customerAssetId,
          itemId: req.itemId,
          variantId: req.variantId,
          priority: dto.priority || req.priority,
          status: dto.assignedTechnicianId
            ? ServiceTicketStatus.ASSIGNED
            : ServiceTicketStatus.TRIAGED,
          slaStatus: ServiceSlaStatus.ON_TRACK,
          openedAt: now,
          firstResponseDueAt,
          resolutionDueAt,
          assignedTechnicianId: dto.assignedTechnicianId || null,
          assignedAt: dto.assignedTechnicianId ? now : null,
          subject: req.subject,
          description: req.description,
        },
      });

      // 2. Create Assignment if technician assigned
      if (dto.assignedTechnicianId) {
        await tx.serviceAssignment.create({
          data: {
            organizationId,
            serviceTicketId: ticket.id,
            employeeId: dto.assignedTechnicianId,
            role: 'TECHNICIAN',
            assignedAt: now,
            assignedByUserId: userId,
            status: 'ACCEPTED',
          },
        });
      }

      // 3. Update Request status
      const updatedReq = await tx.serviceRequest.update({
        where: { id: req.id },
        data: {
          status: ServiceRequestStatus.CONVERTED_TO_TICKET,
          triagedByUserId: userId,
          triagedAt: now,
          triageNotes: dto.triageNotes.trim(),
        },
      });

      return { request: updatedReq, ticket };
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_REQUEST_TRIAGED',
      occurredAt: now,
      organizationId,
      actorUserId: userId,
      action: 'triage',
      resource: 'service_request',
      resourceId: req.id,
      details: {
        requestNumber: req.requestNumber,
        ticketNumber: result.ticket.ticketNumber,
        triageNotes: dto.triageNotes,
      },
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_TICKET_CREATED',
      occurredAt: now,
      organizationId,
      actorUserId: userId,
      action: 'create',
      resource: 'service_ticket',
      resourceId: result.ticket.id,
      details: {
        ticketNumber: result.ticket.ticketNumber,
        customerId: result.ticket.customerId,
        status: result.ticket.status,
      },
    });

    return result;
  }

  async cancel(
    organizationId: string,
    id: string,
    reason: string,
    userId: string,
  ): Promise<ServiceRequest> {
    const req = await this.findOne(organizationId, id);

    if (
      req.status === ServiceRequestStatus.CONVERTED_TO_TICKET ||
      req.status === ServiceRequestStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel service request in status: ${req.status}.`,
      );
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id: req.id },
      data: {
        status: ServiceRequestStatus.CANCELLED,
        triageNotes: reason ? reason.trim() : req.triageNotes,
      },
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_REQUEST_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'cancel',
      resource: 'service_request',
      resourceId: updated.id,
      details: {
        requestNumber: updated.requestNumber,
        reason,
      },
    });

    return updated;
  }
}
