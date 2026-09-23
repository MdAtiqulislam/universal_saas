import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchScope, Prisma } from '@prisma/client';

@Injectable()
export class SearchHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async recordHistory(params: {
    organizationId: string;
    userId: string;
    queryText: string;
    scope: SearchScope;
    filters?: Record<string, unknown>;
    resultCount: number;
  }) {
    return this.prisma.searchHistory.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        queryText: params.queryText,
        scope: params.scope,
        filters: params.filters as Prisma.InputJsonValue,
        resultCount: params.resultCount,
      },
    });
  }

  async listUserHistory(params: {
    organizationId: string;
    userId: string;
    limit?: number;
  }) {
    return this.prisma.searchHistory.findMany({
      where: {
        organizationId: params.organizationId,
        userId: params.userId,
      },
      orderBy: { executedAt: 'desc' },
      take: params.limit || 20,
    });
  }

  async deleteHistoryItem(id: string, organizationId: string, userId: string) {
    return this.prisma.searchHistory.deleteMany({
      where: {
        id,
        organizationId,
        userId,
      },
    });
  }

  async clearUserHistory(organizationId: string, userId: string) {
    return this.prisma.searchHistory.deleteMany({
      where: {
        organizationId,
        userId,
      },
    });
  }
}
