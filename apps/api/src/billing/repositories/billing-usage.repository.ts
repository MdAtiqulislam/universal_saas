import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, BillingQuotaType } from '@prisma/client';

@Injectable()
export class BillingUsageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMetric(data: Prisma.BillingUsageMetricCreateInput) {
    return this.prisma.billingUsageMetric.create({ data });
  }

  async findMetricByKey(metricKey: string) {
    return this.prisma.billingUsageMetric.findUnique({
      where: { metricKey },
    });
  }

  async listMetrics() {
    return this.prisma.billingUsageMetric.findMany({
      orderBy: { metricKey: 'asc' },
    });
  }

  async recordUsage(data: Prisma.BillingUsageRecordUncheckedCreateInput) {
    return this.prisma.billingUsageRecord.create({ data });
  }

  async findRecordByIdempotencyKey(
    organizationId: string,
    idempotencyKey: string,
  ) {
    return this.prisma.billingUsageRecord.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId,
          idempotencyKey,
        },
      },
    });
  }

  async getUsageSummary(organizationId: string, days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.prisma.billingUsageRecord.groupBy({
      by: ['metricKey'],
      where: {
        organizationId,
        timestamp: { gte: since },
      },
      _sum: {
        quantity: true,
      },
      _count: {
        id: true,
      },
    });
  }

  async listUsageRecords(
    organizationId: string,
    metricKey?: string,
    limit: number = 50,
  ) {
    return this.prisma.billingUsageRecord.findMany({
      where: {
        organizationId,
        ...(metricKey ? { metricKey } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async upsertQuota(
    organizationId: string,
    metricKey: string,
    data: {
      quotaType: BillingQuotaType;
      allocatedAmount: number;
      authorizedOverride?: number | null;
      overrideReason?: string | null;
    },
  ) {
    return this.prisma.billingQuota.upsert({
      where: {
        organizationId_metricKey: {
          organizationId,
          metricKey,
        },
      },
      create: {
        organizationId,
        metricKey,
        quotaType: data.quotaType,
        allocatedAmount: data.allocatedAmount,
        authorizedOverride: data.authorizedOverride,
        overrideReason: data.overrideReason,
        currentUsage: 0,
      },
      update: {
        quotaType: data.quotaType,
        allocatedAmount: data.allocatedAmount,
        authorizedOverride: data.authorizedOverride,
        overrideReason: data.overrideReason,
      },
    });
  }

  async findQuota(organizationId: string, metricKey: string) {
    return this.prisma.billingQuota.findUnique({
      where: {
        organizationId_metricKey: {
          organizationId,
          metricKey,
        },
      },
    });
  }

  async listQuotas(organizationId: string) {
    return this.prisma.billingQuota.findMany({
      where: { organizationId },
      include: { metric: true },
    });
  }

  async incrementQuotaUsage(
    organizationId: string,
    metricKey: string,
    amount: number,
  ) {
    return this.prisma.billingQuota.update({
      where: {
        organizationId_metricKey: {
          organizationId,
          metricKey,
        },
      },
      data: {
        currentUsage: {
          increment: amount,
        },
      },
    });
  }
}
