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
export class FinanceSearchProvider implements SearchProvider {
  readonly resourceType = 'finance.invoice';
  readonly scope = SearchScope.FINANCE;
  readonly displayName = 'Invoices & Finance';
  readonly requiredPermission = 'finance.invoices.view';
  readonly searchableFields = ['invoiceNumber', 'status'];
  readonly filterableFields = ['invoiceNumber', 'status', 'grandTotal'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly filterEngine: FilterAstEngineService,
  ) {}

  async search(params: ProviderSearchParams): Promise<SearchRecord[]> {
    const { organizationId, query, filters, limit, offset } = params;

    const invoices = await this.prisma.customerInvoice.findMany({
      where: {
        organizationId,
        ...(query
          ? {
              OR: [{ invoiceNumber: { contains: query, mode: 'insensitive' } }],
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

    const records: SearchRecord[] = invoices.map((inv) => ({
      id: inv.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: `Invoice ${inv.invoiceNumber}`,
      subtitle: `${inv.customer?.name || 'Customer'} • ${inv.currency?.code || 'USD'} ${inv.grandTotal.toString()}`,
      description: `Invoice status: ${inv.status}`,
      status: inv.status,
      url: `/finance/invoices/${inv.id}`,
      metadata: {
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        grandTotal: Number(inv.grandTotal),
        customerName: inv.customer?.name,
        currency: inv.currency?.code,
      },
      score: 0,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
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
    const invoices = await this.prisma.customerInvoice.findMany({
      where: {
        organizationId,
        invoiceNumber: { contains: query, mode: 'insensitive' },
      },
      take: limit,
      select: { id: true, invoiceNumber: true, grandTotal: true },
    });

    return invoices.map((inv) => ({
      id: inv.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: inv.invoiceNumber,
      subtitle: String(inv.grandTotal),
      url: `/finance/invoices/${inv.id}`,
      matchType: inv.invoiceNumber.toLowerCase().startsWith(query.toLowerCase())
        ? 'prefix'
        : 'entity',
    }));
  }

  async count(params: ProviderSearchParams): Promise<number> {
    const { organizationId, query } = params;
    return this.prisma.customerInvoice.count({
      where: {
        organizationId,
        ...(query
          ? { invoiceNumber: { contains: query, mode: 'insensitive' } }
          : {}),
      },
    });
  }
}
