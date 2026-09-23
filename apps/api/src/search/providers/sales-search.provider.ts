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
export class SalesSearchProvider implements SearchProvider {
  readonly resourceType = 'sales.order';
  readonly scope = SearchScope.SALES;
  readonly displayName = 'Sales Orders';
  readonly requiredPermission = 'sales.orders.view';
  readonly searchableFields = ['orderNumber', 'status'];
  readonly filterableFields = ['orderNumber', 'status', 'grandTotal'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly filterEngine: FilterAstEngineService,
  ) {}

  async search(params: ProviderSearchParams): Promise<SearchRecord[]> {
    const { organizationId, query, filters, limit, offset } = params;

    const orders = await this.prisma.salesOrder.findMany({
      where: {
        organizationId,
        ...(query
          ? {
              orderNumber: { contains: query, mode: 'insensitive' },
            }
          : {}),
      },
      take: limit * 2,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { name: true } },
        currency: { select: { code: true } },
      },
    });

    const records: SearchRecord[] = orders.map((o) => ({
      id: o.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: `Order ${o.orderNumber}`,
      subtitle: `${o.customer?.name || 'Customer'} • ${o.currency?.code || 'USD'} ${o.grandTotal.toString()}`,
      description: `Sales order status: ${o.status}`,
      status: o.status,
      url: `/sales/orders/${o.id}`,
      metadata: {
        orderNumber: o.orderNumber,
        status: o.status,
        grandTotal: Number(o.grandTotal),
        customerName: o.customer?.name,
        currency: o.currency?.code,
      },
      score: 0,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
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
    const orders = await this.prisma.salesOrder.findMany({
      where: {
        organizationId,
        orderNumber: { contains: query, mode: 'insensitive' },
      },
      take: limit,
      select: { id: true, orderNumber: true, grandTotal: true },
    });

    return orders.map((o) => ({
      id: o.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: o.orderNumber,
      subtitle: String(o.grandTotal),
      url: `/sales/orders/${o.id}`,
      matchType: o.orderNumber.toLowerCase().startsWith(query.toLowerCase())
        ? 'prefix'
        : 'entity',
    }));
  }

  async count(params: ProviderSearchParams): Promise<number> {
    const { organizationId, query } = params;
    return this.prisma.salesOrder.count({
      where: {
        organizationId,
        ...(query
          ? {
              orderNumber: { contains: query, mode: 'insensitive' },
            }
          : {}),
      },
    });
  }
}
