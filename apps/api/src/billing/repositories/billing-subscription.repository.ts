import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, BillingSubscriptionStatus } from '@prisma/client';

@Injectable()
export class BillingSubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSubscription(data: Prisma.BillingSubscriptionCreateInput) {
    return this.prisma.billingSubscription.create({
      data,
      include: {
        planVersion: {
          include: {
            plan: true,
            features: { include: { feature: true } },
          },
        },
        price: true,
        items: true,
      },
    });
  }

  async findSubscriptionById(id: string) {
    return this.prisma.billingSubscription.findUnique({
      where: { id },
      include: {
        planVersion: {
          include: {
            plan: true,
            features: { include: { feature: true } },
          },
        },
        price: true,
        items: true,
        periods: {
          orderBy: { periodStart: 'desc' },
          take: 5,
        },
      },
    });
  }

  async findActiveSubscriptionByOrg(
    organizationId: string,
    scope: string = 'PLATFORM',
  ) {
    return this.prisma.billingSubscription.findFirst({
      where: {
        organizationId,
        scope,
        status: {
          in: [
            BillingSubscriptionStatus.ACTIVE,
            BillingSubscriptionStatus.TRIALING,
            BillingSubscriptionStatus.PAST_DUE,
            BillingSubscriptionStatus.PAUSED,
          ],
        },
      },
      include: {
        planVersion: {
          include: {
            plan: true,
            features: { include: { feature: true } },
          },
        },
        price: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listSubscriptions(
    organizationId: string,
    status?: BillingSubscriptionStatus,
  ) {
    return this.prisma.billingSubscription.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      include: {
        planVersion: {
          include: {
            plan: true,
          },
        },
        price: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateSubscription(
    id: string,
    data: Prisma.BillingSubscriptionUpdateInput,
  ) {
    return this.prisma.billingSubscription.update({
      where: { id },
      data,
      include: {
        planVersion: {
          include: {
            plan: true,
            features: { include: { feature: true } },
          },
        },
        price: true,
      },
    });
  }

  async createBillingPeriod(data: Prisma.BillingPeriodCreateInput) {
    return this.prisma.billingPeriod.create({ data });
  }

  async findCurrentPeriod(subscriptionId: string) {
    const now = new Date();
    return this.prisma.billingPeriod.findFirst({
      where: {
        subscriptionId,
        periodStart: { lte: now },
        periodEnd: { gte: now },
        isClosed: false,
      },
      orderBy: { periodStart: 'desc' },
    });
  }

  async listPeriods(subscriptionId: string) {
    return this.prisma.billingPeriod.findMany({
      where: { subscriptionId },
      orderBy: { periodStart: 'desc' },
    });
  }
}
