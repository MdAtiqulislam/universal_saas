import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchScope } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class SearchAnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async recordSearchEvent(params: {
    organizationId: string;
    userId?: string;
    query?: string;
    scope: SearchScope;
    resourceTypes: string[];
    resultCount: number;
    durationMs: number;
    selectedResourceId?: string;
  }) {
    // Privacy-safe query hash: only SHA-256 hash stored for analytics (INV-499)
    const queryHash = params.query
      ? crypto
          .createHash('sha256')
          .update(params.query.trim().toLowerCase())
          .digest('hex')
      : 'empty_query';

    return this.prisma.searchAnalyticsEvent.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        queryHash,
        scope: params.scope,
        resourceTypes: params.resourceTypes,
        resultCount: params.resultCount,
        durationMs: params.durationMs,
        zeroResults: params.resultCount === 0,
        selectedResourceId: params.selectedResourceId,
      },
    });
  }

  async getSearchUsageOverview(organizationId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);
    const events = await this.prisma.searchAnalyticsEvent.findMany({
      where: {
        organizationId,
        occurredAt: { gte: since },
      },
    });

    const totalSearches = events.length;
    const zeroResultSearches = events.filter((e) => e.zeroResults).length;
    const avgDurationMs =
      totalSearches > 0
        ? Math.round(
            events.reduce((acc, curr) => acc + curr.durationMs, 0) /
              totalSearches,
          )
        : 0;

    return {
      totalSearches,
      zeroResultSearches,
      zeroResultRate:
        totalSearches > 0 ? zeroResultSearches / totalSearches : 0,
      avgDurationMs,
      timeframeDays: days,
    };
  }

  async getVolumeByModule(organizationId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);
    const events = await this.prisma.searchAnalyticsEvent.findMany({
      where: {
        organizationId,
        occurredAt: { gte: since },
      },
      select: { scope: true },
    });

    const counts: Record<string, number> = {};
    for (const e of events) {
      counts[e.scope] = (counts[e.scope] || 0) + 1;
    }

    return Object.entries(counts).map(([scope, count]) => ({
      scope,
      count,
      percentage: events.length > 0 ? count / events.length : 0,
    }));
  }

  async getZeroResultSearches(organizationId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);
    const events = await this.prisma.searchAnalyticsEvent.findMany({
      where: {
        organizationId,
        zeroResults: true,
        occurredAt: { gte: since },
      },
      orderBy: { occurredAt: 'desc' },
      take: 50,
      select: {
        queryHash: true,
        scope: true,
        resourceTypes: true,
        durationMs: true,
        occurredAt: true,
      },
    });

    return events;
  }

  async getSearchPerformance(organizationId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);
    const events = await this.prisma.searchAnalyticsEvent.findMany({
      where: {
        organizationId,
        occurredAt: { gte: since },
      },
      select: { durationMs: true, scope: true },
    });

    if (events.length === 0) {
      return { p50: 0, p90: 0, p99: 0, max: 0, avg: 0 };
    }

    const durations = events.map((e) => e.durationMs).sort((a, b) => a - b);
    const p50 = durations[Math.floor(durations.length * 0.5)];
    const p90 = durations[Math.floor(durations.length * 0.9)];
    const p99 = durations[Math.floor(durations.length * 0.99)];
    const max = durations[durations.length - 1];
    const avg = Math.round(
      durations.reduce((a, b) => a + b, 0) / durations.length,
    );

    return { p50, p90, p99, max, avg, sampleSize: events.length };
  }

  async getPopularSearchTerms(organizationId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);
    const events = await this.prisma.searchAnalyticsEvent.findMany({
      where: {
        organizationId,
        occurredAt: { gte: since },
      },
      select: { queryHash: true, scope: true },
    });

    const counts: Record<string, { count: number; scope: string }> = {};
    for (const e of events) {
      if (!counts[e.queryHash]) {
        counts[e.queryHash] = { count: 0, scope: e.scope };
      }
      counts[e.queryHash].count++;
    }

    return Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([queryHash, data]) => ({
        queryHash,
        scope: data.scope,
        frequency: data.count,
      }));
  }

  async getSavedViewsUsage(organizationId: string) {
    const views = await this.prisma.savedView.findMany({
      where: { organizationId },
      include: {
        shares: true,
        alerts: true,
      },
    });

    return {
      totalViews: views.length,
      personalViews: views.filter((v) => v.visibility === 'PERSONAL').length,
      sharedViews: views.filter((v) => v.visibility === 'SHARED').length,
      tenantViews: views.filter((v) => v.visibility === 'TENANT').length,
      viewsWithAlerts: views.filter((v) => v.alerts.length > 0).length,
    };
  }

  async getSearchAlertActivity(organizationId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);
    const executions = await this.prisma.searchAlertExecution.findMany({
      where: {
        organizationId,
        executedAt: { gte: since },
      },
      orderBy: { executedAt: 'desc' },
      take: 100,
    });

    const totalEvaluations = executions.length;
    const triggered = executions.filter((e) => e.status === 'TRIGGERED').length;
    const totalMatches = executions.reduce(
      (acc, curr) => acc + curr.matchCount,
      0,
    );

    return {
      totalEvaluations,
      triggeredCount: triggered,
      totalMatchesDiscovered: totalMatches,
      recentExecutions: executions.slice(0, 20),
    };
  }

  async getSearchApiUsage(organizationId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);
    const count = await this.prisma.searchAnalyticsEvent.count({
      where: {
        organizationId,
        occurredAt: { gte: since },
      },
    });

    return {
      totalApiRequests: count,
      periodDays: days,
      dailyAverage: Math.round(count / days),
    };
  }
}
