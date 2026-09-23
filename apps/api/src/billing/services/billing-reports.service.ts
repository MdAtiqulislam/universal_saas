import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BillingSubscriptionStatus,
  BillingInterval,
  BillingInvoiceStatus,
  BillingPaymentStatus,
} from '@prisma/client';

export interface MrrReport {
  currency: string;
  totalMrr: number; // minor units
  subscriptionCount: number;
  breakdownByPlan: {
    planKey: string;
    planName: string;
    subscriptionCount: number;
    mrr: number;
  }[];
}

export interface ArrReport {
  currency: string;
  totalArr: number; // minor units
  totalMrr: number;
  subscriptionCount: number;
}

export interface SubscriptionStatusSummary {
  status: BillingSubscriptionStatus;
  count: number;
}

export interface InvoiceAgingReport {
  currency: string;
  current0To30Days: number;
  pastDue31To60Days: number;
  pastDue61To90Days: number;
  pastDue90PlusDays: number;
  totalOutstanding: number;
}

export interface PaymentReliabilityReport {
  totalAttempts: number;
  succeededCount: number;
  failedCount: number;
  successRatePercentage: number;
  totalVolumeCollected: number;
}

@Injectable()
export class BillingReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMrrReport(currency: string = 'USD'): Promise<MrrReport> {
    const activeSubs = await this.prisma.billingSubscription.findMany({
      where: {
        status: {
          in: [
            BillingSubscriptionStatus.ACTIVE,
            BillingSubscriptionStatus.TRIALING,
          ],
        },
      },
      include: {
        planVersion: {
          include: {
            plan: true,
            prices: true,
          },
        },
      },
    });

    let totalMrr = 0;
    const planMap = new Map<
      string,
      {
        planKey: string;
        planName: string;
        subscriptionCount: number;
        mrr: number;
      }
    >();

    for (const sub of activeSubs) {
      // Find price matching currency
      const price =
        sub.planVersion.prices.find((p) => p.currency === currency) ||
        sub.planVersion.prices[0];

      let monthlyValue = 0;
      if (price) {
        if (price.interval === BillingInterval.MONTHLY) {
          monthlyValue = price.unitAmount;
        } else if (price.interval === BillingInterval.YEARLY) {
          monthlyValue = Math.round(price.unitAmount / 12);
        } else {
          monthlyValue = price.unitAmount;
        }
      }

      totalMrr += monthlyValue;

      const pKey = sub.planVersion.plan.key;
      const existing = planMap.get(pKey) || {
        planKey: pKey,
        planName: sub.planVersion.plan.name,
        subscriptionCount: 0,
        mrr: 0,
      };
      existing.subscriptionCount += 1;
      existing.mrr += monthlyValue;
      planMap.set(pKey, existing);
    }

