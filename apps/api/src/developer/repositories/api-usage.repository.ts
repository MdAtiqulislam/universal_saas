import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UsageQueryDto } from '../dto/usage-query.dto';

export interface CreateApiUsageInput {
  organizationId: string;
  apiKeyId?: string | null;
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  responseClass: string;
  userAgent?: string | null;
  clientIpHash?: string | null;
  apiVersion?: string;
}

@Injectable()
export class ApiUsageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createUsageRecord(data: CreateApiUsageInput) {
    return this.prisma.apiUsageRecord.create({
      data: {
        organizationId: data.organizationId,
        apiKeyId: data.apiKeyId,
        requestId: data.requestId,
        method: data.method.toUpperCase(),
        route: data.route,
        statusCode: data.statusCode,
        durationMs: Math.max(0, data.durationMs),
        responseClass: data.responseClass,
        userAgent: data.userAgent?.substring(0, 500),
        clientIpHash: data.clientIpHash,
        apiVersion: data.apiVersion || 'v1',
      },
    });
  }

  async findUsageRecords(organizationId: string, query: UsageQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const days = query.days || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const where: Prisma.ApiUsageRecordWhereInput = {
      organizationId,
      createdAt: { gte: since },
      ...(query.apiKeyId ? { apiKeyId: query.apiKeyId } : {}),
      ...(query.route
        ? { route: { contains: query.route, mode: 'insensitive' } }
        : {}),
      ...(query.method ? { method: query.method.toUpperCase() } : {}),
      ...(query.responseClass ? { responseClass: query.responseClass } : {}),
    };

    const [total, records] = await Promise.all([
      this.prisma.apiUsageRecord.count({ where }),
      this.prisma.apiUsageRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          apiKey: {
            select: {
              id: true,
              name: true,
              keyPrefix: true,
            },
          },
        },
      }),
    ]);

    return {
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getAggregatedMetrics(organizationId: string, days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalRequests, requests24h, records] = await Promise.all([
      this.prisma.apiUsageRecord.count({
        where: { organizationId, createdAt: { gte: since } },
      }),
      this.prisma.apiUsageRecord.count({
        where: { organizationId, createdAt: { gte: dayAgo } },
      }),
      this.prisma.apiUsageRecord.findMany({
        where: { organizationId, createdAt: { gte: since } },
        select: {
          statusCode: true,
          durationMs: true,
          responseClass: true,
          apiKeyId: true,
        },
        take: 2000,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    let successCount = 0;
    let errorCount = 0;
    let rateLimitedCount = 0;
    const durations: number[] = [];
    const activeKeyIds = new Set<string>();

    for (const r of records) {
      if (r.statusCode >= 200 && r.statusCode < 400) {
        successCount++;
      } else if (r.statusCode >= 400) {
        errorCount++;
        if (r.statusCode === 429) {
          rateLimitedCount++;
        }
      }
      durations.push(r.durationMs);
      if (r.apiKeyId) {
        activeKeyIds.add(r.apiKeyId);
      }
    }

    durations.sort((a, b) => a - b);
    const sampleSize = durations.length;
    const avgLatency =
      sampleSize > 0
        ? Math.round(durations.reduce((s, v) => s + v, 0) / sampleSize)
        : 0;
    const p50Latency =
      sampleSize > 0 ? durations[Math.floor(sampleSize * 0.5)] : 0;
    const p95Latency =
      sampleSize > 0 ? durations[Math.floor(sampleSize * 0.95)] : 0;
    const p99Latency =
      sampleSize > 0 ? durations[Math.floor(sampleSize * 0.99)] : 0;

    const sampleTotal = successCount + errorCount;
    const successRate =
      sampleTotal > 0
        ? Math.round((successCount / sampleTotal) * 1000) / 10
        : 100;
    const errorRate =
      sampleTotal > 0 ? Math.round((errorCount / sampleTotal) * 1000) / 10 : 0;

    return {
      totalRequests,
      requests24h,
      successCount,
      errorCount,
      rateLimitedCount,
      successRate,
      errorRate,
      avgLatency,
      p50Latency,
      p95Latency,
      p99Latency,
      activeKeysCount: activeKeyIds.size,
      sampleSize,
    };
  }

  async getEndpointMetrics(organizationId: string, days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const records = await this.prisma.apiUsageRecord.findMany({
      where: { organizationId, createdAt: { gte: since } },
      select: { route: true, method: true, statusCode: true, durationMs: true },
      take: 2000,
    });

    const endpointMap = new Map<
      string,
      {
        route: string;
        method: string;
        count: number;
        errors: number;
        totalDuration: number;
      }
    >();

    for (const r of records) {
      const key = `${r.method} ${r.route}`;
      let stat = endpointMap.get(key);
      if (!stat) {
        stat = {
          route: r.route,
          method: r.method,
          count: 0,
          errors: 0,
          totalDuration: 0,
        };
        endpointMap.set(key, stat);
      }
      stat.count++;
      stat.totalDuration += r.durationMs;
      if (r.statusCode >= 400) stat.errors++;
    }

    return Array.from(endpointMap.values())
      .map((e) => ({
        route: e.route,
        method: e.method,
        requests: e.count,
        errors: e.errors,
        errorRate: Math.round((e.errors / e.count) * 1000) / 10,
        avgDurationMs: Math.round(e.totalDuration / e.count),
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 15);
  }

  async getStatusCodeBreakdown(organizationId: string, days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const records = await this.prisma.apiUsageRecord.findMany({
      where: { organizationId, createdAt: { gte: since } },
      select: { statusCode: true, responseClass: true },
      take: 2000,
    });

    const classMap: Record<string, number> = {
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0,
    };
    const codeMap: Record<number, number> = {};

    for (const r of records) {
      classMap[r.responseClass] = (classMap[r.responseClass] || 0) + 1;
      codeMap[r.statusCode] = (codeMap[r.statusCode] || 0) + 1;
    }

    return {
      classes: classMap,
      codes: codeMap,
    };
  }

  async getRecentErrors(organizationId: string, limit: number = 20) {
    return this.prisma.apiUsageRecord.findMany({
      where: {
        organizationId,
        statusCode: { gte: 400 },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        apiKey: {
          select: {
            id: true,
            name: true,
            keyPrefix: true,
          },
        },
      },
    });
  }

  async purgeOldRecords(organizationId: string, olderThan: Date) {
    const result = await this.prisma.apiUsageRecord.deleteMany({
      where: {
        organizationId,
        createdAt: { lt: olderThan },
      },
    });
    return result.count;
  }
}
