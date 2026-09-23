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
export class ServiceSearchProvider implements SearchProvider {
  readonly resourceType = 'service.ticket';
  readonly scope = SearchScope.SERVICE;
  readonly displayName = 'Service Tickets';
  readonly requiredPermission = 'service.tickets.view';
  readonly searchableFields = ['ticketNumber', 'subject'];
  readonly filterableFields = ['ticketNumber', 'subject', 'status', 'priority'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly filterEngine: FilterAstEngineService,
  ) {}

  async search(params: ProviderSearchParams): Promise<SearchRecord[]> {
    const { organizationId, query, filters, limit, offset } = params;

    const tickets = await this.prisma.serviceTicket.findMany({
      where: {
        organizationId,
        ...(query
          ? {
              OR: [
                { ticketNumber: { contains: query, mode: 'insensitive' } },
                { subject: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: limit * 2,
      skip: offset,
      orderBy: { openedAt: 'desc' },
    });

    const records: SearchRecord[] = tickets.map((t) => ({
      id: t.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: `Ticket ${t.ticketNumber}: ${t.subject}`,
      subtitle: `Status: ${t.status} • Priority: ${t.priority}`,
      description: `Service management ticket`,
      status: t.status,
      url: `/service/tickets/${t.id}`,
      metadata: {
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
      },
      score: 0,
      createdAt: t.openedAt,
      updatedAt: t.resolvedAt || undefined,
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
    const tickets = await this.prisma.serviceTicket.findMany({
      where: {
        organizationId,
        OR: [
          { ticketNumber: { contains: query, mode: 'insensitive' } },
          { subject: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      select: { id: true, ticketNumber: true, subject: true, status: true },
    });

    return tickets.map((t) => ({
      id: t.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: `${t.ticketNumber}: ${t.subject}`,
      subtitle: t.status,
      url: `/service/tickets/${t.id}`,
      matchType: t.ticketNumber.toLowerCase().startsWith(query.toLowerCase())
        ? 'prefix'
        : 'entity',
    }));
  }

  async count(params: ProviderSearchParams): Promise<number> {
    const { organizationId, query } = params;
    return this.prisma.serviceTicket.count({
      where: {
        organizationId,
        ...(query
          ? {
              OR: [
                { ticketNumber: { contains: query, mode: 'insensitive' } },
                { subject: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    });
  }
}
