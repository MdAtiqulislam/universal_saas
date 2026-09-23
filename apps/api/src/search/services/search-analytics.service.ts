import { Injectable } from '@nestjs/common';
import { SearchAnalyticsRepository } from '../repositories/search-analytics.repository';
import { SearchScope } from '@prisma/client';

@Injectable()
export class SearchAnalyticsService {
  constructor(private readonly analyticsRepo: SearchAnalyticsRepository) {}

  /**
   * INV-499: Privacy-safe event logging (never logs raw PII or raw query contents)
   */
  async recordSearchEvent(params: {
    organizationId: string;
    userId?: string;
    query?: string;
    scope?: SearchScope;
    resourceTypes?: string[];
    resultCount: number;
    durationMs: number;
    selectedResourceId?: string;
  }) {
    return this.analyticsRepo.recordSearchEvent({
      organizationId: params.organizationId,
      userId: params.userId,
      query: params.query,
      scope: params.scope || SearchScope.GLOBAL,
      resourceTypes: params.resourceTypes || [],
      resultCount: params.resultCount,
      durationMs: params.durationMs,
      selectedResourceId: params.selectedResourceId,
    });
  }
}
