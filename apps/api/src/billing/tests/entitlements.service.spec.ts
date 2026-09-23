import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EntitlementsService } from '../services/entitlements.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingSubscriptionRepository } from '../repositories/billing-subscription.repository';
import { BillingUsageRepository } from '../repositories/billing-usage.repository';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { BillingQuotaType } from '@prisma/client';

describe('EntitlementsService (M42)', () => {
  let service: EntitlementsService;
  let prisma: {
    billingPlanFeature: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    billingFeature: {
      upsert: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let subscriptionRepo: {
    findActiveSubscriptionByOrg: jest.Mock;
  };
  let usageRepo: {
    findQuota: jest.Mock;
    listQuotas: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      billingPlanFeature: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      billingFeature: {
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
    };
    subscriptionRepo = {
      findActiveSubscriptionByOrg: jest.fn(),
    };
    usageRepo = {
      findQuota: jest.fn(),
      listQuotas: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitlementsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: BillingSubscriptionRepository,
          useValue: subscriptionRepo,
        },
        { provide: BillingUsageRepository, useValue: usageRepo },
        {
          provide: StructuredLoggingService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<EntitlementsService>(EntitlementsService);
  });

  describe('hasFeature', () => {
    it('should return false if organization has no active subscription', async () => {
      subscriptionRepo.findActiveSubscriptionByOrg.mockResolvedValue(null);
      const entitled = await service.hasFeature('org-1', 'advanced_analytics');
      expect(entitled).toBe(false);
    });

    it('should return true if feature is enabled in subscription plan version', async () => {
      subscriptionRepo.findActiveSubscriptionByOrg.mockResolvedValue({
        id: 'sub-1',
        planVersionId: 'ver-100',
      });
      prisma.billingPlanFeature.findFirst.mockResolvedValue({
        id: 'pf-1',
        enabled: true,
      });

      const entitled = await service.hasFeature('org-1', 'advanced_analytics');
      expect(entitled).toBe(true);
    });

    it('should return false if feature is disabled in plan version', async () => {
      subscriptionRepo.findActiveSubscriptionByOrg.mockResolvedValue({
        id: 'sub-1',
        planVersionId: 'ver-100',
      });
      prisma.billingPlanFeature.findFirst.mockResolvedValue({
        id: 'pf-1',
        enabled: false,
      });

      const entitled = await service.hasFeature('org-1', 'audit_export');
      expect(entitled).toBe(false);
    });
  });

  describe('assertEntitled', () => {
    it('should throw ForbiddenException if feature is not entitled', async () => {
      subscriptionRepo.findActiveSubscriptionByOrg.mockResolvedValue(null);

      await expect(
        service.assertEntitled('org-1', 'custom_branding'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should not throw if feature is enabled', async () => {
      subscriptionRepo.findActiveSubscriptionByOrg.mockResolvedValue({
        id: 'sub-1',
        planVersionId: 'ver-100',
      });
      prisma.billingPlanFeature.findFirst.mockResolvedValue({
        id: 'pf-1',
        enabled: true,
      });

      await expect(
        service.assertEntitled('org-1', 'custom_branding'),
      ).resolves.not.toThrow();
    });
  });

  describe('assertWithinQuota', () => {
    it('should pass if no quota configured for metric', async () => {
      usageRepo.findQuota.mockResolvedValue(null);
      await expect(
        service.assertWithinQuota('org-1', 'storage_gb', 5),
      ).resolves.not.toThrow();
    });

    it('should pass for UNLIMITED quota type regardless of usage', async () => {
      usageRepo.findQuota.mockResolvedValue({
        quotaType: BillingQuotaType.UNLIMITED,
        currentUsage: 999999,
        allocatedAmount: 1000,
      });
      await expect(
        service.assertWithinQuota('org-1', 'api_calls', 100),
      ).resolves.not.toThrow();
    });

    it('should throw ForbiddenException when HARD_LIMIT is exceeded without override', async () => {
      usageRepo.findQuota.mockResolvedValue({
        quotaType: BillingQuotaType.HARD_LIMIT,
        currentUsage: 95,
        allocatedAmount: 100,
        authorizedOverride: null,
      });

      await expect(
        service.assertWithinQuota('org-1', 'seats', 10),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should respect authorizedOverride when evaluating hard quotas', async () => {
      usageRepo.findQuota.mockResolvedValue({
        quotaType: BillingQuotaType.HARD_LIMIT,
        currentUsage: 95,
        allocatedAmount: 100,
        authorizedOverride: 150, // overridden limit
      });

      await expect(
        service.assertWithinQuota('org-1', 'seats', 10),
      ).resolves.not.toThrow();
    });

    it('should allow usage for SOFT_LIMIT even if exceeded', async () => {
      usageRepo.findQuota.mockResolvedValue({
        quotaType: BillingQuotaType.SOFT_LIMIT,
        currentUsage: 100,
        allocatedAmount: 100,
        authorizedOverride: null,
      });

      await expect(
        service.assertWithinQuota('org-1', 'webhooks_sent', 20),
      ).resolves.not.toThrow();
    });
  });
});
