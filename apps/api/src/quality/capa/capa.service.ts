import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import {
  CreateCapaDto,
  UpdateCapaDto,
  VerifyCapaDto,
  QueryCapaDto,
} from './dto/capa.dto';
import { Prisma, CapaStatus } from '@prisma/client';

@Injectable()
export class CapaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  async findAll(organizationId: string, query?: QueryCapaDto) {
    const where: Prisma.CAPAWhereInput = { organizationId };

    if (query?.status) {
      where.status = query.status;
    }
    if (query?.nonConformanceId) {
      where.nonConformanceId = query.nonConformanceId;
    }
    if (query?.search) {
      where.OR = [
        { capaNumber: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.cAPA.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        nonConformance: {
          select: { id: true, ncrNumber: true, title: true, severity: true },
        },
        sourceInspectionLot: {
          select: { id: true, lotNumber: true },
        },
      },
    });
  }

  async findOne(organizationId: string, id: string) {
    const capa = await this.prisma.cAPA.findFirst({
      where: { id, organizationId },
      include: {
        nonConformance: true,
        sourceInspectionLot: true,
      },
    });

    if (!capa) {
      throw new NotFoundException(`CAPA record ${id} not found`);
    }

    return capa;
  }

  async create(organizationId: string, dto: CreateCapaDto, userId: string) {
    if (dto.nonConformanceId) {
      const ncr = await this.prisma.nonConformance.findFirst({
        where: { id: dto.nonConformanceId, organizationId },
      });
      if (!ncr) {
        throw new NotFoundException(
          `Non-conformance ${dto.nonConformanceId} not found`,
        );
      }
    }

    const capaSeq = await this.numberingService.nextNumber(
      organizationId,
      'CAPA',
      'CAPA-',
    );

    const capa = await this.prisma.cAPA.create({
      data: {
        organizationId,
        capaNumber: capaSeq.formatted,
        title: dto.title,
        description: dto.description,
        nonConformanceId: dto.nonConformanceId,
        sourceInspectionLotId: dto.sourceInspectionLotId,
        rootCauseAnalysis: dto.rootCauseAnalysis,
        correctiveAction: dto.correctiveAction,
        preventiveAction: dto.preventiveAction,
        ownerUserId: userId,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
        status: CapaStatus.OPEN,
      },
      include: {
        nonConformance: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'CAPA_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.capa.create',
      resource: 'capa',
      resourceId: capa.id,
      details: { capaNumber: capa.capaNumber },
    });

    return capa;
  }

  async update(organizationId: string, id: string, dto: UpdateCapaDto) {
    const capa = await this.findOne(organizationId, id);

    if (
      capa.status === CapaStatus.CLOSED ||
      capa.status === CapaStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot update CAPA in ${capa.status} state`,
      );
    }

    const updated = await this.prisma.cAPA.update({
      where: { id: capa.id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.rootCauseAnalysis !== undefined && {
          rootCauseAnalysis: dto.rootCauseAnalysis,
        }),
        ...(dto.correctiveAction !== undefined && {
          correctiveAction: dto.correctiveAction,
        }),
        ...(dto.preventiveAction !== undefined && {
          preventiveAction: dto.preventiveAction,
        }),
        ...(dto.targetDate !== undefined && {
          targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
        }),
      },
    });

    return updated;
  }

  async start(organizationId: string, id: string, userId: string) {
    const capa = await this.findOne(organizationId, id);

    if (capa.status !== CapaStatus.OPEN && capa.status !== CapaStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot start CAPA from current state: ${capa.status}`,
      );
    }

    const updated = await this.prisma.cAPA.update({
      where: { id: capa.id },
      data: { status: CapaStatus.IN_PROGRESS },
    });

    await this.eventBus.publish({
      eventName: 'CAPA_STARTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.capa.start',
      resource: 'capa',
      resourceId: updated.id,
      details: { capaNumber: updated.capaNumber },
    });

    return updated;
  }

  async verify(
    organizationId: string,
    id: string,
    dto: VerifyCapaDto,
    userId: string,
  ) {
    const capa = await this.findOne(organizationId, id);

    if (
      capa.status !== CapaStatus.IN_PROGRESS &&
      capa.status !== CapaStatus.PENDING_VERIFICATION
    ) {
      throw new BadRequestException(
        `Cannot verify CAPA in current state: ${capa.status}`,
      );
    }

    const updated = await this.prisma.cAPA.update({
      where: { id: capa.id },
      data: {
        status: CapaStatus.VERIFIED,
        verifiedByUserId: userId,
        verifiedAt: new Date(),
        verificationNotes: dto.verificationNotes,
        effectivenessReview: dto.effectivenessReview,
      },
    });

    await this.eventBus.publish({
      eventName: 'CAPA_VERIFIED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.capa.verify',
      resource: 'capa',
      resourceId: updated.id,
      details: { capaNumber: updated.capaNumber },
    });

    return updated;
  }

  async close(organizationId: string, id: string, userId: string) {
    const capa = await this.findOne(organizationId, id);

    if (capa.status === CapaStatus.CLOSED) {
      return capa;
    }

    if (capa.status !== CapaStatus.VERIFIED) {
      throw new BadRequestException(
        `Cannot close CAPA ${capa.capaNumber}: CAPA must be verified and have an effectiveness review first`,
      );
    }

    const updated = await this.prisma.cAPA.update({
      where: { id: capa.id },
      data: {
        status: CapaStatus.CLOSED,
        closedAt: new Date(),
        closedByUserId: userId,
      },
    });

    await this.eventBus.publish({
      eventName: 'CAPA_CLOSED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.capa.close',
      resource: 'capa',
      resourceId: updated.id,
      details: { capaNumber: updated.capaNumber },
    });

    return updated;
  }
}
