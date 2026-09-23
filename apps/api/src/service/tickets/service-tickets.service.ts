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
  CreateServiceTicketDto,
  AssignTechnicianDto,
  QueryServiceTicketDto,
} from '../dto/service-ticket.dto';
import {
  ServiceTicket,
  ServiceTicketStatus,
  ServiceSlaStatus,
  EmploymentStatus,
  Prisma,
} from '@prisma/client';

export type ServiceTicketWithDetails = Prisma.ServiceTicketGetPayload<{
  include: {
    customer: true;
    customerAsset: true;
    item: true;
    variant: true;
    assignedTechnician: true;
    assignments: {
      include: { employee: true };
    };
    diagnoses: {
      include: { technician: true };
    };
    estimates: {
      include: { lines: true };
    };
    serviceOrders: true;
    serviceRequest: true;
  };
}>;

@Injectable()
export class ServiceTicketsService {
  private readonly logger = new Logger(ServiceTicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  async findAll(
    organizationId: string,
    query?: QueryServiceTicketDto,
  ): Promise<ServiceTicketWithDetails[]> {
    const where: Prisma.ServiceTicketWhereInput = { organizationId };

    if (query?.customerId) where.customerId = query.customerId;
    if (query?.customerAssetId) where.customerAssetId = query.customerAssetId;
    if (query?.status) where.status = query.status;
    if (query?.priority) where.priority = query.priority;
    if (query?.slaStatus) where.slaStatus = query.slaStatus;
    if (query?.assignedTechnicianId)
      where.assignedTechnicianId = query.assignedTechnicianId;
    if (query?.search) {
      where.OR = [
        { ticketNumber: { contains: query.search, mode: 'insensitive' } },
        { subject: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.serviceTicket.findMany({
      where,
      include: {
        customer: true,
        customerAsset: true,
        item: true,
        variant: true,
        assignedTechnician: true,
        assignments: {
          include: { employee: true },
        },
        diagnoses: {
          include: { technician: true },
        },
        estimates: {
          include: { lines: true },
        },
        serviceOrders: true,
        serviceRequest: true,
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<ServiceTicketWithDetails> {
    const ticket = await this.prisma.serviceTicket.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        customerAsset: true,
        item: true,
        variant: true,
        assignedTechnician: true,
        assignments: {
          include: { employee: true },
        },
        diagnoses: {
          include: { technician: true },
        },
        estimates: {
          include: { lines: true },
        },
        serviceOrders: true,
        serviceRequest: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException(
        `Service ticket with ID ${id} not found in this organization.`,
      );
    }

    return ticket;
  }

  async create(
    organizationId: string,
    dto: CreateServiceTicketDto,
    userId: string,
  ): Promise<ServiceTicket> {
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

    // 3. Validate technician if supplied
    if (dto.assignedTechnicianId) {
      const technician = await this.prisma.employee.findFirst({
        where: {
          id: dto.assignedTechnicianId,
          organizationId,
          employmentStatus: EmploymentStatus.ACTIVE,
        },
      });
      if (!technician) {
        throw new BadRequestException(
          `Technician with ID ${dto.assignedTechnicianId} is not active in this organization.`,
        );
      }
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

    const config = await this.prisma.serviceConfiguration.findFirst({
      where: { organizationId },
    });
    const slaHours = config?.defaultServiceSlaHours ?? 48;
    const now = new Date();
    const resolutionDueAt = new Date(now.getTime() + slaHours * 3600 * 1000);
    const firstResponseDueAt = new Date(now.getTime() + 4 * 3600 * 1000);

    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.serviceTicket.create({
        data: {
          organizationId,
          ticketNumber,
          serviceRequestId: dto.serviceRequestId || null,
          customerId: dto.customerId,
          customerAssetId: dto.customerAssetId || null,
          itemId: dto.itemId,
          variantId: dto.variantId || null,
          priority: dto.priority,
          status: dto.assignedTechnicianId
            ? ServiceTicketStatus.ASSIGNED
            : ServiceTicketStatus.OPEN,
          slaStatus: ServiceSlaStatus.ON_TRACK,
          openedAt: now,
          firstResponseDueAt,
          resolutionDueAt,
          assignedTechnicianId: dto.assignedTechnicianId || null,
          assignedAt: dto.assignedTechnicianId ? now : null,
          subject: dto.subject.trim(),
          description: dto.description.trim(),
        },
      });

      if (dto.assignedTechnicianId) {
        await tx.serviceAssignment.create({
          data: {
            organizationId,
            serviceTicketId: created.id,
            employeeId: dto.assignedTechnicianId,
            role: 'TECHNICIAN',
            assignedAt: now,
            assignedByUserId: userId,
            status: 'ACCEPTED',
          },
        });
      }

      return created;
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_TICKET_CREATED',
      occurredAt: now,
      organizationId,
      actorUserId: userId,
      action: 'create',
      resource: 'service_ticket',
      resourceId: ticket.id,
      details: {
        ticketNumber: ticket.ticketNumber,
        customerId: ticket.customerId,
        status: ticket.status,
      },
    });

    return ticket;
  }

  async assign(
    organizationId: string,
    ticketId: string,
    dto: AssignTechnicianDto,
    userId: string,
  ): Promise<ServiceTicket> {
    const ticket = await this.findOne(organizationId, ticketId);

    // Validate technician in organization and active
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: dto.employeeId,
        organizationId,
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });
    if (!employee) {
      throw new BadRequestException(
        `Employee with ID ${dto.employeeId} is not an active technician in this organization.`,
      );
    }

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const t = await tx.serviceTicket.update({
        where: { id: ticket.id },
        data: {
          assignedTechnicianId: employee.id,
          assignedAt: now,
          status:
            ticket.status === ServiceTicketStatus.OPEN ||
            ticket.status === ServiceTicketStatus.TRIAGED
              ? ServiceTicketStatus.ASSIGNED
              : ticket.status,
        },
      });

      await tx.serviceAssignment.create({
        data: {
          organizationId,
          serviceTicketId: t.id,
          employeeId: employee.id,
          role: dto.role || 'TECHNICIAN',
          assignedAt: now,
          assignedByUserId: userId,
          status: 'ACCEPTED',
          notes: dto.notes || null,
        },
      });

      return t;
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_TICKET_ASSIGNED',
      occurredAt: now,
      organizationId,
      actorUserId: userId,
      action: 'assign',
      resource: 'service_ticket',
      resourceId: updated.id,
      details: {
        ticketNumber: updated.ticketNumber,
        technicianId: employee.id,
        technicianName: `${employee.firstName} ${employee.lastName}`,
      },
    });

    return updated;
  }

  async startDiagnosis(
    organizationId: string,
    ticketId: string,
    userId: string,
  ): Promise<ServiceTicket> {
    const ticket = await this.findOne(organizationId, ticketId);

    if (
      ticket.status === ServiceTicketStatus.CLOSED ||
      ticket.status === ServiceTicketStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot start diagnosis on ticket in status: ${ticket.status}.`,
      );
    }

    const updated = await this.prisma.serviceTicket.update({
      where: { id: ticket.id },
      data: {
        status: ServiceTicketStatus.IN_DIAGNOSIS,
        firstResponseAt: ticket.firstResponseAt || new Date(),
      },
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_TICKET_DIAGNOSIS_STARTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'start_diagnosis',
      resource: 'service_ticket',
      resourceId: updated.id,
      details: {
        ticketNumber: updated.ticketNumber,
        status: updated.status,
      },
    });

    return updated;
  }

  async hold(
    organizationId: string,
    ticketId: string,
    reason: string,
    userId: string,
  ): Promise<ServiceTicket> {
    const ticket = await this.findOne(organizationId, ticketId);

    return this.prisma.serviceTicket.update({
      where: { id: ticket.id },
      data: {
        status: ServiceTicketStatus.ON_HOLD,
        breachReason: reason || null,
      },
    });
  }

  async resume(
    organizationId: string,
    ticketId: string,
    userId: string,
  ): Promise<ServiceTicket> {
    const ticket = await this.findOne(organizationId, ticketId);

    if (ticket.status !== ServiceTicketStatus.ON_HOLD) {
      throw new BadRequestException(
        `Ticket is not ON_HOLD (current status: ${ticket.status}).`,
      );
    }

    return this.prisma.serviceTicket.update({
      where: { id: ticket.id },
      data: {
        status: ticket.assignedTechnicianId
          ? ServiceTicketStatus.ASSIGNED
          : ServiceTicketStatus.OPEN,
      },
    });
  }

  async updateSlaStatus(organizationId: string, ticketId: string) {
    const ticket = await this.findOne(organizationId, ticketId);
    const now = new Date();

    let slaStatus: ServiceSlaStatus = ticket.slaStatus;
    let breachReason = ticket.breachReason;

    if (
      ticket.status === ServiceTicketStatus.COMPLETED ||
      ticket.status === ServiceTicketStatus.HANDED_OVER ||
      ticket.status === ServiceTicketStatus.CLOSED
    ) {
      slaStatus = ServiceSlaStatus.MET;
    } else if (ticket.resolutionDueAt && now > ticket.resolutionDueAt) {
      slaStatus = ServiceSlaStatus.BREACHED;
      breachReason = `Resolution SLA breached at ${ticket.resolutionDueAt.toISOString()}`;
    } else if (
      ticket.resolutionDueAt &&
      ticket.resolutionDueAt.getTime() - now.getTime() < 4 * 3600 * 1000
    ) {
      slaStatus = ServiceSlaStatus.AT_RISK;
    }

    if (slaStatus !== ticket.slaStatus) {
      const updated = await this.prisma.serviceTicket.update({
        where: { id: ticket.id },
        data: { slaStatus, breachReason },
      });

      if (slaStatus === ServiceSlaStatus.BREACHED) {
        await this.eventBus.publish({
          eventName: 'SERVICE_SLA_BREACHED',
          occurredAt: now,
          organizationId,
          actorUserId: null,
          action: 'sla_breached',
          resource: 'service_ticket',
          resourceId: ticket.id,
          details: {
            ticketNumber: ticket.ticketNumber,
            resolutionDueAt: ticket.resolutionDueAt,
          },
        });
      }

      return updated;
    }

    return ticket;
  }
}
