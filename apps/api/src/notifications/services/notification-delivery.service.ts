import { Injectable, BadRequestException } from '@nestjs/common';
import { DeliveryRepository } from '../repositories/delivery.repository';
import { ChannelRouterService } from './channel-router.service';
import {
  NotificationDeliveryStatus,
  NotificationChannel,
} from '@prisma/client';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { MetricsService } from '../../operations/metrics/metrics.service';

@Injectable()
export class NotificationDeliveryService {
  private readonly maxAttempts = 5;

  constructor(
    private readonly deliveryRepo: DeliveryRepository,
    private readonly router: ChannelRouterService,
    private readonly logger: StructuredLoggingService,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * INV-458: Validates allowed delivery status transitions.
   * Terminal statuses (DELIVERED, BOUNCED, REJECTED, CANCELLED) cannot transition.
   */
  validateDeliveryTransition(
    currentStatus: NotificationDeliveryStatus,
    newStatus: NotificationDeliveryStatus,
  ): void {
    const terminalStatuses = new Set<NotificationDeliveryStatus>([
      NotificationDeliveryStatus.DELIVERED,
      NotificationDeliveryStatus.BOUNCED,
      NotificationDeliveryStatus.REJECTED,
      NotificationDeliveryStatus.CANCELLED,
    ]);

    if (terminalStatuses.has(currentStatus)) {
      throw new BadRequestException(
        `Illegal state transition: Terminal delivery status '${currentStatus}' cannot transition to '${newStatus}'`,
      );
    }
  }

  /**
   * Calculates exponential backoff delay in milliseconds based on attempt number
   */
  calculateBackoffMs(attemptNumber: number): number {
    const baseDelayMs = 1000;
    const maxDelayMs = 300000; // 5 minutes
    const backoff = Math.min(
      maxDelayMs,
      baseDelayMs * Math.pow(2, attemptNumber - 1),
    );
    return backoff;
  }

  async executeDelivery(params: {
    deliveryId: string;
    organizationId: string;
    notificationId: string;
    recipientId: string;
    channel: NotificationChannel;
    destination?: string;
    title?: string;
    content: string;
    metadata?: Record<string, unknown>;
  }) {
    const {
      deliveryId,
      organizationId,
      notificationId,
      recipientId,
      channel,
      destination,
      title,
      content,
      metadata,
    } = params;

    const delivery = await this.deliveryRepo.findDeliveryById(
      deliveryId,
      organizationId,
    );
    if (!delivery) {
      throw new BadRequestException(`Delivery '${deliveryId}' not found`);
    }

    this.validateDeliveryTransition(
      delivery.status,
      NotificationDeliveryStatus.PROCESSING,
    );

    // Increment attempt number sequentially (INV-457)
    const nextAttemptNumber = delivery.attemptCount + 1;

    await this.deliveryRepo.updateDeliveryStatus({
      deliveryId,
      status: NotificationDeliveryStatus.PROCESSING,
      incrementAttempt: true,
    });

    const sendResult = await this.router.dispatchWithFailover({
      notificationId,
      recipientId,
      channel,
      destination,
      title,
      content,
      metadata,
      organizationId,
    });

    // Record attempt (INV-457: unique and sequential per delivery)
    // INV-474: Sanitized summary, no sensitive credentials
    await this.deliveryRepo.recordAttempt({
      delivery: { connect: { id: deliveryId } },
      attemptNumber: nextAttemptNumber,
      providerKey: sendResult.providerKey,
      status: sendResult.success
        ? NotificationDeliveryStatus.DELIVERED
        : sendResult.failureCategory === 'PERMANENT'
          ? NotificationDeliveryStatus.REJECTED
          : NotificationDeliveryStatus.FAILED,
      providerMessageId: sendResult.providerMessageId,
      failureCode: sendResult.failureCode,
      failureCategory: sendResult.failureCategory,
      responseSummary: sendResult.error || 'Delivered successfully',
      durationMs: sendResult.durationMs,
    });

    if (sendResult.success) {
      await this.deliveryRepo.updateDeliveryStatus({
        deliveryId,
        status: NotificationDeliveryStatus.DELIVERED,
        deliveredAt: new Date(),
      });

      this.metrics.incrementCounter('notifications.delivered', {
        channel,
        provider: sendResult.providerKey,
      });

      return { success: true, status: NotificationDeliveryStatus.DELIVERED };
    }

    // Handle failure
    const isPermanent = sendResult.failureCategory === 'PERMANENT';
    const isBounced = sendResult.failureCode === 'EMAIL_BOUNCED';
    const reachedMax = nextAttemptNumber >= this.maxAttempts;

    let finalStatus: NotificationDeliveryStatus;
    let nextRetryAt: Date | undefined;

    if (isBounced) {
      finalStatus = NotificationDeliveryStatus.BOUNCED;
    } else if (isPermanent || reachedMax) {
      finalStatus = NotificationDeliveryStatus.FAILED;
    } else {
      finalStatus = NotificationDeliveryStatus.QUEUED;
      const backoffMs = this.calculateBackoffMs(nextAttemptNumber);
      nextRetryAt = new Date(Date.now() + backoffMs);
    }

    await this.deliveryRepo.updateDeliveryStatus({
      deliveryId,
      status: finalStatus,
      error: sendResult.error,
      nextRetryAt,
    });

    this.metrics.incrementCounter('notifications.failed', {
      channel,
      provider: sendResult.providerKey,
      failureCategory: sendResult.failureCategory || 'UNKNOWN',
    });

    return {
      success: false,
      status: finalStatus,
      error: sendResult.error,
      nextRetryAt,
    };
  }
}
