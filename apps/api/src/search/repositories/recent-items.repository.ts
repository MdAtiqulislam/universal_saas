import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchScope, Prisma } from '@prisma/client';

@Injectable()
export class RecentItemsRepository {
  private readonly maxRecentItemsPerUser = 50;

  constructor(private readonly prisma: PrismaService) {}

  async recordRecentItem(params: {
    organizationId: string;
    userId: string;
    resourceType: string;
    resourceId: string;
    scope?: SearchScope;
    title: string;
    subtitle?: string;
    url: string;
    metadata?: Record<string, unknown>;
  }) {
    const item = await this.prisma.recentItem.upsert({
      where: {
        organizationId_userId_resourceType_resourceId: {
          organizationId: params.organizationId,
          userId: params.userId,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
        },
      },
      update: {
        title: params.title,
        subtitle: params.subtitle,
        url: params.url,
        scope: params.scope || SearchScope.GLOBAL,
        metadata: (params.metadata || {}) as Prisma.InputJsonValue,
        accessedAt: new Date(),
      },
      create: {
        organizationId: params.organizationId,
        userId: params.userId,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        scope: params.scope || SearchScope.GLOBAL,
        title: params.title,
        subtitle: params.subtitle,
        url: params.url,
        metadata: (params.metadata || {}) as Prisma.InputJsonValue,
        accessedAt: new Date(),
      },
    });

    // Prune items exceeding max limit
    const excess = await this.prisma.recentItem.findMany({
      where: {
        organizationId: params.organizationId,
        userId: params.userId,
      },
      orderBy: { accessedAt: 'desc' },
      skip: this.maxRecentItemsPerUser,
      select: { id: true },
    });

    if (excess.length > 0) {
      await this.prisma.recentItem.deleteMany({
        where: {
          id: { in: excess.map((e) => e.id) },
        },
      });
    }

    return item;
  }

  async listRecentItems(params: {
    organizationId: string;
    userId: string;
    limit?: number;
  }) {
    return this.prisma.recentItem.findMany({
      where: {
        organizationId: params.organizationId,
        userId: params.userId,
      },
      orderBy: { accessedAt: 'desc' },
      take: Math.min(params.limit || 20, this.maxRecentItemsPerUser),
    });
  }

  async deleteRecentItem(id: string, organizationId: string, userId: string) {
    return this.prisma.recentItem.deleteMany({
      where: {
        id,
        organizationId,
        userId,
      },
    });
  }

  async clearRecentItems(organizationId: string, userId: string) {
    return this.prisma.recentItem.deleteMany({
      where: {
        organizationId,
        userId,
      },
    });
  }
}
