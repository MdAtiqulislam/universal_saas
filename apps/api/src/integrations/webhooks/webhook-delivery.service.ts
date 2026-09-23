import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JobService } from '../../common/jobs/job.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { WebhookSignatureService } from './webhook-signature.service';
import { WebhookDeliveryStatus } from '@prisma/client';

const WEBHOOK_DELIVERY_JOB = 'WEBHOOK_DELIVERY';
const WEBHOOK_RETRY_JOB = 'WEBHOOK_RETRY';

@Injectable()
export class WebhookDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobService: JobService,
    private readonly logger: StructuredLoggingService,
    private readonly signatureService: WebhookSignatureService,
  ) {
    this.jobService.registerHandler(
      WEBHOOK_DELIVERY_JOB,
      (payload, onProgress) =>
        this.deliverWebhook(
          payload as { deliveryId: string; organizationId: string },
          onProgress,
        ),
    );
    this.jobService.registerHandler(WEBHOOK_RETRY_JOB, (payload, onProgress) =>
      this.deliverWebhook(
        payload as { deliveryId: string; organizationId: string },
        onProgress,
      ),
    );
  }

  async scheduleDelivery(
    organizationId: string,
    integrationEventId: string,
    subscriptionId: string,
  ): Promise<void> {
    const delivery = await this.prisma.webhookDelivery.upsert({
      where: {
        subscriptionId_integrationEventId: {
          subscriptionId,
          integrationEventId,
        },
      },
      create: {
        organizationId,
        subscriptionId,
        integrationEventId,
        status: 'PENDING',
        maxAttempts: 5,
      },
      update: {},
    });

    await this.jobService.createJob(organizationId, {
      jobType: WEBHOOK_DELIVERY_JOB,
      payload: { deliveryId: delivery.id, organizationId },
    });
  }

  private async deliverWebhook(
    payload: { deliveryId: string; organizationId: string },
    onProgress: (percent: number) => Promise<void>,
  ): Promise<{ delivered: boolean; status: number | null }> {
    await onProgress(10);

    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: payload.deliveryId },
      include: { subscription: true, integrationEvent: true },
    });

    if (
      !delivery ||
      delivery.status === 'SUCCESS' ||
      delivery.status === 'DEAD_LETTER'
    ) {
      return { delivered: false, status: null };
    }

    if (delivery.attemptCount >= delivery.maxAttempts) {
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: 'DEAD_LETTER' },
      });
      return { delivered: false, status: null };
    }

    await this.prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'IN_PROGRESS',
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });

    await onProgress(40);

    const timestamp = Math.floor(Date.now() / 1000);
    const payloadStr = JSON.stringify(delivery.integrationEvent.payload);
    const signature = this.signatureService.generateSignature(
      payloadStr,
      delivery.subscription.signingSecret,
      timestamp,
    );

    const startMs = Date.now();
    let httpStatus: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;
    let delivered = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        (delivery.subscription.timeoutSeconds ?? 30) * 1000,
      );

      const response = await fetch(delivery.subscription.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': String(timestamp),
          'X-Webhook-Event': delivery.integrationEvent.eventType,
          'X-Webhook-Delivery-Id': delivery.id,
        },
        body: payloadStr,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      httpStatus = response.status;
      responseBody = await response.text().catch(() => '');
      delivered = response.ok;
    } catch (e: unknown) {
      errorMessage = e instanceof Error ? e.message : 'Unknown delivery error';
    }

    const durationMs = Date.now() - startMs;
    await onProgress(90);

    if (delivered) {
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'SUCCESS',
          lastHttpStatus: httpStatus,
          lastResponseBody: responseBody?.substring(0, 500),
          durationMs,
          deliveredAt: new Date(),
        },
      });
      await this.prisma.webhookSubscription.update({
        where: { id: delivery.subscriptionId },
        data: { lastDeliveredAt: new Date(), failureCount: 0 },
      });
    } else {
      const isDeadLetter = delivery.attemptCount + 1 >= delivery.maxAttempts;
      const nextStatus: WebhookDeliveryStatus = isDeadLetter
        ? 'DEAD_LETTER'
        : 'FAILED';
      const nextRetry = isDeadLetter
        ? null
        : new Date(Date.now() + Math.pow(2, delivery.attemptCount) * 60_000);

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: nextStatus,
          lastHttpStatus: httpStatus,
          lastResponseBody: responseBody?.substring(0, 500),
          lastErrorMessage: errorMessage ?? 'Non-2xx response',
          durationMs,
          nextRetryAt: nextRetry,
        },
      });
      await this.prisma.webhookSubscription.update({
        where: { id: delivery.subscriptionId },
        data: { failureCount: { increment: 1 } },
      });

      if (!isDeadLetter && nextRetry) {
        await this.jobService.createJob(payload.organizationId, {
          jobType: WEBHOOK_RETRY_JOB,
          payload: {
            deliveryId: delivery.id,
            organizationId: payload.organizationId,
          },
        });
      }
    }

    await onProgress(100);

    this.logger.log({
      level: 'INFO',
      message: 'Webhook delivery attempt',
      module: 'Integrations',
      event: 'WEBHOOK_DELIVERY_ATTEMPT',
      organizationId: payload.organizationId,
      deliveryId: delivery.id,
      delivered,
      httpStatus: httpStatus ?? undefined,
      durationMs,
    });

    return { delivered, status: httpStatus };
  }

  async listDeliveries(organizationId: string, subscriptionId?: string) {
    return this.prisma.webhookDelivery.findMany({
      where: { organizationId, ...(subscriptionId ? { subscriptionId } : {}) },
      select: {
        id: true,
        subscriptionId: true,
        integrationEventId: true,
        status: true,
        attemptCount: true,
        lastHttpStatus: true,
        lastAttemptAt: true,
        deliveredAt: true,
        durationMs: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
