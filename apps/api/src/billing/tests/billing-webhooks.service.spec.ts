import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BillingWebhooksService } from '../services/billing-webhooks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentProviderService } from '../services/payment-provider.service';
import { SubscriptionsService } from '../services/subscriptions.service';
import { InvoicesService } from '../services/invoices.service';
import { AuditService } from '../../audit/audit.service';
import { EventBusService } from '../../events/event-bus.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { BillingWebhookStatus } from '@prisma/client';

describe('BillingWebhooksService (M42)', () => {
  let service: BillingWebhooksService;
  let prisma: {
    billingWebhookEvent: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
    billingSubscription: {
      update: jest.Mock;
    };
  };
  let providerService: {
    verifyWebhookSignature: jest.Mock;
  };
  let invoicesService: {
    applyPayment: jest.Mock;
  };
  let eventBus: {
    publish: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      billingWebhookEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      billingSubscription: {
        update: jest.fn(),
      },
    };
    providerService = {
      verifyWebhookSignature: jest.fn(),
    };
    invoicesService = {
      applyPayment: jest.fn().mockResolvedValue(undefined),
    };
    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingWebhooksService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentProviderService, useValue: providerService },
        {
          provide: SubscriptionsService,
          useValue: { validateTransition: jest.fn() },
        },
        { provide: InvoicesService, useValue: invoicesService },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: EventBusService, useValue: eventBus },
        {
          provide: StructuredLoggingService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<BillingWebhooksService>(BillingWebhooksService);
  });

  describe('handleInboundWebhook', () => {
    it('should reject webhook if signature verification fails', async () => {
      providerService.verifyWebhookSignature.mockReturnValue(false);

      await expect(
        service.handleInboundWebhook(
          'sandbox',
          {
            providerEventId: 'evt_1',
            eventType: 'subscription.activated',
            payload: {},
          },
          'invalid_sig',
          'secret_key',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return duplicate status without reprocessing if already processed (INV-449)', async () => {
      prisma.billingWebhookEvent.findUnique.mockResolvedValue({
        id: 'evt-db-1',
        providerEventId: 'evt_1',
        status: BillingWebhookStatus.PROCESSED,
      });

      const result = await service.handleInboundWebhook('sandbox', {
        providerEventId: 'evt_1',
        eventType: 'subscription.activated',
        payload: {},
      });

      expect(result.isDuplicate).toBe(true);
      expect(prisma.billingWebhookEvent.create).not.toHaveBeenCalled();
      expect(prisma.billingSubscription.update).not.toHaveBeenCalled();
    });

    it('should process new webhook event and transition status to PROCESSED', async () => {
      prisma.billingWebhookEvent.findUnique.mockResolvedValue(null);
      prisma.billingWebhookEvent.create.mockResolvedValue({
        id: 'evt-db-new',
        providerKey: 'sandbox',
        providerEventId: 'evt_new_1',
        eventType: 'subscription.activated',
        status: BillingWebhookStatus.RECEIVED,
      });
      prisma.billingWebhookEvent.update.mockResolvedValue({
        id: 'evt-db-new',
        providerEventId: 'evt_new_1',
        status: BillingWebhookStatus.PROCESSED,
      });

      const result = await service.handleInboundWebhook('sandbox', {
        providerEventId: 'evt_new_1',
        eventType: 'subscription.activated',
        payload: {
          subscriptionId: 'sub-1',
          organizationId: 'org-1',
        },
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.status).toBe(BillingWebhookStatus.PROCESSED);
      expect(prisma.billingSubscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { status: 'ACTIVE' },
      });
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'billing.webhook.processed' }),
      );
    });
  });
});
