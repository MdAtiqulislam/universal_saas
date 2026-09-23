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
export class WorkflowSearchProvider implements SearchProvider {
  readonly resourceType = 'workflow.definition';
  readonly scope = SearchScope.WORKFLOW;
  readonly displayName = 'Workflows';
  readonly requiredPermission = 'workflows.view';
  readonly searchableFields = ['name', 'key', 'description'];
  readonly filterableFields = ['name', 'key', 'status'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly filterEngine: FilterAstEngineService,
  ) {}

  async search(params: ProviderSearchParams): Promise<SearchRecord[]> {
    const { organizationId, query, filters, limit, offset } = params;

    const workflows = await this.prisma.workflowDefinition.findMany({
      where: {
        organizationId,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { key: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: limit * 2,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    const records: SearchRecord[] = workflows.map((w) => ({
      id: w.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: w.name,
      subtitle: `Key: ${w.key} • Status: ${w.status}`,
      description: w.description || undefined,
      status: w.status,
      url: `/workflows/definitions/${w.id}`,
      metadata: {
        name: w.name,
        key: w.key,
        status: w.status,
      },
      score: 0,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
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
    const workflows = await this.prisma.workflowDefinition.findMany({
      where: {
        organizationId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { key: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      select: { id: true, name: true, key: true },
    });

    return workflows.map((w) => ({
      id: w.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: w.name,
      subtitle: w.key,
      url: `/workflows/definitions/${w.id}`,
      matchType: w.name.toLowerCase().startsWith(query.toLowerCase())
        ? 'prefix'
        : 'entity',
    }));
  }

  async count(params: ProviderSearchParams): Promise<number> {
    const { organizationId, query } = params;
    return this.prisma.workflowDefinition.count({
      where: {
        organizationId,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { key: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    });
  }
}
