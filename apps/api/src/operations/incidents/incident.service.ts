import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateIncidentDto } from '../dto/create-incident.dto';
import { ResolveIncidentDto } from '../dto/resolve-incident.dto';
import { IncidentQueryDto } from '../dto/incident-query.dto';
import { OperationalIncident, IncidentStatus, Prisma } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class IncidentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createIncident(
    dto: CreateIncidentDto,
    actorUserId?: string,
  ): Promise<OperationalIncident> {
    const descHash = crypto
      .createHash('sha256')
      .update(dto.description || '')
      .digest('hex');

    // Auto-assign sequence incidentNumber (INV-331)
    const cnt = await this.prisma.operationalIncident.count();
    const incidentNumber = `INC-${(cnt + 1).toString().padStart(6, '0')}`;

    try {
      const incident = await this.prisma.operationalIncident.create({
        data: {
          incidentNumber,
          title: dto.title,
          description: dto.description ?? null,
          severity: dto.severity,
          source: dto.source,
          status: IncidentStatus.OPEN,
          organizationId: dto.organizationId ?? null,
          detectedAt: dto.detectedAt ? new Date(dto.detectedAt) : new Date(),
          ownerUserId: dto.ownerUserId ?? null,
          metadata: { descHash },
        },
      });

      await this.audit.record({
        eventName: 'OPERATIONS_INCIDENT_CREATED',
        action: 'OPERATIONS_INCIDENT_CREATED',
        occurredAt: new Date(),
        resource: 'OperationalIncident',
        resourceId: incident.id,
        actorUserId,
        organizationId: dto.organizationId ?? 'platform',
        details: { incidentNumber },
      });

      return incident;
    } catch (e: unknown) {
      if (
        typeof e === 'object' &&
        e !== null &&
        'code' in e &&
        (e as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException(
          'Incident number collision, please retry.',
        );
      }
      throw e;
    }
  }

  async listIncidents(query: IncidentQueryDto): Promise<OperationalIncident[]> {
    const where: Prisma.OperationalIncidentWhereInput = {};
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;

    return this.prisma.operationalIncident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getIncident(
    id: string,
    organizationId?: string,
  ): Promise<OperationalIncident> {
    const incident = await this.prisma.operationalIncident.findUnique({
      where: { id },
    });
    if (!incident) throw new NotFoundException('Incident not found');
    if (organizationId && incident.organizationId !== organizationId)
      throw new NotFoundException();
    return incident;
  }

  async acknowledgeIncident(
    id: string,
    actorUserId?: string,
  ): Promise<OperationalIncident> {
    const inc = await this.getIncident(id);
    if (inc.status !== IncidentStatus.OPEN) {
      throw new BadRequestException('Only OPEN incidents can be acknowledged'); // INV-332
    }

    const updated = await this.prisma.operationalIncident.update({
      where: { id },
      data: {
        status: IncidentStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
      },
    });

    await this.audit.record({
      eventName: 'OPERATIONS_INCIDENT_ACKNOWLEDGED',
      action: 'OPERATIONS_INCIDENT_ACKNOWLEDGED',
      occurredAt: new Date(),
      resource: 'OperationalIncident',
      resourceId: id,
      actorUserId,
      organizationId: inc.organizationId ?? 'platform',
    });

    return updated;
  }

  async resolveIncident(
    id: string,
    dto: ResolveIncidentDto,
    actorUserId?: string,
  ): Promise<OperationalIncident> {
    const inc = await this.getIncident(id);
    if (
      inc.status === IncidentStatus.CLOSED ||
      inc.status === IncidentStatus.RESOLVED
    ) {
      throw new BadRequestException('Incident already resolved or closed');
    }

    const updated = await this.prisma.operationalIncident.update({
      where: { id },
      data: {
        status: IncidentStatus.RESOLVED,
        resolvedAt: new Date(), // INV-333
        resolution: dto.resolution,
        rootCause: dto.rootCause,
      },
    });

    await this.audit.record({
      eventName: 'OPERATIONS_INCIDENT_RESOLVED',
      action: 'OPERATIONS_INCIDENT_RESOLVED',
      occurredAt: new Date(),
      resource: 'OperationalIncident',
      resourceId: id,
      actorUserId,
      organizationId: inc.organizationId ?? 'platform',
    });

    return updated;
  }

  async closeIncident(
    id: string,
    actorUserId?: string,
  ): Promise<OperationalIncident> {
    const inc = await this.getIncident(id);
    if (inc.status === IncidentStatus.CLOSED) return inc; // terminal (INV-334)

    const updated = await this.prisma.operationalIncident.update({
      where: { id },
      data: {
        status: IncidentStatus.CLOSED,
        closedAt: new Date(), // INV-333
      },
    });

    await this.audit.record({
      eventName: 'OPERATIONS_INCIDENT_CLOSED',
      action: 'OPERATIONS_INCIDENT_CLOSED',
      occurredAt: new Date(),
      resource: 'OperationalIncident',
      resourceId: id,
      actorUserId,
      organizationId: inc.organizationId ?? 'platform',
    });

    return updated;
  }
}
