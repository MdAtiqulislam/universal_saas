import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, AnalyticsUsageEvent } from '@prisma/client';

@Injectable()
export class AnalyticsUsageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(data: {
    organizationId: string;
    userId?: string;
    eventType: string;
    resourceType: string;
    resourceId?: string;
    durationMs?: number;
    rowCount?: number;
    metadata?: Prisma.InputJsonValue;
  }): Promise<AnalyticsUsageEvent> {
    return this.prisma.analyticsUsageEvent.create({
      data: {
        organization: { connect: { id: data.organizationId } },
        userId: data.userId,
        eventType: data.eventType,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        durationMs: data.durationMs ?? 0,
        rowCount: data.rowCount ?? 0,
        metadata: data.metadata,
      },
    });
  }

  async listEvents(params: {
    organizationId: string;
    eventType?: string;
    resourceType?: string;
    since?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ events: AnalyticsUsageEvent[]; total: number }> {
    const {
      organizationId,
      eventType,
      resourceType,
      since,
      limit = 100,
      offset = 0,
    } = params;

    const where: Prisma.AnalyticsUsageEventWhereInput = {
      organizationId,
      ...(eventType ? { eventType } : {}),
      ...(resourceType ? { resourceType } : {}),
      ...(since ? { occurredAt: { gte: since } } : {}),
    };

    const [events, total] = await Promise.all([
      this.prisma.analyticsUsageEvent.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.analyticsUsageEvent.count({ where }),
    ]);

    return { events, total };
  }
}
