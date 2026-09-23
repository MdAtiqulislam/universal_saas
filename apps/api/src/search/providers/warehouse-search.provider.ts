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
export class WarehouseSearchProvider implements SearchProvider {
  readonly resourceType = 'warehouse.location';
  readonly scope = SearchScope.WAREHOUSE;
  readonly displayName = 'Warehouse Locations';
  readonly requiredPermission = 'warehouse.locations.view';
  readonly searchableFields = ['code', 'name'];
  readonly filterableFields = ['code', 'name', 'isActive', 'type'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly filterEngine: FilterAstEngineService,
  ) {}

  async search(params: ProviderSearchParams): Promise<SearchRecord[]> {
    const { organizationId, query, filters, limit, offset } = params;

    const locations = await this.prisma.location.findMany({
      where: {
        organizationId,
        ...(query
          ? {
              OR: [
                { code: { contains: query, mode: 'insensitive' } },
                { name: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: limit * 2,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    const records: SearchRecord[] = locations.map((loc) => ({
      id: loc.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: loc.name,
      subtitle: `Code: ${loc.code} • Type: ${loc.type}`,
      description: `Facility location (active: ${loc.isActive})`,
      status: loc.isActive ? 'ACTIVE' : 'INACTIVE',
      url: `/warehouse/locations/${loc.id}`,
      metadata: {
        code: loc.code,
        name: loc.name,
        type: loc.type,
        isActive: loc.isActive,
      },
      score: 0,
      createdAt: loc.createdAt,
      updatedAt: loc.updatedAt,
    }));

    if (!filters) {
      return records.slice(0, limit);
    }

    return records
      .filter((r) => this.filterEngine.evaluate(r.metadata || {}, filters))
      .slice(0, limit);
  }

  async suggest(params: ProviderSuggestParams): Promise<SuggestionItem[]> {
    const { organizationId, query, limit } = params;
    const locations = await this.prisma.location.findMany({
      where: {
        organizationId,
        OR: [
          { code: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      select: { id: true, code: true, name: true },
    });

    return locations.map((loc) => ({
      id: loc.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: loc.name,
      subtitle: loc.code,
      url: `/warehouse/locations/${loc.id}`,
      matchType: loc.name.toLowerCase().startsWith(query.toLowerCase())
        ? 'prefix'
        : 'entity',
    }));
  }

  async count(params: ProviderSearchParams): Promise<number> {
    const { organizationId, query } = params;
    return this.prisma.location.count({
      where: {
        organizationId,
        ...(query
          ? {
              OR: [
                { code: { contains: query, mode: 'insensitive' } },
                { name: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    });
  }
}
