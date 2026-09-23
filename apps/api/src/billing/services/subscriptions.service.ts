import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { BillingSubscriptionRepository } from '../repositories/billing-subscription.repository';
import { BillingPlanRepository } from '../repositories/billing-plan.repository';
import { ProrationService } from './proration.service';
import {
  CreateSubscriptionDto,
  UpgradeSubscriptionDto,
  CancelSubscriptionDto,
} from '../dto/billing-subscription.dto';
import { BillingSubscriptionStatus } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { EventBusService } from '../../events/event-bus.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly subscriptionRepo: BillingSubscriptionRepository,
    private readonly planRepo: BillingPlanRepository,
    private readonly prorationService: ProrationService,
    private readonly audit: AuditService,
    private readonly logger: StructuredLoggingService,
    private readonly eventBus: EventBusService,
  ) {}

  validateTransition(
    currentStatus: BillingSubscriptionStatus,
    newStatus: BillingSubscriptionStatus,
  ) {
    // INV-435: Valid state transitions
    const validTransitions: Record<
      BillingSubscriptionStatus,
      BillingSubscriptionStatus[]
    > = {
      [BillingSubscriptionStatus.TRIALING]: [
        BillingSubscriptionStatus.ACTIVE,
        BillingSubscriptionStatus.PAUSED,
        BillingSubscriptionStatus.CANCELLED,
        BillingSubscriptionStatus.EXPIRED,
      ],
      [BillingSubscriptionStatus.ACTIVE]: [
        BillingSubscriptionStatus.PAST_DUE,
        BillingSubscriptionStatus.PAUSED,
        BillingSubscriptionStatus.CANCELLED,
        BillingSubscriptionStatus.EXPIRED,
      ],
      [BillingSubscriptionStatus.PAST_DUE]: [
        BillingSubscriptionStatus.ACTIVE,
        BillingSubscriptionStatus.CANCELLED,
        BillingSubscriptionStatus.EXPIRED,
      ],
      [BillingSubscriptionStatus.PAUSED]: [
        BillingSubscriptionStatus.ACTIVE,
        BillingSubscriptionStatus.CANCELLED,
      ],
      [BillingSubscriptionStatus.INCOMPLETE]: [
        BillingSubscriptionStatus.ACTIVE,
        BillingSubscriptionStatus.INCOMPLETE_EXPIRED,
        BillingSubscriptionStatus.CANCELLED,
      ],
      // INV-436: Terminal states cannot transition to other active states
      [BillingSubscriptionStatus.CANCELLED]: [],
      [BillingSubscriptionStatus.EXPIRED]: [],
      [BillingSubscriptionStatus.INCOMPLETE_EXPIRED]: [],
    };

    if (currentStatus === newStatus) return;

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid subscription state transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  async createSubscription(
    organizationId: string,
    dto: CreateSubscriptionDto,
    actorUserId?: string,
  ) {
    // INV-434: Only one active subscription exists per organization per subscription scope
    const existingActive =
      await this.subscriptionRepo.findActiveSubscriptionByOrg(
        organizationId,
        dto.scope || 'PLATFORM',
      );
    if (existingActive) {
      throw new ConflictException(
        `Organization already has an active subscription for scope '${dto.scope || 'PLATFORM'}'`,
      );
    }

    // INV-433: A subscription references a valid immutable plan version
    const version = await this.planRepo.findPlanVersionById(dto.planVersionId);
    if (!version) {
      throw new NotFoundException(
        `BillingPlanVersion '${dto.planVersionId}' not found`,
      );
    }

    const now = new Date();
    const trialDays = dto.trialDays ?? 14;
    const isTrial = trialDays > 0;
    const initialStatus = isTrial
      ? BillingSubscriptionStatus.TRIALING
      : BillingSubscriptionStatus.ACTIVE;

    const periodStart = now;
    const periodEnd = new Date(
      now.getTime() + (isTrial ? trialDays : 30) * 24 * 60 * 60 * 1000,
    );

    const priceId = dto.priceId || version.prices[0]?.id || null;

    const subscription = await this.subscriptionRepo.createSubscription({
      organization: { connect: { id: organizationId } },
      planVersion: { connect: { id: version.id } },
      ...(priceId ? { price: { connect: { id: priceId } } } : {}),
      status: initialStatus,
      scope: dto.scope || 'PLATFORM',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      trialStart: isTrial ? now : null,
      trialEnd: isTrial ? periodEnd : null,
      periods: {
        create: {
          organization: { connect: { id: organizationId } },
          periodStart,
          periodEnd,
          isClosed: false,
        },
      },
    });

    await this.audit.record({
      action: 'billing.subscription.created',
      organizationId,
      actorUserId,
      resource: 'billing_subscription',
      resourceId: subscription.id,
      details: {
        organizationId,
        planVersionId: version.id,
        status: initialStatus,
        scope: subscription.scope,
      },
      eventName: 'billing.subscription.created',
      occurredAt: new Date(),
    });

    void this.eventBus.publish({
      eventName: 'billing.subscription.created',
      occurredAt: new Date(),
      organizationId,
      payload: { subscriptionId: subscription.id, planVersionId: version.id },
    });

    return subscription;
  }

  async getActiveSubscription(
    organizationId: string,
    scope: string = 'PLATFORM',
  ) {
    return this.subscriptionRepo.findActiveSubscriptionByOrg(
      organizationId,
      scope,
    );
  }

  async getSubscription(subscriptionId: string, organizationId: string) {
    const sub =
      await this.subscriptionRepo.findSubscriptionById(subscriptionId);
    if (!sub) {
      throw new NotFoundException(`Subscription '${subscriptionId}' not found`);
    }
    // INV-432: Cross-tenant isolation
    if (sub.organizationId !== organizationId) {
      throw new ForbiddenException(
        'Access denied: Cannot view foreign organization subscription',
      );
    }
    return sub;
  }

  async upgradeSubscription(
    organizationId: string,
    dto: UpgradeSubscriptionDto,
    actorUserId?: string,
  ) {
    const sub =
      await this.subscriptionRepo.findActiveSubscriptionByOrg(organizationId);
    if (!sub) {
      throw new NotFoundException('No active subscription found to upgrade');
    }

    const newVersion = await this.planRepo.findPlanVersionById(
      dto.newPlanVersionId,
    );
    if (!newVersion) {
      throw new NotFoundException('New plan version not found');
    }

    const currentPrice = sub.price?.unitAmount || 0;
    const newPriceRecord = dto.newPriceId
      ? newVersion.prices.find((p) => p.id === dto.newPriceId)
      : newVersion.prices[0];
    const newPrice = newPriceRecord?.unitAmount || 0;

    // Proration calculation
    const proration = this.prorationService.calculateProration({
      currentPlanPriceMinorUnits: currentPrice,
      newPlanPriceMinorUnits: newPrice,
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
    });

    const updated = await this.subscriptionRepo.updateSubscription(sub.id, {
      planVersion: { connect: { id: newVersion.id } },
      ...(newPriceRecord
        ? { price: { connect: { id: newPriceRecord.id } } }
        : {}),
      status: BillingSubscriptionStatus.ACTIVE,
    });

    await this.audit.record({
      action: 'billing.subscription.upgraded',
      organizationId,
      actorUserId,
      resource: 'billing_subscription',
      resourceId: sub.id,
      details: {
        oldPlanVersionId: sub.planVersionId,
        newPlanVersionId: newVersion.id,
        proration,
      },
      eventName: 'billing.subscription.upgraded',
      occurredAt: new Date(),
    });

    void this.eventBus.publish({
      eventName: 'billing.subscription.upgraded',
      occurredAt: new Date(),
      organizationId,
      payload: {
        subscriptionId: sub.id,
        newPlanVersionId: newVersion.id,
        proration,
      },
    });

    return { subscription: updated, proration };
  }

  async cancelSubscription(
    organizationId: string,
    dto: CancelSubscriptionDto,
    actorUserId?: string,
  ) {
    const sub =
      await this.subscriptionRepo.findActiveSubscriptionByOrg(organizationId);
    if (!sub) {
      throw new NotFoundException('No active subscription found to cancel');
    }

    if (dto.immediately) {
      this.validateTransition(sub.status, BillingSubscriptionStatus.CANCELLED);
      const updated = await this.subscriptionRepo.updateSubscription(sub.id, {
        status: BillingSubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        endedAt: new Date(),
      });

      await this.audit.record({
        action: 'billing.subscription.cancelled',
        organizationId,
        actorUserId,
        resource: 'billing_subscription',
        resourceId: sub.id,
        details: { immediately: true, reason: dto.reason },
        eventName: 'billing.subscription.cancelled',
        occurredAt: new Date(),
      });

      return updated;
    } else {
      const updated = await this.subscriptionRepo.updateSubscription(sub.id, {
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
      });

      await this.audit.record({
        action: 'billing.subscription.cancel_scheduled',
        organizationId,
        actorUserId,
        resource: 'billing_subscription',
        resourceId: sub.id,
        details: { cancelAtPeriodEnd: true, reason: dto.reason },
        eventName: 'billing.subscription.cancel_scheduled',
        occurredAt: new Date(),
      });

      return updated;
    }
  }

  async pauseSubscription(organizationId: string, actorUserId?: string) {
    const sub =
      await this.subscriptionRepo.findActiveSubscriptionByOrg(organizationId);
    if (!sub) {
      throw new NotFoundException('No active subscription found to pause');
    }

    this.validateTransition(sub.status, BillingSubscriptionStatus.PAUSED);
    const updated = await this.subscriptionRepo.updateSubscription(sub.id, {
      status: BillingSubscriptionStatus.PAUSED,
    });

    await this.audit.record({
      action: 'billing.subscription.paused',
      organizationId,
      actorUserId,
      resource: 'billing_subscription',
      resourceId: sub.id,
      details: { previousStatus: sub.status },
      eventName: 'billing.subscription.paused',
      occurredAt: new Date(),
    });

    void this.eventBus.publish({
      eventName: 'billing.subscription.paused',
      occurredAt: new Date(),
      organizationId,
      payload: { subscriptionId: sub.id },
    });

    return updated;
  }

  async resumeSubscription(organizationId: string, actorUserId?: string) {
    const pausedSubs = await this.subscriptionRepo.listSubscriptions(
      organizationId,
      BillingSubscriptionStatus.PAUSED,
    );
    const sub = pausedSubs[0];
    if (!sub) {
      throw new NotFoundException('No paused subscription found to resume');
    }

    this.validateTransition(sub.status, BillingSubscriptionStatus.ACTIVE);
    const updated = await this.subscriptionRepo.updateSubscription(sub.id, {
      status: BillingSubscriptionStatus.ACTIVE,
    });

    await this.audit.record({
      action: 'billing.subscription.resumed',
      organizationId,
      actorUserId,
      resource: 'billing_subscription',
      resourceId: sub.id,
      details: { previousStatus: sub.status },
      eventName: 'billing.subscription.resumed',
      occurredAt: new Date(),
    });

    void this.eventBus.publish({
      eventName: 'billing.subscription.resumed',
      occurredAt: new Date(),
      organizationId,
      payload: { subscriptionId: sub.id },
    });

    return updated;
  }

  async listSubscriptions(organizationId: string) {
    return this.subscriptionRepo.listSubscriptions(organizationId);
  }
}
