import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import {
  CreateCrmActivityDto,
  UpdateCrmActivityDto,
  CompleteCrmActivityDto,
  ActivityQueryDto,
} from '../dto/activity.dto';
import { ActivityStatus, Prisma } from '@prisma/client';

@Injectable()
export class CrmActivitiesService {
  private readonly logger = new Logger(CrmActivitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateCrmActivityDto,
    actorUserId: string,
  ) {
    // 1. Verify links if provided
    if (dto.leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: { id: dto.leadId, organizationId },
      });
      if (!lead)
        throw new BadRequestException('Lead not found in organization.');
    }

    if (dto.opportunityId) {
      const opp = await this.prisma.opportunity.findFirst({
        where: { id: dto.opportunityId, organizationId },
      });
      if (!opp)
        throw new BadRequestException('Opportunity not found in organization.');
    }

    if (dto.customerId) {
      const cust = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, organizationId, deletedAt: null },
      });
      if (!cust)
        throw new BadRequestException('Customer not found in organization.');
    }

    if (dto.contactId) {
      const contact = await this.prisma.customerContact.findFirst({
        where: { id: dto.contactId, organizationId },
      });
      if (!contact)
        throw new BadRequestException('Contact not found in organization.');
    }

    if (dto.assignedEmployeeId) {
      const emp = await this.prisma.employee.findFirst({
        where: { id: dto.assignedEmployeeId, organizationId, deletedAt: null },
      });
      if (!emp)
        throw new BadRequestException(
          'Assigned employee not found in organization.',
        );
    }

    const activity = await this.prisma.crmActivity.create({
      data: {
        organizationId,
        type: dto.type,
        subject: dto.subject,
        description: dto.description,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: ActivityStatus.PENDING,
        assignedEmployeeId: dto.assignedEmployeeId,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
        leadId: dto.leadId,
        opportunityId: dto.opportunityId,
        customerId: dto.customerId,
        contactId: dto.contactId,
      },
      include: {
        assignedEmployee: true,
        lead: true,
        opportunity: true,
        customer: true,
        contact: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'CRM_ACTIVITY_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'create_activity',
      resource: 'crm_activity',
      resourceId: activity.id,
      details: {
        type: activity.type,
        subject: activity.subject,
      },
    });

    return activity;
  }

  async findAll(organizationId: string, query?: ActivityQueryDto) {
    const where: Prisma.CrmActivityWhereInput = { organizationId };

    if (query?.type) where.type = query.type;
    if (query?.status) where.status = query.status;
    if (query?.leadId) where.leadId = query.leadId;
    if (query?.opportunityId) where.opportunityId = query.opportunityId;
    if (query?.customerId) where.customerId = query.customerId;
    if (query?.assignedEmployeeId)
      where.assignedEmployeeId = query.assignedEmployeeId;

    if (query?.search) {
      where.OR = [
        { subject: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { outcome: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.crmActivity.findMany({
      where,
      include: {
        assignedEmployee: true,
        lead: true,
        opportunity: true,
        customer: true,
        contact: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const activity = await this.prisma.crmActivity.findFirst({
      where: { id, organizationId },
      include: {
        assignedEmployee: true,
        lead: true,
        opportunity: true,
        customer: true,
        contact: true,
      },
    });

    if (!activity) {
      throw new NotFoundException(
        `Activity with ID ${id} not found in this organization.`,
      );
    }

    return activity;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateCrmActivityDto,
    actorUserId: string,
  ) {
    await this.findOne(organizationId, id);

    const updated = await this.prisma.crmActivity.update({
      where: { id },
      data: {
        type: dto.type,
        subject: dto.subject,
        description: dto.description,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        status: dto.status,
        assignedEmployeeId: dto.assignedEmployeeId,
        outcome: dto.outcome,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : undefined,
      },
      include: {
        assignedEmployee: true,
        lead: true,
        opportunity: true,
        customer: true,
        contact: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'CRM_ACTIVITY_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'update_activity',
      resource: 'crm_activity',
      resourceId: updated.id,
      details: { subject: updated.subject },
    });

    return updated;
  }

  async complete(
    organizationId: string,
    id: string,
    dto: CompleteCrmActivityDto,
    actorUserId: string,
  ) {
    await this.findOne(organizationId, id);

    const now = dto.completedAt ? new Date(dto.completedAt) : new Date();

    const updated = await this.prisma.crmActivity.update({
      where: { id },
      data: {
        status: ActivityStatus.COMPLETED,
        completedAt: now,
        outcome: dto.outcome,
      },
      include: {
        assignedEmployee: true,
        lead: true,
        opportunity: true,
        customer: true,
        contact: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'CRM_ACTIVITY_COMPLETED',
      occurredAt: now,
      organizationId,
      actorUserId,
      action: 'complete_activity',
      resource: 'crm_activity',
      resourceId: updated.id,
      details: { subject: updated.subject, outcome: updated.outcome },
    });

    return updated;
  }

  async delete(organizationId: string, id: string, actorUserId: string) {
    await this.findOne(organizationId, id);

    await this.prisma.crmActivity.delete({
      where: { id },
    });

    return { success: true };
  }
}
