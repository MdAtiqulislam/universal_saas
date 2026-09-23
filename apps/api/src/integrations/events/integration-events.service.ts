import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { JobService } from '../../common/jobs/job.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { WebhookDeliveryService } from '../webhooks/webhook-delivery.service';
import { ApplicationEvent } from '../../events/interfaces/application-event.interface';

const INTEGRATION_EVENT_DISPATCH_JOB = 'INTEGRATION_EVENT_DISPATCH';

@Injectable()
export class IntegrationEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly jobService: JobService,
    private readonly logger: StructuredLoggingService,
    private readonly deliveryService: WebhookDeliveryService,
  ) {
    this.jobService.registerHandler(
      INTEGRATION_EVENT_DISPATCH_JOB,
      (payload, onProgress) =>
        this.dispatchToSubscribers(
          payload as {
            integrationEventId: string;
            organizationId: string;
            subscriptionIds: string[];
          },
          onProgress,
        ),
    );
  }

  async recordAndDispatchEvent(
    organizationId: string,
    eventName: string,
    resourceType: string,
    payload: Record<string, unknown>,
    resourceId?: string,
  ): Promise<string | null> {
    try {
      const subscriptions = await this.prisma.webhookSubscription.findMany({
        where: {
          organizationId,
          deletedAt: null,
          status: 'ACTIVE',
          subscribedEvents: { hasSome: [eventName, '*'] },
        },
      });

      const integrationEvent = await this.prisma.integrationEvent.create({
        data: {
          organizationId,
          eventId: crypto.randomUUID(),
          eventType: eventName,
          resourceType,
          resourceId: resourceId ?? null,
          payload: payload as never,
          occurredAt: new Date(),
        },
      });

      if (subscriptions.length > 0) {
        await this.jobService.createJob(organizationId, {
          jobType: INTEGRATION_EVENT_DISPATCH_JOB,
          payload: {
            integrationEventId: integrationEvent.id,
            organizationId,
            subscriptionIds: subscriptions.map((s) => s.id),
          },
        });
      }

      return integrationEvent.id;
    } catch (e: unknown) {
      this.logger.log({
        level: 'ERROR',
        message: 'Failed to process event for webhook dispatch',
        module: 'Integrations',
        event: 'WEBHOOK_DISPATCH_ERROR',
        organizationId,
        eventName,
        error: e instanceof Error ? e.message : 'Unknown',
      });
      return null;
    }
  }

  async handleDomainEvent(
    event: ApplicationEvent & {
      organizationId?: string;
      resource?: string;
      resourceId?: string;
    },
  ): Promise<void> {
    const organizationId = event.organizationId;
    if (!organizationId || !event.eventName) return;

    await this.recordAndDispatchEvent(
      organizationId,
      event.eventName,
      event.resource ?? 'domain_event',
      event as unknown as Record<string, unknown>,
      event.resourceId,
    );
  }

  private async dispatchToSubscribers(
    payload: {
      integrationEventId: string;
      organizationId: string;
      subscriptionIds: string[];
    },
    onProgress: (percent: number) => Promise<void>,
  ): Promise<{ dispatched: number }> {
    await onProgress(10);
    let dispatched = 0;

    for (const subscriptionId of payload.subscriptionIds) {
      await this.deliveryService.scheduleDelivery(
        payload.organizationId,
        payload.integrationEventId,
        subscriptionId,
      );
      dispatched++;
    }

    await onProgress(100);
    return { dispatched };
  }

  async listEvents(organizationId: string) {
    return this.prisma.integrationEvent.findMany({
      where: { organizationId },
      orderBy: { occurredAt: 'desc' },
      take: 100,
    });
  }
}
