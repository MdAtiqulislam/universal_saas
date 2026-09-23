import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { SsrfGuardService } from './ssrf-guard.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { WebhookSubscriptionStatus } from '@prisma/client';

@Injectable()
export class WebhookSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: StructuredLoggingService,
    private readonly ssrfGuard: SsrfGuardService,
  ) {}

  async listSubscriptions(organizationId: string) {
    return this.prisma.webhookSubscription.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        endpoint: true,
        subscribedEvents: true,
        status: true,
        failureCount: true,
        lastDeliveredAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSubscription(organizationId: string, id: string) {
    const sub = await this.prisma.webhookSubscription.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        endpoint: true,
        subscribedEvents: true,
        status: true,
        failureCount: true,
        retryPolicy: true,
        timeoutSeconds: true,
        lastDeliveredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!sub)
      throw new NotFoundException(`Webhook subscription '${id}' not found`);
    return sub;
  }

  async createSubscription(
    organizationId: string,
    dto: CreateSubscriptionDto,
    actorUserId: string,
  ) {
    await this.ssrfGuard.validateEndpoint(dto.endpoint);

    const signingSecret = crypto.randomBytes(32).toString('hex');

    const subscription = await this.prisma.webhookSubscription.create({
      data: {
        organizationId,
        name: dto.name,
        endpoint: dto.endpoint,
        signingSecret,
        subscribedEvents: dto.subscribedEvents,
        status: 'ACTIVE',
        retryPolicy: (dto.retryPolicy ?? {}) as never,
        timeoutSeconds: dto.timeoutSeconds ?? 30,
      },
    });

    await this.audit.record({
      eventName: 'WEBHOOK_SUBSCRIPTION_CREATED',
      action: 'WEBHOOK_SUBSCRIPTION_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      resource: 'webhook_subscription',
      resourceId: subscription.id,
      details: {
        name: dto.name,
        endpoint: dto.endpoint,
        subscribedEvents: dto.subscribedEvents,
      },
    });

    this.logger.log({
      level: 'INFO',
      message: 'Webhook subscription created',
      module: 'Integrations',
      event: 'WEBHOOK_SUBSCRIPTION_CREATED',
      organizationId,
      subscriptionId: subscription.id,
    });

    return {
      id: subscription.id,
      name: subscription.name,
      endpoint: subscription.endpoint,
      subscribedEvents: subscription.subscribedEvents,
      status: subscription.status,
      signingSecretPrefix: signingSecret.substring(0, 8) + '...',
      createdAt: subscription.createdAt,
    };
  }

  async updateSubscription(
    organizationId: string,
    id: string,
    dto: UpdateSubscriptionDto,
    actorUserId: string,
  ) {
    await this.getSubscription(organizationId, id);

    if (dto.endpoint) {
      await this.ssrfGuard.validateEndpoint(dto.endpoint);
    }

    const updated = await this.prisma.webhookSubscription.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.endpoint !== undefined && { endpoint: dto.endpoint }),
        ...(dto.subscribedEvents !== undefined && {
          subscribedEvents: dto.subscribedEvents,
        }),
        ...(dto.status !== undefined && {
          status: dto.status as WebhookSubscriptionStatus,
        }),
        ...(dto.retryPolicy !== undefined && {
          retryPolicy: dto.retryPolicy as never,
        }),
        ...(dto.timeoutSeconds !== undefined && {
          timeoutSeconds: dto.timeoutSeconds,
        }),
      },
      select: {
        id: true,
        name: true,
        endpoint: true,
        subscribedEvents: true,
        status: true,
        updatedAt: true,
      },
    });

    await this.audit.record({
      eventName: 'WEBHOOK_SUBSCRIPTION_UPDATED',
      action: 'WEBHOOK_SUBSCRIPTION_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      resource: 'webhook_subscription',
      resourceId: id,
      details: dto as Record<string, unknown>,
    });

    return updated;
  }

  async deleteSubscription(
    organizationId: string,
    id: string,
    actorUserId: string,
  ) {
    await this.getSubscription(organizationId, id);

    await this.prisma.webhookSubscription.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.record({
      eventName: 'WEBHOOK_SUBSCRIPTION_DELETED',
      action: 'WEBHOOK_SUBSCRIPTION_DELETED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      resource: 'webhook_subscription',
      resourceId: id,
    });

    return { success: true };
  }
}
