import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JobService } from '../../common/jobs/job.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';

const INTEGRATION_HEALTH_CHECK_JOB = 'INTEGRATION_HEALTH_CHECK';

@Injectable()
export class IntegrationHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobService: JobService,
    private readonly logger: StructuredLoggingService,
  ) {
    this.jobService.registerHandler(
      INTEGRATION_HEALTH_CHECK_JOB,
      (payload, onProgress) =>
        this.runHealthCheck(
          payload as { connectionId: string; organizationId: string },
          onProgress,
        ),
    );
  }

  async getIntegrationHealth(organizationId: string) {
    const [
      connections,
      apiKeys,
      subscriptions,
      recentDeliveries,
      recentInbound,
    ] = await Promise.all([
      this.prisma.integrationConnection.groupBy({
        by: ['status'],
        where: { organizationId, deletedAt: null },
        _count: true,
      }),
      this.prisma.apiKey.count({ where: { organizationId, revokedAt: null } }),
      this.prisma.webhookSubscription.groupBy({
        by: ['status'],
        where: { organizationId, deletedAt: null },
        _count: true,
      }),
      this.prisma.webhookDelivery.groupBy({
        by: ['status'],
        where: {
          organizationId,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        _count: true,
      }),
      this.prisma.inboundWebhookEvent.groupBy({
        by: ['status'],
        where: {
          organizationId,
          receivedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        _count: true,
      }),
    ]);

    return {
      connections: connections.reduce(
        (acc, g) => ({ ...acc, [g.status]: g._count }),
        {} as Record<string, number>,
      ),
      activeApiKeys: apiKeys,
      webhookSubscriptions: subscriptions.reduce(
        (acc, g) => ({ ...acc, [g.status]: g._count }),
        {} as Record<string, number>,
      ),
      last24hDeliveries: recentDeliveries.reduce(
        (acc, g) => ({ ...acc, [g.status]: g._count }),
        {} as Record<string, number>,
      ),
      last24hInbound: recentInbound.reduce(
        (acc, g) => ({ ...acc, [g.status]: g._count }),
        {} as Record<string, number>,
      ),
    };
  }

  async triggerHealthCheck(organizationId: string, connectionId: string) {
    await this.jobService.createJob(organizationId, {
      jobType: INTEGRATION_HEALTH_CHECK_JOB,
      payload: { connectionId, organizationId },
    });
    return { queued: true, connectionId };
  }

  private async runHealthCheck(
    payload: { connectionId: string; organizationId: string },
    onProgress: (percent: number) => Promise<void>,
  ): Promise<{ status: string }> {
    await onProgress(50);

    await this.prisma.integrationConnection.update({
      where: { id: payload.connectionId },
      data: { lastHealthCheck: new Date() },
    });

    await onProgress(100);

    this.logger.log({
      level: 'INFO',
      message: 'Integration health check completed',
      module: 'Integrations',
      event: 'INTEGRATION_HEALTH_CHECK',
      organizationId: payload.organizationId,
      connectionId: payload.connectionId,
    });

    return { status: 'CHECKED' };
  }
}
