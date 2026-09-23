import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class BillingPlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPlan(data: Prisma.BillingPlanCreateInput) {
    return this.prisma.billingPlan.create({ data });
  }

  async findPlanById(id: string) {
    return this.prisma.billingPlan.findUnique({
      where: { id },
      include: {
        versions: {
          include: {
            prices: true,
            features: {
              include: { feature: true },
            },
          },
          orderBy: { version: 'desc' },
        },
      },
    });
  }

  async findPlanByKey(key: string) {
    return this.prisma.billingPlan.findUnique({
      where: { key },
      include: {
        versions: {
          include: {
            prices: true,
            features: {
              include: { feature: true },
            },
          },
          orderBy: { version: 'desc' },
        },
      },
    });
  }

  async listPlans(isPublicOnly: boolean = false) {
    return this.prisma.billingPlan.findMany({
      where: isPublicOnly ? { isPublic: true, status: 'ACTIVE' } : {},
      include: {
        versions: {
          where: { isPublished: true },
          include: {
            prices: true,
            features: {
              include: { feature: true },
            },
          },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updatePlan(id: string, data: Prisma.BillingPlanUpdateInput) {
    return this.prisma.billingPlan.update({
      where: { id },
      data,
    });
  }

  async createPlanVersion(data: Prisma.BillingPlanVersionCreateInput) {
    return this.prisma.billingPlanVersion.create({
      data,
      include: {
        prices: true,
        features: { include: { feature: true } },
      },
    });
  }

  async findPlanVersionById(id: string) {
    return this.prisma.billingPlanVersion.findUnique({
      where: { id },
      include: {
        plan: true,
        prices: true,
        features: { include: { feature: true } },
      },
    });
  }

  async updatePlanVersion(
    id: string,
    data: Prisma.BillingPlanVersionUpdateInput,
  ) {
    return this.prisma.billingPlanVersion.update({
      where: { id },
      data,
    });
  }

  async getLatestVersionNumber(planId: string): Promise<number> {
    const latest = await this.prisma.billingPlanVersion.findFirst({
      where: { planId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return latest?.version ?? 0;
  }

  async createFeature(data: Prisma.BillingFeatureCreateInput) {
    return this.prisma.billingFeature.create({ data });
  }

  async listFeatures() {
    return this.prisma.billingFeature.findMany({
      orderBy: { key: 'asc' },
    });
  }
}
