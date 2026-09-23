import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchScope, Prisma } from '@prisma/client';

@Injectable()
export class FavoritesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async addFavorite(params: {
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
    return this.prisma.favoriteItem.upsert({
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
      },
    });
  }

  async listFavorites(params: {
    organizationId: string;
    userId: string;
    resourceType?: string;
    scope?: SearchScope;
    limit?: number;
  }) {
    return this.prisma.favoriteItem.findMany({
      where: {
        organizationId: params.organizationId,
        userId: params.userId,
        ...(params.resourceType ? { resourceType: params.resourceType } : {}),
        ...(params.scope ? { scope: params.scope } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: params.limit || 50,
    });
  }

  async removeFavorite(params: {
    organizationId: string;
    userId: string;
    resourceType: string;
    resourceId: string;
  }) {
    return this.prisma.favoriteItem.deleteMany({
      where: {
        organizationId: params.organizationId,
        userId: params.userId,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
      },
    });
  }

  async removeFavoriteById(id: string, organizationId: string, userId: string) {
    return this.prisma.favoriteItem.deleteMany({
      where: {
        id,
        organizationId,
        userId,
      },
    });
  }
}
