import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateAlertRuleDto } from '../dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from '../dto/update-alert-rule.dto';
import {
  OperationalAlertRule,
  OperationalAlertEvent,
  AlertEventStatus,
  AlertRuleStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class AlertingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createRule(
    dto: CreateAlertRuleDto,
    actorUserId?: string,
  ): Promise<OperationalAlertRule> {
    if (dto.threshold <= 0 || dto.windowSeconds <= 0) {
      throw new BadRequestException('Threshold and windowSeconds must be > 0'); // INV-335
    }
    const rule = await this.prisma.operationalAlertRule.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        metricKey: dto.metricKey,
        threshold: dto.threshold,
        windowSeconds: dto.windowSeconds,
        severity: dto.severity,
        status: AlertRuleStatus.ACTIVE,
        organizationId: dto.organizationId ?? null,
        cooldownSeconds: dto.cooldownSeconds ?? 300,
      },
    });
    await this.audit.record({
      eventName: 'OPERATIONS_ALERT_RULE_CREATED',
      action: 'OPERATIONS_ALERT_RULE_CREATED',
      occurredAt: new Date(),
      resource: 'OperationalAlertRule',
      resourceId: rule.id,
      actorUserId,
      organizationId: dto.organizationId ?? 'platform',
    });
    return rule;
  }

  async listRules(organizationId?: string): Promise<OperationalAlertRule[]> {
    const where: Prisma.OperationalAlertRuleWhereInput = organizationId
      ? { organizationId }
      : {};
    return this.prisma.operationalAlertRule.findMany({ where });
  }

  async updateRule(
    id: string,
    dto: UpdateAlertRuleDto,
    actorUserId?: string,
  ): Promise<OperationalAlertRule> {
    if (dto.threshold !== undefined && dto.threshold <= 0)
      throw new BadRequestException('Threshold must be > 0');
    if (dto.windowSeconds !== undefined && dto.windowSeconds <= 0)
      throw new BadRequestException('windowSeconds must be > 0');
    const rule = await this.prisma.operationalAlertRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.threshold !== undefined && { threshold: dto.threshold }),
        ...(dto.windowSeconds !== undefined && {
          windowSeconds: dto.windowSeconds,
        }),
        ...(dto.severity !== undefined && { severity: dto.severity }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.cooldownSeconds !== undefined && {
          cooldownSeconds: dto.cooldownSeconds,
        }),
      },
    });
    await this.audit.record({
      eventName: 'OPERATIONS_ALERT_RULE_UPDATED',
      action: 'OPERATIONS_ALERT_RULE_UPDATED',
      occurredAt: new Date(),
      resource: 'OperationalAlertRule',
      resourceId: rule.id,
      actorUserId,
      organizationId: rule.organizationId ?? 'platform',
    });
    return rule;
  }

  async evaluateRule(ruleId: string, currentValue: number): Promise<void> {
    try {
      const rule = await this.prisma.operationalAlertRule.findUnique({
        where: { id: ruleId },
      });
      if (!rule || rule.status !== AlertRuleStatus.ACTIVE) return;
      if (currentValue >= rule.threshold) {
        const lastEvent = await this.prisma.operationalAlertEvent.findFirst({
          where: { alertRuleId: rule.id, status: AlertEventStatus.TRIGGERED },
          orderBy: { triggeredAt: 'desc' },
        });
        if (lastEvent) {
          const timeSince =
            (Date.now() - new Date(lastEvent.triggeredAt).getTime()) / 1000;
          if (timeSince < rule.cooldownSeconds) return; // INV-336
        }
        await this.triggerAlert(
          rule.id,
          currentValue,
          rule.organizationId ?? undefined,
        );
      }
    } catch {
      /* telemetry failures never crash business operations */
    }
  }

  async triggerAlert(
    alertRuleId: string,
    value: number,
    organizationId?: string,
  ): Promise<OperationalAlertEvent> {
    const event = await this.prisma.operationalAlertEvent.create({
      data: {
        alertRuleId,
        triggeredValue: value,
        status: AlertEventStatus.TRIGGERED,
        organizationId: organizationId ?? null,
      },
    });
    await this.audit.record({
      eventName: 'OPERATIONS_ALERT_TRIGGERED',
      action: 'OPERATIONS_ALERT_TRIGGERED',
      occurredAt: new Date(),
      resource: 'OperationalAlertEvent',
      resourceId: event.id,
      actorUserId: undefined,
      organizationId: organizationId ?? 'platform',
    });
    return event;
  }

  async acknowledgeAlert(
    eventId: string,
    actorUserId?: string,
  ): Promise<OperationalAlertEvent> {
    const event = await this.prisma.operationalAlertEvent.findUnique({
      where: { id: eventId },
    });
    if (!event || event.status !== AlertEventStatus.TRIGGERED)
      throw new BadRequestException(
        'Only TRIGGERED alerts can be acknowledged',
      ); // INV-337
    const updated = await this.prisma.operationalAlertEvent.update({
      where: { id: eventId },
      data: {
        status: AlertEventStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
      },
    });
    await this.audit.record({
      eventName: 'OPERATIONS_ALERT_ACKNOWLEDGED',
      action: 'OPERATIONS_ALERT_ACKNOWLEDGED',
      occurredAt: new Date(),
      resource: 'OperationalAlertEvent',
      resourceId: eventId,
      actorUserId,
      organizationId: event.organizationId ?? 'platform',
    });
    return updated;
  }

  async resolveAlert(
    eventId: string,
    actorUserId?: string,
  ): Promise<OperationalAlertEvent> {
    const event = await this.prisma.operationalAlertEvent.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new BadRequestException('Alert event not found');
    const updated = await this.prisma.operationalAlertEvent.update({
      where: { id: eventId },
      data: { status: AlertEventStatus.RESOLVED, resolvedAt: new Date() }, // INV-338
    });
    await this.audit.record({
      eventName: 'OPERATIONS_ALERT_RESOLVED',
      action: 'OPERATIONS_ALERT_RESOLVED',
      occurredAt: new Date(),
      resource: 'OperationalAlertEvent',
      resourceId: eventId,
      actorUserId,
      organizationId: event.organizationId ?? 'platform',
    });
    return updated;
  }

  async getActiveAlerts(
    organizationId?: string,
  ): Promise<OperationalAlertEvent[]> {
    const where: Prisma.OperationalAlertEventWhereInput = {
      status: {
        in: [AlertEventStatus.TRIGGERED, AlertEventStatus.ACKNOWLEDGED],
      },
    };
    if (organizationId) where.organizationId = organizationId;
    return this.prisma.operationalAlertEvent.findMany({
      where,
      orderBy: { triggeredAt: 'desc' },
    });
  }
}
