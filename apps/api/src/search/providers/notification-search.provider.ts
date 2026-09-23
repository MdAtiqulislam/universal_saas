import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchScope } from '@prisma/client';
import {
  SearchProvider,
  SearchRecord,
  SuggestionItem,
  ProviderSearchParams,
  ProviderSuggestParams,
} from './search-provider.interface';
import { FilterAstEngineService } from '../services/filter-ast-engine.service';

@Injectable()
export class NotificationSearchProvider implements SearchProvider {
  readonly resourceType = 'notifications.notification';
  readonly scope = SearchScope.NOTIFICATIONS;
  readonly displayName = 'Notifications & Templates';
  readonly requiredPermission = 'notifications.read';
  readonly searchableFields = ['eventType', 'title', 'content'];
  readonly filterableFields = ['eventType', 'status', 'priority'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly filterEngine: FilterAstEngineService,
  ) {}

  async search(params: ProviderSearchParams): Promise<SearchRecord[]> {
    const { organizationId, query, filters, limit, offset } = params;

    const notifs = await this.prisma.notification.findMany({
      where: {
        organizationId,
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { eventType: { contains: query, mode: 'insensitive' } },
                { content: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: limit * 2,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    const records: SearchRecord[] = notifs.map((n) => ({
      id: n.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: n.title || n.eventType,
      subtitle: `Event: ${n.eventType} • Priority: ${n.priority}`,
      description: n.content.substring(0, 150),
      status: n.status,
      url: `/notifications/${n.id}`,
      metadata: {
        eventType: n.eventType,
        status: n.status,
        priority: n.priority,
      },
      score: 0,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }));

    if (!filters) {
      return records.slice(0, limit);
    }

    return records
      .filter((rec) => this.filterEngine.evaluate(rec.metadata || {}, filters))
      .slice(0, limit);
  }

  async suggest(params: ProviderSuggestParams): Promise<SuggestionItem[]> {
    const { organizationId, query, limit } = params;
    const notifs = await this.prisma.notification.findMany({
      where: {
        organizationId,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { eventType: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      select: { id: true, title: true, eventType: true },
    });

    return notifs.map((n) => ({
      id: n.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: n.title || n.eventType,
      subtitle: n.eventType,
      url: `/notifications/${n.id}`,
      matchType: (n.title || n.eventType)
        .toLowerCase()
        .startsWith(query.toLowerCase())
        ? 'prefix'
        : 'entity',
    }));
  }

  async count(params: ProviderSearchParams): Promise<number> {
    const { organizationId, query } = params;
    return this.prisma.notification.count({
      where: {
        organizationId,
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { eventType: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    });
  }
}
