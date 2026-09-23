import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingSubscriptionRepository } from '../repositories/billing-subscription.repository';
import { BillingUsageRepository } from '../repositories/billing-usage.repository';
import { BillingQuotaType } from '@prisma/client';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';

export interface EntitlementCheckResult {
  entitled: boolean;
  featureKey: string;
  isUnlimited: boolean;
  limit: number | null;
  reason?: string;
}

export interface EntitlementsSummary {
  organizationId: string;
  hasActiveSubscription: boolean;
  subscriptionId?: string;
  planName?: string;
  planVersion?: number;
  features: {
    key: string;
    name: string;
    enabled: boolean;
    isUnlimited: boolean;
    limit: number | null;
  }[];
  quotas: {
    metricKey: string;
    quotaType: BillingQuotaType;
    allocatedAmount: number;
    authorizedOverride: number | null;
    effectiveLimit: number;
    currentUsage: number;
    usagePercent: number;
  }[];
}

@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionRepo: BillingSubscriptionRepository,
    private readonly usageRepo: BillingUsageRepository,
    private readonly logger: StructuredLoggingService,
  ) {}

  async hasFeature(
    organizationId: string,
    featureKey: string,
  ): Promise<boolean> {
    const subscription =
      await this.subscriptionRepo.findActiveSubscriptionByOrg(
        organizationId,
        'PLATFORM',
      );
    if (!subscription) {
      return false;
    }

    const planFeature = await this.prisma.billingPlanFeature.findFirst({
      where: {
        planVersionId: subscription.planVersionId,
        feature: { key: featureKey },
      },
      include: { feature: true },
    });

    if (!planFeature) {
      return false;
    }

    return planFeature.enabled;
  }

  async getLimit(
    organizationId: string,
    featureKey: string,
  ): Promise<{ isUnlimited: boolean; limit: number | null }> {
    const subscription =
      await this.subscriptionRepo.findActiveSubscriptionByOrg(
        organizationId,
        'PLATFORM',
      );
    if (!subscription) {
      return { isUnlimited: false, limit: 0 };
    }

    const planFeature = await this.prisma.billingPlanFeature.findFirst({
      where: {
        planVersionId: subscription.planVersionId,
        feature: { key: featureKey },
      },
    });

    if (!planFeature || !planFeature.enabled) {
      return { isUnlimited: false, limit: 0 };
    }

    return {
      isUnlimited: planFeature.isUnlimited,
      limit: planFeature.isUnlimited ? null : planFeature.numericLimit,
    };
  }

  async assertEntitled(
    organizationId: string,
    featureKey: string,
  ): Promise<void> {
    const entitled = await this.hasFeature(organizationId, featureKey);
    if (!entitled) {
      this.logger.log({
        level: 'WARN',
        message: `Entitlement denied: feature '${featureKey}' is not active for organization`,
        organizationId,
        featureKey,
      });
      throw new ForbiddenException(
        `Feature entitlement '${featureKey}' is not active for this organization. Upgrade subscription to gain access.`,
      );
    }
  }

  async assertWithinQuota(
    organizationId: string,
    metricKey: string,
    requestedAmount: number = 1,
  ): Promise<void> {
    const quota = await this.usageRepo.findQuota(organizationId, metricKey);
    if (!quota) {
      // If no quota configured, platform allows usage by default
      return;
    }

    if (quota.quotaType === BillingQuotaType.UNLIMITED) {
      return;
    }

    // INV-443: Hard quota enforcement cannot exceed configured quota without an authorized override
    const effectiveLimit = quota.authorizedOverride ?? quota.allocatedAmount;

    if (quota.currentUsage + requestedAmount > effectiveLimit) {
      if (quota.quotaType === BillingQuotaType.HARD_LIMIT) {
        this.logger.log({
          level: 'WARN',
          message: `Hard quota exceeded for metric '${metricKey}'`,
          organizationId,
          metricKey,
          currentUsage: quota.currentUsage,
          effectiveLimit,
          requestedAmount,
        });
        throw new ForbiddenException(
          `Quota exceeded for '${metricKey}'. Current usage: ${quota.currentUsage}, Limit: ${effectiveLimit}, Requested: ${requestedAmount}.`,
        );
      } else {
        // SOFT_LIMIT: Log warning, allow consumption
        this.logger.log({
          level: 'WARN',
          message: `Soft quota exceeded for metric '${metricKey}'`,
          organizationId,
          metricKey,
          currentUsage: quota.currentUsage,
          effectiveLimit,
        });
      }
    }
  }

  async getEntitlementsSummary(
    organizationId: string,
  ): Promise<EntitlementsSummary> {
    const subscription =
      await this.subscriptionRepo.findActiveSubscriptionByOrg(
        organizationId,
        'PLATFORM',
      );

    const quotas = await this.usageRepo.listQuotas(organizationId);

    const mappedQuotas = quotas.map((q) => {
      const effectiveLimit = q.authorizedOverride ?? q.allocatedAmount;
      const usagePercent =
        effectiveLimit > 0
          ? Math.min(100, Math.round((q.currentUsage / effectiveLimit) * 100))
          : 0;
      return {
        metricKey: q.metricKey,
        quotaType: q.quotaType,
        allocatedAmount: q.allocatedAmount,
        authorizedOverride: q.authorizedOverride,
        effectiveLimit,
        currentUsage: q.currentUsage,
        usagePercent,
      };
    });

    if (!subscription) {
      return {
        organizationId,
        hasActiveSubscription: false,
        features: [],
        quotas: mappedQuotas,
      };
    }

    const planFeatures = await this.prisma.billingPlanFeature.findMany({
      where: { planVersionId: subscription.planVersionId },
      include: { feature: true },
    });

    return {
      organizationId,
      hasActiveSubscription: true,
      subscriptionId: subscription.id,
      planName: subscription.planVersion.plan.name,
      planVersion: subscription.planVersion.version,
      features: planFeatures.map((pf) => ({
        key: pf.feature.key,
        name: pf.feature.name,
        enabled: pf.enabled,
        isUnlimited: pf.isUnlimited,
        limit: pf.numericLimit,
      })),
      quotas: mappedQuotas,
    };
  }

  async registerFeature(
    key: string,
    name: string,
    description?: string,
    valueType: string = 'BOOLEAN',
  ) {
    return this.prisma.billingFeature.upsert({
      where: { key },
      create: { key, name, description, valueType },
      update: { name, description, valueType },
    });
  }

  async listCatalogFeatures() {
    return this.prisma.billingFeature.findMany({
      orderBy: { key: 'asc' },
    });
  }
}
