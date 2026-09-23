import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingUsageRepository } from '../repositories/billing-usage.repository';
import { EntitlementsService } from './entitlements.service';
import {
  RecordUsageDto,
  UsageQueryDto,
  SetQuotaDto,
} from '../dto/billing-usage.dto';
import { AuditService } from '../../audit/audit.service';
import { EventBusService } from '../../events/event-bus.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';

@Injectable()
export class UsageMeteringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usageRepo: BillingUsageRepository,
    private readonly entitlementsService: EntitlementsService,
    private readonly audit: AuditService,
    private readonly eventBus: EventBusService,
    private readonly logger: StructuredLoggingService,
  ) {}

  async recordUsage(
    organizationId: string,
    dto: RecordUsageDto,
    actorUserId?: string,
  ) {
    // INV-438: Usage records are strictly tenant scoped
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }

    // INV-442: Usage aggregates/records cannot contain negative usage
    if (dto.quantity < 0) {
      throw new BadRequestException('Usage quantity cannot be negative');
    }

    // INV-439: Usage records require valid metric identifiers
    const metric = await this.usageRepo.findMetricByKey(dto.metricKey);
    if (!metric) {
      throw new NotFoundException(
        `Usage metric '${dto.metricKey}' is not registered in catalog`,
      );
    }

    // INV-440: Usage records require idempotent source/event identity
    const idempotencyKey =
      dto.idempotencyKey ||
      (dto.sourceId
        ? `${dto.source || 'api'}:${dto.sourceId}`
        : crypto.randomUUID());

    // INV-441: Duplicate usage events cannot increment usage twice
    const existing = await this.usageRepo.findRecordByIdempotencyKey(
      organizationId,
      idempotencyKey,
    );
    if (existing) {
      this.logger.log({
        level: 'INFO',
        message: 'Duplicate usage event skipped via idempotency',
        organizationId,
        metricKey: dto.metricKey,
        idempotencyKey,
      });
      return {
        ...existing,
        isDuplicate: true,
      };
    }

    // INV-443: Hard quota enforcement cannot exceed configured quota without an authorized override
    await this.entitlementsService.assertWithinQuota(
      organizationId,
      dto.metricKey,
      dto.quantity,
    );

    // Record usage and update rollups atomically
    const record = await this.prisma.$transaction(async (tx) => {
      const createdRecord = await tx.billingUsageRecord.create({
        data: {
          organizationId,
          metricKey: dto.metricKey,
          quantity: dto.quantity,
          source: dto.source || 'api',
          sourceId: dto.sourceId,
          idempotencyKey,
        },
      });

      // Update quota if one exists
      await tx.billingQuota.updateMany({
        where: {
          organizationId,
          metricKey: dto.metricKey,
        },
        data: {
          currentUsage: {
            increment: dto.quantity,
          },
        },
      });

      // Update daily aggregate (INV-442: non-negative)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      await tx.billingUsageAggregate.upsert({
        where: {
          organizationId_metricKey_date: {
            organizationId,
            metricKey: dto.metricKey,
            date: today,
          },
        },
        create: {
          organizationId,
          metricKey: dto.metricKey,
          date: today,
          totalQuantity: dto.quantity,
        },
        update: {
          totalQuantity: {
            increment: dto.quantity,
          },
        },
      });

      return createdRecord;
    });

    await this.eventBus.publish({
      eventName: 'billing.usage.recorded',
      occurredAt: new Date(),
      resourceId: record.id,
      organizationId,
      payload: {
        metricKey: dto.metricKey,
        quantity: dto.quantity,
        source: dto.source,
      },
    });

    if (actorUserId) {
      await this.audit.record({
        action: 'billing.usage.recorded',
        organizationId,
        actorUserId,
        resource: 'billing_usage_record',
        resourceId: record.id,
        details: {
          metricKey: dto.metricKey,
          quantity: dto.quantity,
          idempotencyKey,
        },
        eventName: 'billing.usage.recorded',
        occurredAt: new Date(),
      });
    }

    return {
      ...record,
      isDuplicate: false,
    };
  }

  async getUsageSummary(organizationId: string, days: number = 30) {
    return this.usageRepo.getUsageSummary(organizationId, days);
  }

  async listUsageRecords(organizationId: string, query: UsageQueryDto) {
    return this.usageRepo.listUsageRecords(
      organizationId,
      query.metricKey,
      query.limit || 50,
    );
  }

  async setQuota(
    organizationId: string,
    dto: SetQuotaDto,
    actorUserId?: string,
  ) {
    // Validate metric exists
    const metric = await this.usageRepo.findMetricByKey(dto.metricKey);
    if (!metric) {
      throw new NotFoundException(
        `Usage metric '${dto.metricKey}' is not registered in catalog`,
      );
    }

    const quota = await this.usageRepo.upsertQuota(
      organizationId,
      dto.metricKey,
      {
        quotaType: dto.quotaType,
        allocatedAmount: dto.allocatedAmount,
        authorizedOverride: dto.authorizedOverride,
        overrideReason: dto.overrideReason,
      },
    );

    if (actorUserId) {
      await this.audit.record({
        action: 'billing.quota.updated',
        organizationId,
        actorUserId,
        resource: 'billing_quota',
        resourceId: quota.id,
        details: {
          metricKey: dto.metricKey,
          quotaType: dto.quotaType,
          allocatedAmount: dto.allocatedAmount,
          authorizedOverride: dto.authorizedOverride,
        },
        eventName: 'billing.quota.updated',
        occurredAt: new Date(),
      });
    }

    return quota;
  }

  async listQuotas(organizationId: string) {
    return this.usageRepo.listQuotas(organizationId);
  }

  async registerMetric(
    metricKey: string,
    name: string,
    description?: string,
    unit: string = 'count',
    aggregationType: string = 'SUM',
  ) {
    return this.prisma.billingUsageMetric.upsert({
      where: { metricKey },
      create: { metricKey, name, description, unit, aggregationType },
      update: { name, description, unit, aggregationType },
    });
  }

  async listMetrics() {
    return this.usageRepo.listMetrics();
  }
}
