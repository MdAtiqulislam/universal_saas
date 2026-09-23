import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from '../services/subscriptions.service';
import { BillingSubscriptionRepository } from '../repositories/billing-subscription.repository';
import { BillingPlanRepository } from '../repositories/billing-plan.repository';
import { ProrationService } from '../services/proration.service';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { EventBusService } from '../../events/event-bus.service';
import { BillingSubscriptionStatus } from '@prisma/client';

describe('SubscriptionsService (M42)', () => {
  let service: SubscriptionsService;
  let subscriptionRepo: {
    findActiveSubscriptionByOrg: jest.Mock;
    findSubscriptionById: jest.Mock;
    createSubscription: jest.Mock;
    updateSubscription: jest.Mock;
    listSubscriptions: jest.Mock;
  };
  let planRepo: {
    findPlanVersionById: jest.Mock;
  };
  let audit: {
    record: jest.Mock;
  };
  let eventBus: {
    publish: jest.Mock;
  };

  beforeEach(async () => {
    subscriptionRepo = {
      findActiveSubscriptionByOrg: jest.fn(),
      findSubscriptionById: jest.fn(),
      createSubscription: jest.fn(),
      updateSubscription: jest.fn(),
      listSubscriptions: jest.fn(),
    };
    planRepo = {
      findPlanVersionById: jest.fn(),
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        ProrationService,
        {
          provide: BillingSubscriptionRepository,
          useValue: subscriptionRepo,
        },
        { provide: BillingPlanRepository, useValue: planRepo },
        { provide: AuditService, useValue: audit },
        { provide: EventBusService, useValue: eventBus },
        {
          provide: StructuredLoggingService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  describe('createSubscription', () => {
    it('should reject creation if organization already has an active subscription', async () => {
      subscriptionRepo.findActiveSubscriptionByOrg.mockResolvedValue({
        id: 'sub-existing',
      });

      await expect(
        service.createSubscription('org-1', {
          planVersionId: 'ver-100',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject creation if target plan version does not exist', async () => {
      subscriptionRepo.findActiveSubscriptionByOrg.mockResolvedValue(null);
      planRepo.findPlanVersionById.mockResolvedValue(null);

      await expect(
        service.createSubscription('org-1', {
          planVersionId: 'ver-invalid',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should successfully create subscription with trial when trialDays > 0', async () => {
      subscriptionRepo.findActiveSubscriptionByOrg.mockResolvedValue(null);
      planRepo.findPlanVersionById.mockResolvedValue({
        id: 'ver-100',
        prices: [{ id: 'p-1', unitAmount: 2900 }],
      });
      subscriptionRepo.createSubscription.mockResolvedValue({
        id: 'sub-new',
        status: BillingSubscriptionStatus.TRIALING,
        scope: 'PLATFORM',
      });

      const result = await service.createSubscription('org-1', {
        planVersionId: 'ver-100',
        trialDays: 14,
      });

      expect(result.id).toBe('sub-new');
      expect(result.status).toBe(BillingSubscriptionStatus.TRIALING);
      expect(subscriptionRepo.createSubscription).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSubscription', () => {
    it('should throw NotFoundException if subscription does not exist', async () => {
      subscriptionRepo.findSubscriptionById.mockResolvedValue(null);

      await expect(
        service.getSubscription('sub-notfound', 'org-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for cross-tenant access attempt (INV-432)', async () => {
      subscriptionRepo.findSubscriptionById.mockResolvedValue({
        id: 'sub-1',
        organizationId: 'org-tenant-1',
      });

      await expect(
        service.getSubscription('sub-1', 'org-tenant-attacker'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('state transitions & pause/resume/cancel', () => {
    it('should validate legal and illegal state transitions (INV-435, INV-436)', () => {
      expect(() =>
        service.validateTransition(
          BillingSubscriptionStatus.ACTIVE,
          BillingSubscriptionStatus.PAUSED,
        ),
      ).not.toThrow();

      expect(() =>
        service.validateTransition(
          BillingSubscriptionStatus.CANCELLED,
          BillingSubscriptionStatus.ACTIVE,
        ),
      ).toThrow(BadRequestException);
    });

    it('should cancel subscription immediately when requested', async () => {
      subscriptionRepo.findActiveSubscriptionByOrg.mockResolvedValue({
        id: 'sub-1',
        status: BillingSubscriptionStatus.ACTIVE,
      });
      subscriptionRepo.updateSubscription.mockResolvedValue({
        id: 'sub-1',
        status: BillingSubscriptionStatus.CANCELLED,
      });

      const res = await service.cancelSubscription('org-1', {
        immediately: true,
        reason: 'Customer requested',
      });

      expect(res.status).toBe(BillingSubscriptionStatus.CANCELLED);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'billing.subscription.cancelled' }),
      );
    });

    it('should schedule cancellation at period end', async () => {
      subscriptionRepo.findActiveSubscriptionByOrg.mockResolvedValue({
        id: 'sub-1',
        status: BillingSubscriptionStatus.ACTIVE,
      });
      subscriptionRepo.updateSubscription.mockResolvedValue({
        id: 'sub-1',
        cancelAtPeriodEnd: true,
      });

      const res = await service.cancelSubscription('org-1', {
        immediately: false,
        reason: 'Switching provider',
      });

      expect(res.cancelAtPeriodEnd).toBe(true);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'billing.subscription.cancel_scheduled',
        }),
      );
    });

    it('should pause an active subscription', async () => {
      subscriptionRepo.findActiveSubscriptionByOrg.mockResolvedValue({
        id: 'sub-1',
        status: BillingSubscriptionStatus.ACTIVE,
      });
      subscriptionRepo.updateSubscription.mockResolvedValue({
        id: 'sub-1',
        status: BillingSubscriptionStatus.PAUSED,
      });

      const res = await service.pauseSubscription('org-1');
      expect(res.status).toBe(BillingSubscriptionStatus.PAUSED);
    });

    it('should resume a paused subscription', async () => {
      subscriptionRepo.listSubscriptions.mockResolvedValue([
        {
          id: 'sub-1',
          status: BillingSubscriptionStatus.PAUSED,
        },
      ]);
      subscriptionRepo.updateSubscription.mockResolvedValue({
        id: 'sub-1',
        status: BillingSubscriptionStatus.ACTIVE,
      });

      const res = await service.resumeSubscription('org-1');
      expect(res.status).toBe(BillingSubscriptionStatus.ACTIVE);
    });
  });
});
