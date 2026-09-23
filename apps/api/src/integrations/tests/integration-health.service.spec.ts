import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationHealthService } from '../health/integration-health.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JobService } from '../../common/jobs/job.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';

describe('IntegrationHealthService', () => {
  let service: IntegrationHealthService;
  let prisma: {
    integrationConnection: { groupBy: jest.Mock };
    apiKey: { count: jest.Mock };
    webhookSubscription: { groupBy: jest.Mock };
    webhookDelivery: { groupBy: jest.Mock };
    inboundWebhookEvent: { groupBy: jest.Mock };
  };
  let jobService: {
    registerHandler: jest.Mock;
    createJob: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      integrationConnection: {
        groupBy: jest
          .fn()
          .mockResolvedValue([{ status: 'CONNECTED', _count: 3 }]),
      },
      apiKey: {
        count: jest.fn().mockResolvedValue(5),
      },
      webhookSubscription: {
        groupBy: jest.fn().mockResolvedValue([{ status: 'ACTIVE', _count: 2 }]),
      },
      webhookDelivery: {
        groupBy: jest
          .fn()
          .mockResolvedValue([{ status: 'SUCCESS', _count: 10 }]),
      },
      inboundWebhookEvent: {
        groupBy: jest
          .fn()
          .mockResolvedValue([{ status: 'PROCESSED', _count: 8 }]),
      },
    };
    jobService = {
      registerHandler: jest.fn(),
      createJob: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationHealthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JobService, useValue: jobService },
        { provide: StructuredLoggingService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get<IntegrationHealthService>(IntegrationHealthService);
  });

  it('should aggregate integration health across connections, keys, webhooks, and events', async () => {
    const health = await service.getIntegrationHealth('org-1');

    expect(health.connections['CONNECTED']).toBe(3);
    expect(health.activeApiKeys).toBe(5);
    expect(health.webhookSubscriptions['ACTIVE']).toBe(2);
    expect(health.last24hDeliveries['SUCCESS']).toBe(10);
    expect(health.last24hInbound['PROCESSED']).toBe(8);
  });

  it('should trigger a health check background job for a connection', async () => {
    const result = await service.triggerHealthCheck('org-1', 'conn-1');

    expect(result.queued).toBe(true);
    expect(result.connectionId).toBe('conn-1');
    expect(jobService.createJob).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        jobType: 'INTEGRATION_HEALTH_CHECK',
        payload: { connectionId: 'conn-1', organizationId: 'org-1' },
      }),
    );
  });
});
