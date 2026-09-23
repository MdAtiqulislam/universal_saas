import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentProviderService } from './payment-provider.service';
import { SubscriptionsService } from './subscriptions.service';
import { InvoicesService } from './invoices.service';
import { InboundBillingWebhookDto } from '../dto/billing-webhook.dto';
import {
  Prisma,
  BillingWebhookStatus,
  BillingSubscriptionStatus,
} from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { EventBusService } from '../../events/event-bus.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';

@Injectable()
export class BillingWebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providerService: PaymentProviderService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly invoicesService: InvoicesService,
    private readonly audit: AuditService,
    private readonly eventBus: EventBusService,
    private readonly logger: StructuredLoggingService,
  ) {}

  async handleInboundWebhook(
    providerKey: string,
    dto: InboundBillingWebhookDto,
    signature?: string,
    webhookSecret?: string,
  ) {
    const pKey = (providerKey || 'sandbox').toLowerCase();

    // Verify signature if secret is configured
    if (webhookSecret) {
      const isValid = this.providerService.verifyWebhookSignature(
        pKey,
        JSON.stringify(dto.payload),
        signature || '',
        webhookSecret,
      );
      if (!isValid) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    // INV-449: Billing webhook events are idempotently processed exactly once
    const existing = await this.prisma.billingWebhookEvent.findUnique({
      where: {
        providerKey_providerEventId: {
          providerKey: pKey,
          providerEventId: dto.providerEventId,
        },
      },
    });

    if (existing) {
      if (existing.status === BillingWebhookStatus.PROCESSED) {
        this.logger.log({
          level: 'INFO',
          message: 'Webhook event already processed (idempotent skip)',
          providerKey: pKey,
          providerEventId: dto.providerEventId,
        });
        return {
          ...existing,
          isDuplicate: true,
        };
      }
    }

    const event = existing
      ? existing
      : await this.prisma.billingWebhookEvent.create({
          data: {
            providerKey: pKey,
            providerEventId: dto.providerEventId,
            eventType: dto.eventType,
            status: BillingWebhookStatus.RECEIVED,
            payload: dto.payload as Prisma.InputJsonValue,
            signature,
          },
        });

    try {
      await this.dispatchWebhookAction(pKey, dto.eventType, dto.payload);

      const processed = await this.prisma.billingWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: BillingWebhookStatus.PROCESSED,
          processedAt: new Date(),
        },
      });

      await this.eventBus.publish({
        eventName: 'billing.webhook.processed',
        occurredAt: new Date(),
        resourceId: processed.id,
        organizationId: (dto.payload?.organizationId as string) || 'SYSTEM',
        payload: {
          providerKey: pKey,
          providerEventId: dto.providerEventId,
          eventType: dto.eventType,
        },
      });

      return {
        ...processed,
        isDuplicate: false,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.log({
        level: 'ERROR',
        message: `Failed to process billing webhook ${dto.providerEventId}: ${errorMessage}`,
        providerKey: pKey,
        providerEventId: dto.providerEventId,
        error: errorMessage,
      });

      await this.prisma.billingWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: BillingWebhookStatus.FAILED,
          error: errorMessage,
        },
      });

      throw new BadRequestException(
        `Webhook processing failed: ${errorMessage}`,
      );
    }
  }

  private async dispatchWebhookAction(
    providerKey: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    const organizationId = payload?.organizationId as string;
    const subscriptionId = payload?.subscriptionId as string;
    const invoiceId = payload?.invoiceId as string;

    switch (eventType) {
      case 'subscription.created':
      case 'subscription.activated':
        if (subscriptionId) {
          await this.prisma.billingSubscription.update({
            where: { id: subscriptionId },
            data: { status: BillingSubscriptionStatus.ACTIVE },
          });
        }
        break;

      case 'subscription.past_due':
        if (subscriptionId) {
          await this.prisma.billingSubscription.update({
            where: { id: subscriptionId },
            data: { status: BillingSubscriptionStatus.PAST_DUE },
          });
        }
        break;

      case 'subscription.cancelled':
        if (subscriptionId) {
          await this.prisma.billingSubscription.update({
            where: { id: subscriptionId },
            data: {
              status: BillingSubscriptionStatus.CANCELLED,
              cancelledAt: new Date(),
            },
          });
        }
        break;

      case 'invoice.payment_succeeded':
        if (invoiceId && organizationId) {
          const amount = (payload.amount as number) || 0;
          await this.invoicesService.applyPayment(invoiceId, organizationId, {
            amount,
            providerKey,
            providerTransactionId: payload.transactionId as string,
          });
        }
        break;

      default:
        this.logger.log({
          level: 'INFO',
          message: `Unhandled billing webhook event type: ${eventType}`,
          providerKey,
          eventType,
        });
        break;
    }
  }

  async listWebhookEvents(providerKey?: string, limit: number = 50) {
    return this.prisma.billingWebhookEvent.findMany({
      where: providerKey ? { providerKey } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
