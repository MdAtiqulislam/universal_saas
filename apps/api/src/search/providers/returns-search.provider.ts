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
export class ReturnsSearchProvider implements SearchProvider {
  readonly resourceType = 'returns.rma';
  readonly scope = SearchScope.RETURNS;
  readonly displayName = 'Returns & RMAs';
  readonly requiredPermission = 'returns.rma.view';
  readonly searchableFields = ['returnNumber', 'status'];
  readonly filterableFields = ['returnNumber', 'status', 'returnType'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly filterEngine: FilterAstEngineService,
  ) {}

  async search(params: ProviderSearchParams): Promise<SearchRecord[]> {
    const { organizationId, query, filters, limit, offset } = params;

    const returns = await this.prisma.returnRequest.findMany({
      where: {
        organizationId,
        ...(query
          ? {
              returnNumber: { contains: query, mode: 'insensitive' },
            }
          : {}),
      },
      take: limit * 2,
      skip: offset,
      orderBy: { requestedAt: 'desc' },
    });

    const records: SearchRecord[] = returns.map((r) => ({
      id: r.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: `Return ${r.returnNumber}`,
      subtitle: `Status: ${r.status} • Type: ${r.returnType}`,
      description: `Customer/supplier return request`,
      status: r.status,
      url: `/returns/rma/${r.id}`,
      metadata: {
        returnNumber: r.returnNumber,
        status: r.status,
        returnType: r.returnType,
      },
      score: 0,
      createdAt: r.requestedAt,
      updatedAt: r.resolvedAt || undefined,
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
    const returns = await this.prisma.returnRequest.findMany({
      where: {
        organizationId,
        returnNumber: { contains: query, mode: 'insensitive' },
      },
      take: limit,
      select: { id: true, returnNumber: true, status: true },
    });

    return returns.map((r) => ({
      id: r.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: r.returnNumber,
      subtitle: r.status,
      url: `/returns/rma/${r.id}`,
      matchType: r.returnNumber.toLowerCase().startsWith(query.toLowerCase())
        ? 'prefix'
        : 'entity',
    }));
  }

  async count(params: ProviderSearchParams): Promise<number> {
    const { organizationId, query } = params;
    return this.prisma.returnRequest.count({
      where: {
        organizationId,
        ...(query
          ? { returnNumber: { contains: query, mode: 'insensitive' } }
          : {}),
      },
    });
  }
}
