import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import {
  CreateNonConformanceDto,
  ContainNonConformanceDto,
  InvestigateNonConformanceDto,
  DispositionNonConformanceDto,
  CloseNonConformanceDto,
  QueryNonConformanceDto,
} from './dto/non-conformance.dto';
import {
  Prisma,
  NonConformanceStatus,
  NonConformanceSeverity,
} from '@prisma/client';

@Injectable()
export class NonConformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  async findAll(organizationId: string, query?: QueryNonConformanceDto) {
    const where: Prisma.NonConformanceWhereInput = { organizationId };

    if (query?.status) {
      where.status = query.status;
    }
    if (query?.severity) {
      where.severity = query.severity;
    }
    if (query?.itemId) {
      where.itemId = query.itemId;
    }
    if (query?.supplierId) {
      where.supplierId = query.supplierId;
    }
    if (query?.customerId) {
      where.customerId = query.customerId;
    }
    if (query?.search) {
      where.OR = [
        { ncrNumber: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.nonConformance.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        item: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true, name: true } },
        supplier: { select: { id: true, code: true, name: true } },
        customer: { select: { id: true, code: true, name: true } },
        sourceInspectionLot: { select: { id: true, lotNumber: true } },
        _count: { select: { capas: true, customerIssues: true } },
      },
    });
  }

  async findOne(organizationId: string, id: string) {
    const ncr = await this.prisma.nonConformance.findFirst({
      where: { id, organizationId },
      include: {
        item: true,
        variant: true,
        batch: true,
        serial: true,
        supplier: true,
        customer: true,
        productionOrder: true,
        sourceInspectionLot: true,
        capas: true,
        customerIssues: true,
      },
    });

    if (!ncr) {
      throw new NotFoundException(`Non-conformance record ${id} not found`);
    }

    return ncr;
  }

  async create(
    organizationId: string,
    dto: CreateNonConformanceDto,
    userId: string,
  ) {
    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, organizationId },
    });
    if (!item) {
      throw new NotFoundException(`Item ${dto.itemId} not found`);
    }

    const ncrSeq = await this.numberingService.nextNumber(
      organizationId,
      'NON_CONFORMANCE',
      'NCR-',
    );

    const ncr = await this.prisma.nonConformance.create({
      data: {
        organizationId,
        ncrNumber: ncrSeq.formatted,
        title: dto.title,
        description: dto.description,
        sourceInspectionLotId: dto.sourceInspectionLotId,
        itemId: dto.itemId,
        variantId: dto.variantId,
        batchId: dto.batchId,
        serialId: dto.serialId,
        supplierId: dto.supplierId,
        customerId: dto.customerId,
        productionOrderId: dto.productionOrderId,
        quantityAffected: new Prisma.Decimal(dto.quantityAffected),
        severity: dto.severity ?? NonConformanceSeverity.MEDIUM,
        status: NonConformanceStatus.OPEN,
        containmentAction: dto.containmentAction,
        rootCause: dto.rootCause,
        disposition: dto.disposition,
        dispositionNotes: dto.dispositionNotes,
        ownerUserId: userId,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
      },
      include: {
        item: true,
        supplier: true,
        customer: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'NCR_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.non_conformance.create',
      resource: 'non_conformance',
      resourceId: ncr.id,
      details: {
        ncrNumber: ncr.ncrNumber,
        severity: ncr.severity,
        quantityAffected: ncr.quantityAffected.toString(),
      },
    });

    return ncr;
  }

  async contain(
    organizationId: string,
    id: string,
    dto: ContainNonConformanceDto,
    userId: string,
  ) {
    const ncr = await this.findOne(organizationId, id);

    if (
      ncr.status === NonConformanceStatus.CLOSED ||
      ncr.status === NonConformanceStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot contain NCR in ${ncr.status} state`,
      );
    }

    const updated = await this.prisma.nonConformance.update({
      where: { id: ncr.id },
      data: {
        containmentAction: dto.containmentAction,
        status: NonConformanceStatus.CONTAINED,
      },
    });

    await this.eventBus.publish({
      eventName: 'NCR_CONTAINED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.non_conformance.contain',
      resource: 'non_conformance',
      resourceId: updated.id,
      details: { ncrNumber: updated.ncrNumber },
    });

    return updated;
  }

  async investigate(
    organizationId: string,
    id: string,
    dto: InvestigateNonConformanceDto,
    userId: string,
  ) {
    const ncr = await this.findOne(organizationId, id);

    if (
      ncr.status === NonConformanceStatus.CLOSED ||
      ncr.status === NonConformanceStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot investigate NCR in ${ncr.status} state`,
      );
    }

    const updated = await this.prisma.nonConformance.update({
      where: { id: ncr.id },
      data: {
        rootCause: dto.rootCause,
        status: NonConformanceStatus.ROOT_CAUSE_IDENTIFIED,
      },
    });

    await this.eventBus.publish({
      eventName: 'NCR_INVESTIGATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.non_conformance.investigate',
      resource: 'non_conformance',
      resourceId: updated.id,
      details: { ncrNumber: updated.ncrNumber },
    });

    return updated;
  }

  async disposition(
    organizationId: string,
    id: string,
    dto: DispositionNonConformanceDto,
    userId: string,
  ) {
    const ncr = await this.findOne(organizationId, id);

    if (
      ncr.status === NonConformanceStatus.CLOSED ||
      ncr.status === NonConformanceStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot disposition NCR in ${ncr.status} state`,
      );
    }

    const nextStatus = dto.isCapaRequired
      ? NonConformanceStatus.CAPA_REQUIRED
      : NonConformanceStatus.DISPOSITIONED;

    const updated = await this.prisma.nonConformance.update({
      where: { id: ncr.id },
      data: {
        disposition: dto.disposition,
        dispositionNotes: dto.dispositionNotes,
        status: nextStatus,
      },
    });

    await this.eventBus.publish({
      eventName: 'NCR_DISPOSITIONED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.non_conformance.disposition',
      resource: 'non_conformance',
      resourceId: updated.id,
      details: {
        ncrNumber: updated.ncrNumber,
        disposition: updated.disposition,
      },
    });

    return updated;
  }

  async close(
    organizationId: string,
    id: string,
    _dto: CloseNonConformanceDto,
    userId: string,
  ) {
    const ncr = await this.findOne(organizationId, id);

    if (ncr.status === NonConformanceStatus.CLOSED) {
      return ncr;
    }

    // Check if open CAPAs block closure
    const openCapas = await this.prisma.cAPA.findMany({
      where: {
        nonConformanceId: ncr.id,
        organizationId,
        status: { notIn: ['CLOSED', 'CANCELLED'] },
      },
    });

    if (openCapas.length > 0) {
      throw new BadRequestException(
        `Cannot close NCR ${ncr.ncrNumber}: there are ${openCapas.length} open CAPA(s) that must be closed first`,
      );
    }

    const updated = await this.prisma.nonConformance.update({
      where: { id: ncr.id },
      data: {
        status: NonConformanceStatus.CLOSED,
        closedAt: new Date(),
        closedByUserId: userId,
      },
    });

    await this.eventBus.publish({
      eventName: 'NCR_CLOSED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.non_conformance.close',
      resource: 'non_conformance',
      resourceId: updated.id,
      details: { ncrNumber: updated.ncrNumber },
    });

    return updated;
  }
}
