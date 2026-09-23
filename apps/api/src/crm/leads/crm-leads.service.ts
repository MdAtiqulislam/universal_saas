import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import {
  CreateLeadDto,
  UpdateLeadDto,
  QualifyLeadDto,
  ConvertLeadDto,
  CloseLeadDto,
  LeadQueryDto,
} from '../dto/lead.dto';
import { LeadStatus, OpportunityStage, Prisma } from '@prisma/client';

@Injectable()
export class CrmLeadsService {
  private readonly logger = new Logger(CrmLeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateLeadDto,
    actorUserId: string,
  ) {
    let leadNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'CRM_LEAD',
        actorUserId,
      );
      leadNumber = seq.formatted;
    } catch {
      const count = await this.prisma.lead.count({ where: { organizationId } });
      leadNumber = `LEAD-${String(count + 1).padStart(6, '0')}`;
    }

    if (dto.assignedEmployeeId) {
      const emp = await this.prisma.employee.findFirst({
        where: { id: dto.assignedEmployeeId, organizationId, deletedAt: null },
      });
      if (!emp) {
        throw new BadRequestException(
          `Assigned employee with ID ${dto.assignedEmployeeId} does not exist in this organization.`,
        );
      }
    }

    const lead = await this.prisma.lead.create({
      data: {
        organizationId,
        leadNumber,
        name: dto.name,
        companyName: dto.companyName,
        source: dto.source,
        priority: dto.priority,
        email: dto.email,
        phone: dto.phone,
        mobile: dto.mobile,
        designation: dto.designation,
        assignedEmployeeId: dto.assignedEmployeeId,
        estimatedValue: dto.estimatedValue
          ? new Prisma.Decimal(dto.estimatedValue)
          : new Prisma.Decimal(0),
        expectedConversionDate: dto.expectedConversionDate
          ? new Date(dto.expectedConversionDate)
          : null,
        notes: dto.notes,
        status: LeadStatus.NEW,
      },
      include: {
        assignedEmployee: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'LEAD_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'create_lead',
      resource: 'lead',
      resourceId: lead.id,
      details: {
        leadNumber: lead.leadNumber,
        name: lead.name,
        companyName: lead.companyName,
      },
    });

    return lead;
  }

  async findAll(organizationId: string, query?: LeadQueryDto) {
    const where: Prisma.LeadWhereInput = { organizationId };

    if (query?.status) where.status = query.status;
    if (query?.source) where.source = query.source;
    if (query?.priority) where.priority = query.priority;
    if (query?.assignedEmployeeId)
      where.assignedEmployeeId = query.assignedEmployeeId;

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { companyName: { contains: query.search, mode: 'insensitive' } },
        { leadNumber: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.lead.findMany({
      where,
      include: {
        assignedEmployee: true,
        convertedCustomer: true,
        convertedOpportunity: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId },
      include: {
        assignedEmployee: true,
        convertedCustomer: true,
        convertedOpportunity: true,
        crmActivities: {
          include: { assignedEmployee: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(
        `Lead with ID ${id} not found in this organization.`,
      );
    }

    return lead;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateLeadDto,
    actorUserId: string,
  ) {
    const existing = await this.findOne(organizationId, id);

    if (existing.status === LeadStatus.CONVERTED) {
      throw new BadRequestException('Cannot modify a converted lead.');
    }

    if (dto.assignedEmployeeId) {
      const emp = await this.prisma.employee.findFirst({
        where: { id: dto.assignedEmployeeId, organizationId, deletedAt: null },
      });
      if (!emp) {
        throw new BadRequestException('Assigned employee does not exist.');
      }
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        name: dto.name,
        companyName: dto.companyName,
        source: dto.source,
        status: dto.status,
        priority: dto.priority,
        email: dto.email,
        phone: dto.phone,
        mobile: dto.mobile,
        designation: dto.designation,
        assignedEmployeeId: dto.assignedEmployeeId,
        estimatedValue:
          dto.estimatedValue !== undefined
            ? new Prisma.Decimal(dto.estimatedValue)
            : undefined,
        expectedConversionDate: dto.expectedConversionDate
          ? new Date(dto.expectedConversionDate)
          : undefined,
        notes: dto.notes,
        lostReason: dto.lostReason,
      },
      include: {
        assignedEmployee: true,
        convertedCustomer: true,
        convertedOpportunity: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'LEAD_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'update_lead',
      resource: 'lead',
      resourceId: updated.id,
      details: { leadNumber: updated.leadNumber },
    });

    return updated;
  }

  async qualify(
    organizationId: string,
    id: string,
    dto: QualifyLeadDto,
    actorUserId: string,
  ) {
    const lead = await this.findOne(organizationId, id);

    if (
      lead.status === LeadStatus.CONVERTED ||
      lead.status === LeadStatus.LOST ||
      lead.status === LeadStatus.CLOSED
    ) {
      throw new BadRequestException(
        `Cannot qualify lead in status: ${lead.status}.`,
      );
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        status: LeadStatus.QUALIFIED,
        qualificationNotes: dto.qualificationNotes,
        estimatedValue:
          dto.estimatedValue !== undefined
            ? new Prisma.Decimal(dto.estimatedValue)
            : lead.estimatedValue,
        expectedConversionDate: dto.expectedConversionDate
          ? new Date(dto.expectedConversionDate)
          : lead.expectedConversionDate,
      },
      include: {
        assignedEmployee: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'LEAD_QUALIFIED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'qualify_lead',
      resource: 'lead',
      resourceId: lead.id,
      details: { leadNumber: lead.leadNumber },
    });

    return updated;
  }

  async convert(
    organizationId: string,
    id: string,
    dto: ConvertLeadDto,
    actorUserId: string,
  ) {
    const lead = await this.findOne(organizationId, id);

    if (lead.status === LeadStatus.CONVERTED) {
      throw new ConflictException('Lead is already converted.');
    }

    if (lead.status === LeadStatus.LOST || lead.status === LeadStatus.CLOSED) {
      throw new BadRequestException(
        `Cannot convert a lead in status ${lead.status}.`,
      );
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      let customerId = dto.existingCustomerId;

      if (customerId) {
        const existingCust = await tx.customer.findFirst({
          where: { id: customerId, organizationId, deletedAt: null },
        });
        if (!existingCust) {
          throw new BadRequestException(
            'Existing customer not found in organization.',
          );
        }
      } else {
        // Create new Customer
        const customerName =
          dto.newCustomerName || lead.companyName || lead.name;
        let customerCode: string;
        try {
          const custSeq = await this.numberingService.nextNumber(
            organizationId,
            'CUSTOMER',
            actorUserId,
          );
          customerCode = custSeq.formatted;
        } catch {
          const count = await tx.customer.count({ where: { organizationId } });
          customerCode = `CUST-${String(count + 1).padStart(5, '0')}`;
        }

        const newCustomer = await tx.customer.create({
          data: {
            organizationId,
            code: customerCode,
            name: customerName,
            email: lead.email,
            phone: lead.phone || lead.mobile,
            notes:
              `Converted from Lead ${lead.leadNumber}. ${lead.notes || ''}`.trim(),
          },
        });

        customerId = newCustomer.id;

        // Create Customer Contact
        await tx.customerContact.create({
          data: {
            organizationId,
            customerId: newCustomer.id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            mobile: lead.mobile,
            designation: lead.designation,
            isPrimary: true,
          },
        });
      }

      // Create Opportunity
      let oppNumber: string;
      try {
        const oppSeq = await this.numberingService.nextNumber(
          organizationId,
          'CRM_OPPORTUNITY',
          actorUserId,
        );
        oppNumber = oppSeq.formatted;
      } catch {
        const count = await tx.opportunity.count({ where: { organizationId } });
        oppNumber = `OPP-${String(count + 1).padStart(6, '0')}`;
      }

      const oppTitle =
        dto.opportunityTitle ||
        `Opportunity for ${lead.companyName || lead.name}`;
      const estimatedValue =
        dto.estimatedValue !== undefined
          ? new Prisma.Decimal(dto.estimatedValue)
          : lead.estimatedValue;
      const expectedCloseDate = dto.expectedCloseDate
        ? new Date(dto.expectedCloseDate)
        : lead.expectedConversionDate;

      // Get primary contact of customer
      const primaryContact = await tx.customerContact.findFirst({
        where: { customerId, organizationId, isPrimary: true },
      });

      const opportunity = await tx.opportunity.create({
        data: {
          organizationId,
          opportunityNumber: oppNumber,
          customerId,
          primaryContactId: primaryContact?.id,
          leadId: lead.id,
          ownerEmployeeId: lead.assignedEmployeeId,
          title: oppTitle,
          description: lead.notes,
          stage: OpportunityStage.QUALIFICATION,
          probability: new Prisma.Decimal(25),
          estimatedValue,
          expectedCloseDate,
          source: lead.source,
        },
      });

      // Update Lead to CONVERTED
      const convertedLead = await tx.lead.update({
        where: { id },
        data: {
          status: LeadStatus.CONVERTED,
          convertedCustomerId: customerId,
          convertedOpportunityId: opportunity.id,
          convertedAt: now,
          convertedByUserId: actorUserId,
        },
        include: {
          convertedCustomer: true,
          convertedOpportunity: true,
        },
      });

      return {
        lead: convertedLead,
        customerId,
        opportunity,
      };
    });

    await this.eventBus.publish({
      eventName: 'LEAD_CONVERTED',
      occurredAt: now,
      organizationId,
      actorUserId,
      action: 'convert_lead',
      resource: 'lead',
      resourceId: lead.id,
      details: {
        leadNumber: lead.leadNumber,
        customerId: result.customerId,
        opportunityNumber: result.opportunity.opportunityNumber,
      },
    });

    return result;
  }

  async close(
    organizationId: string,
    id: string,
    dto: CloseLeadDto,
    actorUserId: string,
  ) {
    const lead = await this.findOne(organizationId, id);

    if (lead.status === LeadStatus.CONVERTED) {
      throw new BadRequestException('Cannot close a converted lead.');
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        status: LeadStatus.LOST,
        lostReason: dto.lostReason,
      },
      include: {
        assignedEmployee: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'LEAD_LOST',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'close_lead',
      resource: 'lead',
      resourceId: lead.id,
      details: {
        leadNumber: lead.leadNumber,
        lostReason: dto.lostReason,
      },
    });

    return updated;
  }
}
