import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateSloDto } from '../dto/create-slo.dto';
import {
  ServiceLevelObjective,
  SloStatus,
  SloScope,
  Prisma,
} from '@prisma/client';

export interface SloComplianceResult {
  id: string;
  name: string;
  compliancePercent: number;
  status: SloStatus;
  breachCount: number;
}

@Injectable()
export class SloService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createSlo(
    dto: CreateSloDto,
    actorUserId?: string,
  ): Promise<ServiceLevelObjective> {
    // INV-348: For percent-unit SLOs, targetValue must be 0–100. For other units, must be positive.
    if (
      dto.unit === 'percent' &&
      (dto.targetValue < 0 || dto.targetValue > 100)
    ) {
      throw new BadRequestException(
        'Target value for percentage SLOs must be 0–100',
      ); // INV-348
    }
    if (dto.targetValue < 0) {
      throw new BadRequestException('Target value must be positive'); // INV-348
    }

    const slo = await this.prisma.serviceLevelObjective.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        metricKey: dto.metricKey,
        scope: dto.scope,
        targetValue: dto.targetValue,
        currentValue: 100, // Starts healthy
        unit: dto.unit,
        windowDays: dto.windowDays,
        status: SloStatus.HEALTHY,
        organizationId: dto.organizationId ?? null,
        breachCount: 0,
      },
    });

    await this.audit.record({
      eventName: 'OPERATIONS_SLO_CREATED',
      action: 'OPERATIONS_SLO_CREATED',
      occurredAt: new Date(),
      resource: 'ServiceLevelObjective',
      resourceId: slo.id,
      actorUserId,
      organizationId: dto.organizationId ?? 'platform',
    });

    return slo;
  }

  async listSlos(
    organizationId?: string,
    scope?: SloScope,
  ): Promise<ServiceLevelObjective[]> {
    const where: Prisma.ServiceLevelObjectiveWhereInput = {};
    if (organizationId) {
      where.organizationId = organizationId; // INV-350: tenant scope
    }
    if (scope) {
      where.scope = scope;
    }
    return this.prisma.serviceLevelObjective.findMany({ where });
  }

  async getSlo(
    id: string,
    organizationId?: string,
  ): Promise<ServiceLevelObjective> {
    const slo = await this.prisma.serviceLevelObjective.findUnique({
      where: { id },
    });
    if (!slo) throw new NotFoundException('SLO not found');
    if (organizationId && slo.organizationId !== organizationId)
      throw new NotFoundException();
    return slo;
  }

  async updateSloValue(
    id: string,
    currentValue: number,
  ): Promise<ServiceLevelObjective> {
    const slo = await this.prisma.serviceLevelObjective.findUnique({
      where: { id },
    });
    if (!slo) throw new NotFoundException('SLO not found');

    const isBreaching = currentValue < slo.targetValue;
    // At-risk: within 5% of target. INV-349: deterministic calculation.
    const atRisk =
      !isBreaching &&
      slo.targetValue > 0 &&
      currentValue < slo.targetValue * 1.05;
    const newStatus = isBreaching
      ? SloStatus.BREACHED
      : atRisk
        ? SloStatus.AT_RISK
        : SloStatus.HEALTHY;
    const newBreachCount =
      isBreaching && slo.status !== SloStatus.BREACHED
        ? slo.breachCount + 1
        : slo.breachCount;

    return this.prisma.serviceLevelObjective.update({
      where: { id },
      data: {
        currentValue,
        status: newStatus,
        breachCount: newBreachCount, // INV-349
        lastEvaluatedAt: new Date(),
      },
    });
  }

  async getSloCompliance(
    organizationId?: string,
  ): Promise<SloComplianceResult[]> {
    const slos = await this.listSlos(organizationId);
    return slos.map((slo) => ({
      id: slo.id,
      name: slo.name,
      compliancePercent: slo.currentValue ?? 100,
      status: slo.status,
      breachCount: slo.breachCount,
    }));
  }
}
