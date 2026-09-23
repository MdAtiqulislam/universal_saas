import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { BillingPlanRepository } from '../repositories/billing-plan.repository';
import {
  CreateBillingPlanDto,
  UpdateBillingPlanDto,
  CreateBillingPlanVersionDto,
} from '../dto/billing-plan.dto';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';

@Injectable()
export class BillingPlansService {
  constructor(
    private readonly planRepo: BillingPlanRepository,
    private readonly audit: AuditService,
    private readonly logger: StructuredLoggingService,
  ) {}

  computeChecksum(versionData: Record<string, unknown>): string {
    const payload = JSON.stringify(
      versionData,
      Object.keys(versionData).sort(),
    );
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  async createPlan(dto: CreateBillingPlanDto, actorUserId?: string) {
    // INV-426: BillingPlan key is globally unique
    const existing = await this.planRepo.findPlanByKey(dto.key);
    if (existing) {
      throw new ConflictException(
        `BillingPlan key '${dto.key}' already exists`,
      );
    }

    const plan = await this.planRepo.createPlan({
      key: dto.key.toLowerCase(),
      name: dto.name,
      description: dto.description,
      isPublic: dto.isPublic ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });

    await this.audit.record({
      action: 'billing.plan.created',
      organizationId: 'SYSTEM',
      resource: 'billing_plan',
      resourceId: plan.id,
      actorUserId,
      details: { key: plan.key, name: plan.name },
      eventName: 'billing.plan.created',
      occurredAt: new Date(),
    });

    return plan;
  }

  async getPlan(id: string) {
    const plan = await this.planRepo.findPlanById(id);
    if (!plan) {
      throw new NotFoundException(`BillingPlan '${id}' not found`);
    }
    return plan;
  }

  async getPlanByKey(key: string) {
    const plan = await this.planRepo.findPlanByKey(key.toLowerCase());
    if (!plan) {
      throw new NotFoundException(`BillingPlan key '${key}' not found`);
    }
    return plan;
  }

  async listPlans(isPublicOnly: boolean = false) {
    return this.planRepo.listPlans(isPublicOnly);
  }

  async updatePlan(
    id: string,
    dto: UpdateBillingPlanDto,
    actorUserId?: string,
  ) {
    await this.getPlan(id);
    const updated = await this.planRepo.updatePlan(id, dto);

    await this.audit.record({
      action: 'billing.plan.updated',
      organizationId: 'SYSTEM',
      resource: 'billing_plan',
      resourceId: id,
      actorUserId,
      details: dto as Record<string, unknown>,
      eventName: 'billing.plan.updated',
      occurredAt: new Date(),
    });

    return updated;
  }

  async createVersion(
    planId: string,
    dto: CreateBillingPlanVersionDto,
    actorUserId?: string,
  ) {
    // INV-427: BillingPlanVersion belongs to exactly one BillingPlan
    const plan = await this.getPlan(planId);
    const nextVer = (await this.planRepo.getLatestVersionNumber(planId)) + 1;

    // Validate prices minor units (INV-430)
    if (dto.prices) {
      for (const p of dto.prices) {
        if (p.unitAmount < 0) {
          throw new BadRequestException('Price unitAmount cannot be negative');
        }
      }
    }

    const version = await this.planRepo.createPlanVersion({
      plan: { connect: { id: plan.id } },
      version: nextVer,
      name: dto.name,
      isPublished: false,
      prices: dto.prices
        ? {
            create: dto.prices.map((p) => ({
              currency: p.currency || 'USD',
              interval: p.interval,
              pricingModel: p.pricingModel,
              unitAmount: p.unitAmount,
            })),
          }
        : undefined,
    });

    await this.audit.record({
      action: 'billing.plan_version.created',
      organizationId: 'SYSTEM',
      resource: 'billing_plan_version',
      resourceId: version.id,
      actorUserId,
      details: { planId, version: nextVer },
      eventName: 'billing.plan_version.created',
      occurredAt: new Date(),
    });

    return version;
  }

  async publishVersion(
    versionId: string,
    dto?: { effectiveFrom?: string; notes?: string },
    actorUserId?: string,
  ) {
    const version = await this.planRepo.findPlanVersionById(versionId);
    if (!version) {
      throw new NotFoundException(
        `BillingPlanVersion '${versionId}' not found`,
      );
    }

    if (version.isPublished) {
      return version; // Idempotent
    }

    // Compute immutable SHA-256 snapshot checksum (INV-428)
    const checksum = this.computeChecksum({
      versionId: version.id,
      versionNumber: version.version,
      prices: version.prices.map((p) => ({
        currency: p.currency,
        interval: p.interval,
        amount: p.unitAmount,
      })),
      features: version.features.map((f) => ({
        key: f.feature?.key,
        enabled: f.enabled,
        limit: f.numericLimit,
      })),
    });

    const published = await this.planRepo.updatePlanVersion(versionId, {
      isPublished: true,
      checksum,
      effectiveFrom: dto?.effectiveFrom
        ? new Date(dto.effectiveFrom)
        : new Date(),
    });

    await this.audit.record({
      action: 'billing.plan_version.published',
      organizationId: 'SYSTEM',
      resource: 'billing_plan_version',
      resourceId: versionId,
      actorUserId,
      details: { checksum, version: version.version, notes: dto?.notes },
      eventName: 'billing.plan_version.published',
      occurredAt: new Date(),
    });

    return published;
  }

  async getVersion(versionId: string) {
    const version = await this.planRepo.findPlanVersionById(versionId);
    if (!version) {
      throw new NotFoundException(
        `BillingPlanVersion '${versionId}' not found`,
      );
    }
    return version;
  }

  async listFeatures() {
    return this.planRepo.listFeatures();
  }
}
