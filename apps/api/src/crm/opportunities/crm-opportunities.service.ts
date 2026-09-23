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
  CreateOpportunityDto,
  UpdateOpportunityDto,
  ChangeOpportunityStageDto,
  CloseOpportunityWonDto,
  CloseOpportunityLostDto,
  OpportunityQueryDto,
} from '../dto/opportunity.dto';
import {
  CreateOpportunityLineDto,
  UpdateOpportunityLineDto,
} from '../dto/opportunity-line.dto';
import { OpportunityStatus, OpportunityStage, Prisma } from '@prisma/client';

@Injectable()
export class CrmOpportunitiesService {
  private readonly logger = new Logger(CrmOpportunitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  private computeLineValues(
    lineDto: CreateOpportunityLineDto | UpdateOpportunityLineDto,
  ) {
    const qty = new Prisma.Decimal(lineDto.quantity ?? 1);
    const unitPrice = new Prisma.Decimal(lineDto.unitPrice ?? 0);
    const discount = new Prisma.Decimal(lineDto.discountAmount ?? 0);
    const taxRate = new Prisma.Decimal(lineDto.taxRate ?? 0);

    const subtotal = qty.mul(unitPrice).sub(discount);
    const taxAmount = subtotal.mul(taxRate).div(100);
    const estimatedAmount = subtotal.add(taxAmount);

    return {
      quantity: qty,
      unitPrice,
      discountAmount: discount,
      taxRate,
      taxAmount,
      estimatedAmount,
    };
  }

  async create(
    organizationId: string,
    dto: CreateOpportunityDto,
    actorUserId: string,
  ) {
    // 1. Verify Customer exists
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId, deletedAt: null },
    });
    if (!customer) {
      throw new BadRequestException(
        `Customer with ID ${dto.customerId} does not exist in this organization.`,
      );
    }

    // 2. Verify Primary Contact if provided
    if (dto.primaryContactId) {
      const contact = await this.prisma.customerContact.findFirst({
        where: {
          id: dto.primaryContactId,
          organizationId,
          customerId: dto.customerId,
        },
      });
      if (!contact) {
        throw new BadRequestException(
          'Primary contact does not exist or belong to this customer.',
        );
      }
    }

    // 3. Verify Owner Employee if provided
    if (dto.ownerEmployeeId) {
      const emp = await this.prisma.employee.findFirst({
        where: { id: dto.ownerEmployeeId, organizationId, deletedAt: null },
      });
      if (!emp) {
        throw new BadRequestException('Owner employee does not exist.');
      }
    }

    // 4. Generate Opportunity Number
    let opportunityNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'CRM_OPPORTUNITY',
        actorUserId,
      );
      opportunityNumber = seq.formatted;
    } catch {
      const count = await this.prisma.opportunity.count({
        where: { organizationId },
      });
      opportunityNumber = `OPP-${String(count + 1).padStart(6, '0')}`;
    }

    // 5. Build lines and calculate value
    let computedEstimatedValue = dto.estimatedValue
      ? new Prisma.Decimal(dto.estimatedValue)
      : new Prisma.Decimal(0);

    const linesData: Array<{
      organizationId: string;
      itemId: string;
      variantId?: string | null;
      description?: string | null;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      estimatedAmount: Prisma.Decimal;
    }> = [];

    if (dto.lines && dto.lines.length > 0) {
      let linesTotal = new Prisma.Decimal(0);
      for (const l of dto.lines) {
        const item = await this.prisma.item.findFirst({
          where: { id: l.itemId, organizationId, deletedAt: null },
        });
        if (!item) {
          throw new BadRequestException(
            `Item ${l.itemId} not found in this organization.`,
          );
        }

        const computed = this.computeLineValues(l);
        linesData.push({
          organizationId,
          itemId: l.itemId,
          variantId: l.variantId,
          description: l.description,
          ...computed,
        });
        linesTotal = linesTotal.add(computed.estimatedAmount);
      }
      computedEstimatedValue = linesTotal;
    }

    const defaultProbability =
      dto.probability !== undefined
        ? new Prisma.Decimal(dto.probability)
        : new Prisma.Decimal(10);

    const opportunity = await this.prisma.opportunity.create({
      data: {
        organizationId,
        opportunityNumber,
        customerId: dto.customerId,
        primaryContactId: dto.primaryContactId,
        leadId: dto.leadId,
        ownerEmployeeId: dto.ownerEmployeeId,
        title: dto.title,
        description: dto.description,
        stage: dto.stage || OpportunityStage.PROSPECTING,
        status: OpportunityStatus.OPEN,
        probability: defaultProbability,
        estimatedValue: computedEstimatedValue,
        expectedCloseDate: dto.expectedCloseDate
          ? new Date(dto.expectedCloseDate)
          : null,
        source: dto.source,
        currencyId: dto.currencyId || customer.currencyId,
        lines: {
          create: linesData,
        },
      },
      include: {
        customer: true,
        primaryContact: true,
        ownerEmployee: true,
        lines: { include: { item: true, variant: true } },
      },
    });

    await this.eventBus.publish({
      eventName: 'OPPORTUNITY_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'create_opportunity',
      resource: 'opportunity',
      resourceId: opportunity.id,
      details: {
        opportunityNumber: opportunity.opportunityNumber,
        title: opportunity.title,
        estimatedValue: opportunity.estimatedValue.toString(),
      },
    });

    return opportunity;
  }

  async findAll(organizationId: string, query?: OpportunityQueryDto) {
    const where: Prisma.OpportunityWhereInput = { organizationId };

    if (query?.status) where.status = query.status;
    if (query?.stage) where.stage = query.stage;
    if (query?.customerId) where.customerId = query.customerId;
    if (query?.ownerEmployeeId) where.ownerEmployeeId = query.ownerEmployeeId;

    if (query?.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { opportunityNumber: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.opportunity.findMany({
      where,
      include: {
        customer: true,
        primaryContact: true,
        ownerEmployee: true,
        lines: { include: { item: true, variant: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const opp = await this.prisma.opportunity.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        primaryContact: true,
        ownerEmployee: true,
        sourceLead: true,
        currency: true,
        lines: { include: { item: true, variant: true } },
        quotations: { include: { salesOrders: true } },
        crmActivities: {
          include: { assignedEmployee: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!opp) {
      throw new NotFoundException(
        `Opportunity with ID ${id} not found in this organization.`,
      );
    }

    return opp;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateOpportunityDto,
    actorUserId: string,
  ) {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === OpportunityStatus.WON ||
      existing.status === OpportunityStatus.LOST
    ) {
      throw new BadRequestException('Cannot modify a closed opportunity.');
    }

    if (dto.ownerEmployeeId) {
      const emp = await this.prisma.employee.findFirst({
        where: { id: dto.ownerEmployeeId, organizationId, deletedAt: null },
      });
      if (!emp) {
        throw new BadRequestException('Owner employee does not exist.');
      }
    }

    const updated = await this.prisma.opportunity.update({
      where: { id },
      data: {
        customerId: dto.customerId,
        primaryContactId: dto.primaryContactId,
        ownerEmployeeId: dto.ownerEmployeeId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        stage: dto.stage,
        probability:
          dto.probability !== undefined
            ? new Prisma.Decimal(dto.probability)
            : undefined,
        estimatedValue:
          dto.estimatedValue !== undefined
            ? new Prisma.Decimal(dto.estimatedValue)
            : undefined,
        expectedCloseDate: dto.expectedCloseDate
          ? new Date(dto.expectedCloseDate)
          : undefined,
        source: dto.source,
        currencyId: dto.currencyId,
        lostReason: dto.lostReason,
      },
      include: {
        customer: true,
        primaryContact: true,
        ownerEmployee: true,
        lines: { include: { item: true, variant: true } },
      },
    });

    await this.eventBus.publish({
      eventName: 'OPPORTUNITY_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'update_opportunity',
      resource: 'opportunity',
      resourceId: updated.id,
      details: { opportunityNumber: updated.opportunityNumber },
    });

    return updated;
  }

  async changeStage(
    organizationId: string,
    id: string,
    dto: ChangeOpportunityStageDto,
    actorUserId: string,
  ) {
    const opp = await this.findOne(organizationId, id);

    let nextStatus = opp.status;
    let wonDate: Date | null = opp.wonDate;
    let lostDate: Date | null = opp.lostDate;
    let closedDate: Date | null = opp.closedDate;
    let probability =
      dto.probability !== undefined
        ? new Prisma.Decimal(dto.probability)
        : opp.probability;

    const now = new Date();

    if (dto.stage === OpportunityStage.CLOSED_WON) {
      nextStatus = OpportunityStatus.WON;
      wonDate = now;
      closedDate = now;
      probability = new Prisma.Decimal(100);
    } else if (dto.stage === OpportunityStage.CLOSED_LOST) {
      nextStatus = OpportunityStatus.LOST;
      lostDate = now;
      closedDate = now;
      probability = new Prisma.Decimal(0);
    } else {
      nextStatus = OpportunityStatus.OPEN;
      if (dto.probability === undefined) {
        // Auto-scale default probabilities by stage
        switch (dto.stage) {
          case OpportunityStage.PROSPECTING:
            probability = new Prisma.Decimal(10);
            break;
          case OpportunityStage.QUALIFICATION:
            probability = new Prisma.Decimal(25);
            break;
          case OpportunityStage.NEEDS_ANALYSIS:
            probability = new Prisma.Decimal(50);
            break;
          case OpportunityStage.PROPOSAL:
            probability = new Prisma.Decimal(75);
            break;
          case OpportunityStage.NEGOTIATION:
            probability = new Prisma.Decimal(90);
            break;
        }
      }
    }

    const updated = await this.prisma.opportunity.update({
      where: { id },
      data: {
        stage: dto.stage,
        status: nextStatus,
        probability,
        wonDate,
        lostDate,
        closedDate,
      },
      include: {
        customer: true,
        ownerEmployee: true,
      },
    });

    await this.eventBus.publish({
      eventName:
        dto.stage === OpportunityStage.CLOSED_WON
          ? 'OPPORTUNITY_WON'
          : dto.stage === OpportunityStage.CLOSED_LOST
            ? 'OPPORTUNITY_LOST'
            : 'OPPORTUNITY_STAGE_CHANGED',
      occurredAt: now,
      organizationId,
      actorUserId,
      action: 'change_opportunity_stage',
      resource: 'opportunity',
      resourceId: opp.id,
      details: {
        opportunityNumber: opp.opportunityNumber,
        newStage: dto.stage,
        probability: probability.toString(),
      },
    });

    return updated;
  }

  async closeWon(
    organizationId: string,
    id: string,
    dto: CloseOpportunityWonDto,
    actorUserId: string,
  ) {
    const now = dto.wonDate ? new Date(dto.wonDate) : new Date();

    const updated = await this.prisma.opportunity.update({
      where: { id },
      data: {
        status: OpportunityStatus.WON,
        stage: OpportunityStage.CLOSED_WON,
        probability: new Prisma.Decimal(100),
        wonDate: now,
        closedDate: now,
        description: dto.notes ? `${dto.notes}` : undefined,
      },
      include: { customer: true, ownerEmployee: true },
    });

    await this.eventBus.publish({
      eventName: 'OPPORTUNITY_WON',
      occurredAt: now,
      organizationId,
      actorUserId,
      action: 'close_opportunity_won',
      resource: 'opportunity',
      resourceId: id,
      details: {
        opportunityNumber: updated.opportunityNumber,
        estimatedValue: updated.estimatedValue.toString(),
      },
    });

    return updated;
  }

  async closeLost(
    organizationId: string,
    id: string,
    dto: CloseOpportunityLostDto,
    actorUserId: string,
  ) {
    const now = dto.lostDate ? new Date(dto.lostDate) : new Date();

    const updated = await this.prisma.opportunity.update({
      where: { id },
      data: {
        status: OpportunityStatus.LOST,
        stage: OpportunityStage.CLOSED_LOST,
        probability: new Prisma.Decimal(0),
        lostReason: dto.lostReason,
        lostDate: now,
        closedDate: now,
      },
      include: { customer: true, ownerEmployee: true },
    });

    await this.eventBus.publish({
      eventName: 'OPPORTUNITY_LOST',
      occurredAt: now,
      organizationId,
      actorUserId,
      action: 'close_opportunity_lost',
      resource: 'opportunity',
      resourceId: id,
      details: {
        opportunityNumber: updated.opportunityNumber,
        lostReason: dto.lostReason,
      },
    });

    return updated;
  }

  async addLine(
    organizationId: string,
    opportunityId: string,
    dto: CreateOpportunityLineDto,
  ) {
    const opp = await this.findOne(organizationId, opportunityId);

    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, organizationId, deletedAt: null },
    });
    if (!item) {
      throw new BadRequestException('Item does not exist in organization.');
    }

    const computed = this.computeLineValues(dto);

    const line = await this.prisma.$transaction(async (tx) => {
      const createdLine = await tx.opportunityLine.create({
        data: {
          organizationId,
          opportunityId,
          itemId: dto.itemId,
          variantId: dto.variantId,
          description: dto.description,
          ...computed,
        },
        include: { item: true, variant: true },
      });

      // Recalculate opportunity estimated value
      const allLines = await tx.opportunityLine.findMany({
        where: { opportunityId, organizationId },
      });
      const totalEstimated = allLines.reduce(
        (acc, l) => acc.add(l.estimatedAmount),
        new Prisma.Decimal(0),
      );

      await tx.opportunity.update({
        where: { id: opportunityId },
        data: { estimatedValue: totalEstimated },
      });

      return createdLine;
    });

    return line;
  }

  async removeLine(
    organizationId: string,
    opportunityId: string,
    lineId: string,
  ) {
    await this.findOne(organizationId, opportunityId);

    await this.prisma.$transaction(async (tx) => {
      await tx.opportunityLine.delete({
        where: { id: lineId },
      });

      const allLines = await tx.opportunityLine.findMany({
        where: { opportunityId, organizationId },
      });
      const totalEstimated = allLines.reduce(
        (acc, l) => acc.add(l.estimatedAmount),
        new Prisma.Decimal(0),
      );

      await tx.opportunity.update({
        where: { id: opportunityId },
        data: { estimatedValue: totalEstimated },
      });
    });

    return { success: true };
  }
}
