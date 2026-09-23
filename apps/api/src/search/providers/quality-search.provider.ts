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
export class QualitySearchProvider implements SearchProvider {
  readonly resourceType = 'quality.inspection';
  readonly scope = SearchScope.QUALITY;
  readonly displayName = 'Quality Inspections';
  readonly requiredPermission = 'quality.inspections.view';
  readonly searchableFields = ['lotNumber', 'status'];
  readonly filterableFields = ['lotNumber', 'status'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly filterEngine: FilterAstEngineService,
  ) {}

  async search(params: ProviderSearchParams): Promise<SearchRecord[]> {
    const { organizationId, query, filters, limit, offset } = params;

    const lots = await this.prisma.qualityInspectionLot.findMany({
      where: {
        organizationId,
        ...(query
          ? {
              lotNumber: { contains: query, mode: 'insensitive' },
            }
          : {}),
      },
      take: limit * 2,
      skip: offset,
      orderBy: { id: 'desc' },
    });

    const records: SearchRecord[] = lots.map((l) => ({
      id: l.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: `Inspection Lot ${l.lotNumber}`,
      subtitle: `Status: ${l.status} • Type: ${l.inspectionType}`,
      description: `Quality inspection lot`,
      status: l.status,
      url: `/quality/inspections/${l.id}`,
      metadata: {
        lotNumber: l.lotNumber,
        status: l.status,
        inspectionType: l.inspectionType,
      },
      score: 0,
      createdAt: l.decidedAt || new Date(),
      updatedAt: l.decidedAt || undefined,
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
    const lots = await this.prisma.qualityInspectionLot.findMany({
      where: {
        organizationId,
        lotNumber: { contains: query, mode: 'insensitive' },
      },
      take: limit,
      select: { id: true, lotNumber: true, status: true },
    });

    return lots.map((l) => ({
      id: l.id,
      resourceType: this.resourceType,
      scope: this.scope,
      title: l.lotNumber,
      subtitle: l.status,
      url: `/quality/inspections/${l.id}`,
      matchType: l.lotNumber.toLowerCase().startsWith(query.toLowerCase())
        ? 'prefix'
        : 'entity',
    }));
  }

  async count(params: ProviderSearchParams): Promise<number> {
    const { organizationId, query } = params;
    return this.prisma.qualityInspectionLot.count({
      where: {
        organizationId,
        ...(query
          ? {
              lotNumber: { contains: query, mode: 'insensitive' },
            }
          : {}),
      },
    });
  }
}
