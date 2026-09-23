import { Injectable, BadRequestException } from '@nestjs/common';
import { BillingSubscriptionRepository } from '../repositories/billing-subscription.repository';
import { AuditService } from '../../audit/audit.service';
import { BillingSubscriptionStatus } from '@prisma/client';

@Injectable()
export class TrialsService {
  constructor(
    private readonly subscriptionRepo: BillingSubscriptionRepository,
    private readonly audit: AuditService,
  ) {}

  async extendTrial(params: {
    subscriptionId: string;
    organizationId: string;
    additionalDays: number;
    reason: string;
    actorUserId?: string;
  }) {
    if (params.additionalDays <= 0) {
      throw new BadRequestException('Additional trial days must be positive');
    }

    const sub = await this.subscriptionRepo.findSubscriptionById(
      params.subscriptionId,
    );
    if (!sub || sub.organizationId !== params.organizationId) {
      throw new BadRequestException('Subscription not found');
    }

    if (sub.status !== BillingSubscriptionStatus.TRIALING) {
      throw new BadRequestException(
        `Cannot extend trial: subscription is in ${sub.status} state`,
      );
    }

    const currentTrialEnd = sub.trialEnd || sub.currentPeriodEnd;
    const newTrialEnd = new Date(
      currentTrialEnd.getTime() + params.additionalDays * 24 * 60 * 60 * 1000,
    );

    const updated = await this.subscriptionRepo.updateSubscription(sub.id, {
      trialEnd: newTrialEnd,
      currentPeriodEnd: newTrialEnd,
    });

    await this.audit.record({
      action: 'billing.trial.extended',
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      resource: 'billing_subscription',
      resourceId: sub.id,
      details: {
        organizationId: params.organizationId,
        additionalDays: params.additionalDays,
        reason: params.reason,
        oldTrialEnd: currentTrialEnd,
        newTrialEnd,
      },
      eventName: 'billing.trial.extended',
      occurredAt: new Date(),
    });

    return updated;
  }

  isTrialExpired(trialEnd?: Date | null): boolean {
    if (!trialEnd) return false;
    return trialEnd.getTime() <= Date.now();
  }
}
