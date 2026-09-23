import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhookSignatureService } from '../../integrations/webhooks/webhook-signature.service';
import { ProviderWebhookDto } from '../dto/webhook.dto';
import { DeliveryRepository } from '../repositories/delivery.repository';
import { NotificationDeliveryStatus, Prisma } from '@prisma/client';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';

@Injectable()
export class NotificationWebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signatureService: WebhookSignatureService,
    private readonly deliveryRepo: DeliveryRepository,
    private readonly logger: StructuredLoggingService,
  ) {}

  /**
   * INV-473: Provider webhook events are idempotently processed
   */
  async handleProviderWebhook(
    providerKey: string,
    dto: ProviderWebhookDto,
    signature?: string,
    webhookSecret?: string,
  ) {
    if (webhookSecret && signature) {
      const now = Math.floor(Date.now() / 1000);
      const isValid = this.signatureService.verifySignature(
        JSON.stringify(dto.payload),
        signature,
        webhookSecret,
        now,
      );
      if (!isValid) {
        throw new UnauthorizedException(
          'Invalid communication provider webhook signature',
        );
      }
    }

    // Check for existing processed webhook event for deduplication (INV-473)
    const existing = await this.prisma.notificationWebhookEvent.findUnique({
      where: {
        providerKey_providerEventId: {
          providerKey,
          providerEventId: dto.providerEventId,
        },
      },
    });

    if (existing && existing.status === 'PROCESSED') {
      this.logger.log({
        level: 'INFO',
        message: `Notification webhook ${dto.providerEventId} already processed (idempotent skip)`,
        providerKey,
        providerEventId: dto.providerEventId,
      });
      return {
        ...existing,
        isDuplicate: true,
      };
    }

    const event = existing
      ? existing
      : await this.prisma.notificationWebhookEvent.create({
          data: {
            providerKey,
            providerEventId: dto.providerEventId,
            eventType: dto.eventType,
            status: 'RECEIVED',
            payload: dto.payload as Prisma.InputJsonValue,
            signature,
          },
        });

    try {
      await this.processWebhookEvent(providerKey, dto.eventType, dto.payload);

      const processed = await this.prisma.notificationWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });

      return {
        ...processed,
        isDuplicate: false,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.prisma.notificationWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: 'FAILED',
          error: errorMessage,
        },
      });

      throw new BadRequestException(
        `Webhook processing failed: ${errorMessage}`,
      );
    }
  }

  private async processWebhookEvent(
    providerKey: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    const deliveryId = payload?.deliveryId as string;
    if (!deliveryId) {
      return; // Generic or heartbeat event
    }

    switch (eventType) {
      case 'email.delivered':
      case 'push.delivered':
      case 'sms.delivered':
        await this.deliveryRepo.updateDeliveryStatus({
          deliveryId,
          status: NotificationDeliveryStatus.DELIVERED,
          deliveredAt: new Date(),
        });
        break;

      case 'email.bounced':
        await this.deliveryRepo.updateDeliveryStatus({
          deliveryId,
          status: NotificationDeliveryStatus.BOUNCED,
          error:
            (payload.reason as string) || 'Mailbox rejected or unavailable',
        });
        break;

      case 'email.failed':
      case 'push.failed':
      case 'sms.failed':
        await this.deliveryRepo.updateDeliveryStatus({
          deliveryId,
          status: NotificationDeliveryStatus.FAILED,
          error: (payload.error as string) || 'Provider delivery error',
        });
        break;

      default:
        this.logger.log({
          level: 'INFO',
          message: `Unhandled communication webhook event type: ${eventType}`,
          providerKey,
        });
        break;
    }
  }
}
