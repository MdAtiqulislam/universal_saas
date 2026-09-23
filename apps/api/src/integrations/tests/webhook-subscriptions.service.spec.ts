import { Test, TestingModule } from '@nestjs/testing';
import { WebhookSubscriptionsService } from '../webhooks/webhook-subscriptions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { SsrfGuardService } from '../webhooks/ssrf-guard.service';

describe('WebhookSubscriptionsService', () => {
  let service: WebhookSubscriptionsService;
  let prisma: {
    webhookSubscription: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let ssrfGuard: {
    validateEndpoint: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      webhookSubscription: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    ssrfGuard = {
      validateEndpoint: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookSubscriptionsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: AuditService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: StructuredLoggingService, useValue: { log: jest.fn() } },
        { provide: SsrfGuardService, useValue: ssrfGuard },
      ],
    }).compile();

    service = module.get<WebhookSubscriptionsService>(
      WebhookSubscriptionsService,
    );
  });

  it('should validate SSRF before creating a webhook subscription', async () => {
    prisma.webhookSubscription.create.mockResolvedValue({
      id: 'sub-1',
      name: 'Order Hook',
      endpoint: 'https://api.external.com/webhooks',
      subscribedEvents: ['sales.order.created'],
      status: 'ACTIVE',
      createdAt: new Date(),
    });

    const result = await service.createSubscription(
      'org-1',
      {
        name: 'Order Hook',
        endpoint: 'https://api.external.com/webhooks',
        subscribedEvents: ['sales.order.created'],
      },
      'user-1',
    );

    expect(ssrfGuard.validateEndpoint).toHaveBeenCalledWith(
      'https://api.external.com/webhooks',
    );
    expect(result.id).toBe('sub-1');
    expect(result.signingSecretPrefix).toBeDefined();
  });

  it('should list active webhook subscriptions for tenant', async () => {
    prisma.webhookSubscription.findMany.mockResolvedValue([
      {
        id: 'sub-1',
        name: 'Test Sub',
        endpoint: 'https://api.external.com/webhooks',
        subscribedEvents: ['*'],
        status: 'ACTIVE',
        failureCount: 0,
        lastDeliveredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const list = await service.listSubscriptions('org-1');
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Test Sub');
  });
});
