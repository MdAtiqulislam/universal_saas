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
export class UserSearchProvider implements SearchProvider {
  readonly resourceType = 'admin.user';
  readonly scope = SearchScope.ADMIN;
  readonly displayName = 'Users & Team Members';
  readonly requiredPermission = 'users.read';
  readonly searchableFields = ['email'];
  readonly filterableFields = ['email', 'status'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly filterEngine: FilterAstEngineService,
  ) {}

  async search(params: ProviderSearchParams): Promise<SearchRecord[]> {
    const { organizationId, query, filters, limit, offset } = params;

    const members = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        ...(query
          ? {
              user: {
                email: { contains: query, mode: 'insensitive' },
              },
            }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      take: limit * 2,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    const records: SearchRecord[] = members.map((m) => ({
      id: m.user.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: m.user.email,
      subtitle: `Member status: ${m.status}`,
      description: `Team member (${m.status})`,
      status: m.status,
      url: `/admin/users/${m.user.id}`,
      metadata: {
        email: m.user.email,
        status: m.status,
      },
      score: 0,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
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
    const members = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        user: {
          email: { contains: query, mode: 'insensitive' },
        },
      },
      include: {
        user: { select: { id: true, email: true } },
      },
      take: limit,
    });

    return members.map((m) => ({
      id: m.user.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: m.user.email,
      subtitle: m.status,
      url: `/admin/users/${m.user.id}`,
      matchType: m.user.email.toLowerCase().startsWith(query.toLowerCase())
        ? 'prefix'
        : 'entity',
    }));
  }

  async count(params: ProviderSearchParams): Promise<number> {
    const { organizationId, query } = params;
    return this.prisma.organizationMember.count({
      where: {
        organizationId,
        status: 'ACTIVE',
        ...(query
          ? {
              user: {
                email: { contains: query, mode: 'insensitive' },
              },
            }
          : {}),
      },
    });
  }
}