    return {
      currency,
      totalMrr,
      subscriptionCount: activeSubs.length,
      breakdownByPlan: Array.from(planMap.values()),
    };
  }

  async getArrReport(currency: string = 'USD'): Promise<ArrReport> {
    const mrr = await this.getMrrReport(currency);
    return {
      currency,
      totalMrr: mrr.totalMrr,
      totalArr: mrr.totalMrr * 12,
      subscriptionCount: mrr.subscriptionCount,
    };
  }

  async getSubscriptionSummary(): Promise<SubscriptionStatusSummary[]> {
    const grouped = await this.prisma.billingSubscription.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    return grouped.map((g) => ({
      status: g.status,
      count: g._count.id,
    }));
  }

  async getNewSubscriptions(days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.prisma.billingSubscription.findMany({
      where: { createdAt: { gte: since } },
      include: {
        organization: { select: { id: true, name: true } },
        planVersion: { include: { plan: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getChurnReport(days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const cancelled = await this.prisma.billingSubscription.findMany({
      where: {
        status: BillingSubscriptionStatus.CANCELLED,
        cancelledAt: { gte: since },
      },
      include: {
        organization: { select: { id: true, name: true } },
        planVersion: { include: { plan: true } },
      },
    });

    const activeCount = await this.prisma.billingSubscription.count({
      where: { status: BillingSubscriptionStatus.ACTIVE },
    });

    const churnRate =
      activeCount + cancelled.length > 0
        ? Math.round(
            (cancelled.length / (activeCount + cancelled.length)) * 10000,
          ) / 100
        : 0;

    return {
      days,
      cancelledCount: cancelled.length,
      activeCount,
      churnRatePercentage: churnRate,
      cancellations: cancelled,
    };
  }

  async getInvoiceAgingReport(
    currency: string = 'USD',
  ): Promise<InvoiceAgingReport> {
    const unpaidInvoices = await this.prisma.billingInvoice.findMany({
      where: {
        currency,
        status: {
          in: [BillingInvoiceStatus.OPEN, BillingInvoiceStatus.PARTIALLY_PAID],
        },
      },
    });

    const now = Date.now();
    let current0To30Days = 0;
    let pastDue31To60Days = 0;
    let pastDue61To90Days = 0;
    let pastDue90PlusDays = 0;
    let totalOutstanding = 0;

    for (const inv of unpaidInvoices) {
      const ageDays = Math.floor(
        (now - new Date(inv.dueDate).getTime()) / (24 * 60 * 60 * 1000),
      );
      const amountDue = inv.amountDue;
      totalOutstanding += amountDue;

      if (ageDays <= 0 || ageDays <= 30) {
        current0To30Days += amountDue;
      } else if (ageDays <= 60) {
        pastDue31To60Days += amountDue;
      } else if (ageDays <= 90) {
        pastDue61To90Days += amountDue;
      } else {
        pastDue90PlusDays += amountDue;
      }
    }

    return {
      currency,
      current0To30Days,
      pastDue31To60Days,
      pastDue61To90Days,
      pastDue90PlusDays,
      totalOutstanding,
    };
  }

  async getPaymentReliabilityReport(): Promise<PaymentReliabilityReport> {
    const payments = await this.prisma.billingPayment.findMany();
    const totalAttempts = payments.length;
    const succeeded = payments.filter(
      (p) => p.status === BillingPaymentStatus.SUCCEEDED,
    );
    const failed = payments.filter(
      (p) => p.status === BillingPaymentStatus.FAILED,
    );

    const totalVolumeCollected = succeeded.reduce(
      (acc, p) => acc + p.amount,
      0,
    );
    const successRatePercentage =
      totalAttempts > 0
        ? Math.round((succeeded.length / totalAttempts) * 10000) / 100
        : 100;

    return {
      totalAttempts,
      succeededCount: succeeded.length,
      failedCount: failed.length,
      successRatePercentage,
      totalVolumeCollected,
    };
  }

  async getUsageConsumptionReport(organizationId?: string) {
    const where = organizationId ? { organizationId } : {};
    return this.prisma.billingUsageAggregate.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 100,
    });
  }

  async getRevenueByPlanReport() {
    const paidInvoices = await this.prisma.billingInvoice.findMany({
      where: { status: BillingInvoiceStatus.PAID },
      include: {
        subscription: {
          include: {
            planVersion: {
              include: { plan: true },
            },
          },
        },
      },
    });

    const revenueMap = new Map<
      string,
      { planName: string; totalRevenue: number }
    >();

    for (const inv of paidInvoices) {
      const planName =
        inv.subscription?.planVersion?.plan?.name || 'Ad-hoc / Custom';
      const existing = revenueMap.get(planName) || {
        planName,
        totalRevenue: 0,
      };
      existing.totalRevenue += inv.amountPaid;
      revenueMap.set(planName, existing);
    }

    return Array.from(revenueMap.values());
  }

  async getUpgradeDowngradeMovement() {
    // Return audit logs for plan upgrades/downgrades
    return this.prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            'billing.subscription.upgraded',
            'billing.subscription.downgraded',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
