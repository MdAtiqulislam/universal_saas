import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import {
  CreateCustomerQualityIssueDto,
  ResolveCustomerQualityIssueDto,
  QueryCustomerQualityIssuesDto,
} from './dto/quality-analytics.dto';
import { Prisma, QualityIssueStatus } from '@prisma/client';

@Injectable()
export class CustomerQualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  async findAll(organizationId: string, query?: QueryCustomerQualityIssuesDto) {
    const where: Prisma.CustomerQualityIssueWhereInput = { organizationId };

    if (query?.status) {
      where.status = query.status;
    }
    if (query?.customerId) {
      where.customerId = query.customerId;
    }
    if (query?.itemId) {
      where.itemId = query.itemId;
    }
    if (query?.search) {
      where.OR = [
        { issueNumber: { contains: query.search, mode: 'insensitive' } },
        { issueDescription: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.customerQualityIssue.findMany({
      where,
      orderBy: { reportedAt: 'desc' },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true, name: true } },
        salesOrder: { select: { id: true, orderNumber: true } },
        shipment: { select: { id: true, shipmentNumber: true } },
        nonConformance: { select: { id: true, ncrNumber: true, status: true } },
      },
    });
  }

  async findOne(organizationId: string, id: string) {
    const issue = await this.prisma.customerQualityIssue.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        item: true,
        variant: true,
        batch: true,
        serial: true,
        salesOrder: true,
        shipment: true,
        nonConformance: true,
      },
    });

    if (!issue) {
      throw new NotFoundException(`Customer quality issue ${id} not found`);
    }

    return issue;
  }

  async create(
    organizationId: string,
    dto: CreateCustomerQualityIssueDto,
    userId: string,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${dto.customerId} not found`);
    }

    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, organizationId },
    });
    if (!item) {
      throw new NotFoundException(`Item ${dto.itemId} not found`);
    }

    const issueSeq = await this.numberingService.nextNumber(
      organizationId,
      'CUSTOMER_QUALITY_ISSUE',
      'CQI-',
    );

    const issue = await this.prisma.customerQualityIssue.create({
      data: {
        organizationId,
        issueNumber: issueSeq.formatted,
        customerId: dto.customerId,
        salesOrderId: dto.salesOrderId,
        shipmentId: dto.shipmentId,
        itemId: dto.itemId,
        variantId: dto.variantId,
        batchId: dto.batchId,
        serialId: dto.serialId,
        issueDescription: dto.issueDescription,
        severity: dto.severity,
        status: QualityIssueStatus.REPORTED,
        nonConformanceId: dto.nonConformanceId,
      },
      include: {
        customer: true,
        item: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_QUALITY_ISSUE_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.customer_issue.create',
      resource: 'customer_quality_issue',
      resourceId: issue.id,
      details: { issueNumber: issue.issueNumber },
    });

    return issue;
  }

  async resolve(
    organizationId: string,
    id: string,
    dto: ResolveCustomerQualityIssueDto,
    userId: string,
  ) {
    const issue = await this.findOne(organizationId, id);

    const updated = await this.prisma.customerQualityIssue.update({
      where: { id: issue.id },
      data: {
        status: QualityIssueStatus.RESOLVED,
        resolvedAt: new Date(),
        resolutionNotes: dto.resolutionNotes,
      },
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_QUALITY_ISSUE_RESOLVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.customer_issue.resolve',
      resource: 'customer_quality_issue',
      resourceId: updated.id,
      details: { issueNumber: updated.issueNumber },
    });

    return updated;
  }
}
