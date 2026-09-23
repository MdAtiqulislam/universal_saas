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
export class InventorySearchProvider implements SearchProvider {
  readonly resourceType = 'inventory.product';
  readonly scope = SearchScope.INVENTORY;
  readonly displayName = 'Products & Items';
  readonly requiredPermission = 'inventory.view';
  readonly searchableFields = ['sku', 'name', 'description'];
  readonly filterableFields = ['sku', 'name', 'isActive'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly filterEngine: FilterAstEngineService,
  ) {}

  async search(params: ProviderSearchParams): Promise<SearchRecord[]> {
    const { organizationId, query, filters, limit, offset } = params;

    const items = await this.prisma.item.findMany({
      where: {
        organizationId,
        ...(query
          ? {
              OR: [
                { sku: { contains: query, mode: 'insensitive' } },
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: limit * 2,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    const records: SearchRecord[] = items.map((i) => ({
      id: i.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: i.name,
      subtitle: `SKU: ${i.sku} • Active: ${i.isActive}`,
      description: i.description || undefined,
      status: i.isActive ? 'ACTIVE' : 'INACTIVE',
      url: `/inventory/products/${i.id}`,
      metadata: {
        sku: i.sku,
        name: i.name,
        isActive: i.isActive,
      },
      score: 0,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
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
    const items = await this.prisma.item.findMany({
      where: {
        organizationId,
        OR: [
          { sku: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      select: { id: true, sku: true, name: true },
    });

    return items.map((i) => ({
      id: i.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: i.name,
      subtitle: i.sku,
      url: `/inventory/products/${i.id}`,
      matchType: i.sku.toLowerCase().startsWith(query.toLowerCase())
        ? 'prefix'
        : 'entity',
    }));
  }

  async count(params: ProviderSearchParams): Promise<number> {
    const { organizationId, query } = params;
    return this.prisma.item.count({
      where: {
        organizationId,
        ...(query
          ? {
              OR: [
                { sku: { contains: query, mode: 'insensitive' } },
                { name: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    });
  }
}
