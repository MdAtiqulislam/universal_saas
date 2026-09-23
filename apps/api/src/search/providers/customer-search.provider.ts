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
export class CustomerSearchProvider implements SearchProvider {
  readonly resourceType = 'crm.customer';
  readonly scope = SearchScope.CRM;
  readonly displayName = 'Customers & Accounts';
  readonly requiredPermission = 'crm.view';
  readonly searchableFields = ['name', 'email', 'phone', 'code'];
  readonly filterableFields = ['code', 'name', 'email', 'isActive'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly filterEngine: FilterAstEngineService,
  ) {}

  async search(params: ProviderSearchParams): Promise<SearchRecord[]> {
    const { organizationId, query, filters, limit, offset } = params;

    const customers = await this.prisma.customer.findMany({
      where: {
        organizationId,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                { code: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: limit * 2,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    const records: SearchRecord[] = customers.map((c) => ({
      id: c.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: c.name,
      subtitle: `${c.code} • ${c.email || 'No email'}`,
      description: `Customer account (active: ${c.isActive})`,
      status: c.isActive ? 'ACTIVE' : 'INACTIVE',
      url: `/crm/customers/${c.id}`,
      metadata: {
        code: c.code,
        name: c.name,
        email: c.email,
        phone: c.phone,
        isActive: c.isActive,
      },
      score: 0,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
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
    const customers = await this.prisma.customer.findMany({
      where: {
        organizationId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { code: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      select: { id: true, name: true, code: true },
    });

    return customers.map((c) => ({
      id: c.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: c.name,
      subtitle: c.code,
      url: `/crm/customers/${c.id}`,
      matchType: c.name.toLowerCase().startsWith(query.toLowerCase())
        ? 'prefix'
        : 'entity',
    }));
  }

  async count(params: ProviderSearchParams): Promise<number> {
    const { organizationId, query } = params;
    return this.prisma.customer.count({
      where: {
        organizationId,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                { code: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    });
  }
}
