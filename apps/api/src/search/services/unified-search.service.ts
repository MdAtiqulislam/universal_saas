import { Injectable, ForbiddenException } from '@nestjs/common';
import { SearchScope } from '@prisma/client';
import {
  SearchProvider,
  SearchRecord,
  SuggestionItem,
} from '../providers/search-provider.interface';
import { FilterNode } from '../dto/filter-ast.dto';
import { CustomerSearchProvider } from '../providers/customer-search.provider';
import { SalesSearchProvider } from '../providers/sales-search.provider';
import { InventorySearchProvider } from '../providers/inventory-search.provider';
import { WarehouseSearchProvider } from '../providers/warehouse-search.provider';
import { QualitySearchProvider } from '../providers/quality-search.provider';
import { ReturnsSearchProvider } from '../providers/returns-search.provider';
import { ServiceSearchProvider } from '../providers/service-search.provider';
import { FinanceSearchProvider } from '../providers/finance-search.provider';
import { WorkflowSearchProvider } from '../providers/workflow-search.provider';
import { NotificationSearchProvider } from '../providers/notification-search.provider';
import { UserSearchProvider } from '../providers/user-search.provider';
import { SearchRankingService } from './search-ranking.service';
import { FilterAstEngineService } from './filter-ast-engine.service';
import { SearchHistoryService } from './search-history.service';
import { SearchAnalyticsService } from './search-analytics.service';
import { CacheService } from '../../common/cache/cache.service';
import { SearchQueryDto, SearchSuggestionsDto } from '../dto/search-query.dto';
import {
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
} from '../../common/pagination/pagination.dto';
import { boundedParallel } from '../../common/concurrency/concurrency.util';
import * as crypto from 'crypto';

export interface UnifiedSearchResult {
  data: SearchRecord[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    scope: SearchScope;
    executionTimeMs: number;
    matchedResourceTypes: string[];
  };
}

@Injectable()
export class UnifiedSearchService {
  private readonly providers: Map<string, SearchProvider> = new Map();

  constructor(
    private readonly customerProvider: CustomerSearchProvider,
    private readonly salesProvider: SalesSearchProvider,
    private readonly inventoryProvider: InventorySearchProvider,
    private readonly warehouseProvider: WarehouseSearchProvider,
    private readonly qualityProvider: QualitySearchProvider,
    private readonly returnsProvider: ReturnsSearchProvider,
    private readonly serviceProvider: ServiceSearchProvider,
    private readonly financeProvider: FinanceSearchProvider,
    private readonly workflowProvider: WorkflowSearchProvider,
    private readonly notificationProvider: NotificationSearchProvider,
    private readonly userProvider: UserSearchProvider,
    private readonly rankingService: SearchRankingService,
    private readonly filterEngine: FilterAstEngineService,
    private readonly historyService: SearchHistoryService,
    private readonly analyticsService: SearchAnalyticsService,
    private readonly cacheService: CacheService,
  ) {
    this.registerProvider(this.customerProvider);
    this.registerProvider(this.salesProvider);
    this.registerProvider(this.inventoryProvider);
    this.registerProvider(this.warehouseProvider);
    this.registerProvider(this.qualityProvider);
    this.registerProvider(this.returnsProvider);
    this.registerProvider(this.serviceProvider);
    this.registerProvider(this.financeProvider);
    this.registerProvider(this.workflowProvider);
    this.registerProvider(this.notificationProvider);
    this.registerProvider(this.userProvider);
  }

  registerProvider(provider: SearchProvider): void {
    this.providers.set(provider.resourceType, provider);
  }

  getProvider(resourceType: string): SearchProvider | undefined {
    return this.providers.get(resourceType);
  }

  getAllProviders(): SearchProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Resolves providers that caller is authorized to access and match target scope/resourceTypes
   */
  resolveAuthorizedProviders(params: {
    scope?: SearchScope;
    resourceTypes?: string[];
    userPermissions?: string[];
  }): SearchProvider[] {
    const {
      scope = SearchScope.GLOBAL,
      resourceTypes,
      userPermissions = [],
    } = params;
    const isSuperAdmin =
      userPermissions.includes('search.admin') || userPermissions.includes('*');

    return this.getAllProviders().filter((provider) => {
      // Filter by Scope
      if (scope !== SearchScope.GLOBAL && provider.scope !== scope) {
        return false;
      }
      // Filter by specific resourceTypes if supplied
      if (
        resourceTypes &&
        resourceTypes.length > 0 &&
        !resourceTypes.includes(provider.resourceType)
      ) {
        return false;
      }
      // INV-479: Verify user has permission to search this domain
      if (
        !isSuperAdmin &&
        !userPermissions.includes(provider.requiredPermission)
      ) {
        return false;
      }
      return true;
    });
  }

  /**
   * Main Unified Search Execution
   * Enforces INV-478 (tenant isolation), INV-479 (permission-aware), INV-484 (bounded pagination),
   * INV-485 (deterministic ranking), INV-498 (tenant-isolated cache)
   */
  async search(params: {
    organizationId: string;
    userId?: string;
    userPermissions?: string[];
    queryDto: SearchQueryDto;
  }): Promise<UnifiedSearchResult> {
    const startTime = Date.now();
    const { organizationId, userId, userPermissions = [], queryDto } = params;

    if (!organizationId) {
      throw new ForbiddenException(
        'Tenant organization ID is strictly required (INV-478)',
      );
    }

    // INV-484: Enforce server-side limit bound
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, queryDto.limit || DEFAULT_PAGE_SIZE),
    );
    const page = Math.max(1, queryDto.page || 1);
    const offset = (page - 1) * limit;
    const scope = queryDto.scope || SearchScope.GLOBAL;

    // Validate filters AST if present
    if (queryDto.filters) {
      this.filterEngine.validateAst(queryDto.filters as any);
    }

    // INV-479: Resolve authorized providers
    const authorizedProviders = this.resolveAuthorizedProviders({
      scope,
      resourceTypes: queryDto.resourceTypes,
      userPermissions,
    });

    if (authorizedProviders.length === 0) {
      return {
        data: [],
        meta: {
          total: 0,
          page,
          limit,
          totalPages: 0,
          scope,
          executionTimeMs: Date.now() - startTime,
          matchedResourceTypes: [],
        },
      };
    }

    // INV-498: Cache Key with tenant, permissions hash, and query parameters
    const permissionsHash = crypto
      .createHash('sha256')
      .update([...userPermissions].sort().join(','))
      .digest('hex')
      .substring(0, 16);

    const cachePayload = JSON.stringify({
      q: queryDto.q || '',
      scope,
      resourceTypes: queryDto.resourceTypes || [],
      filters: queryDto.filters || {},
      page,
      limit,
    });

    const cacheKeyHash = crypto
      .createHash('sha256')
      .update(cachePayload)
      .digest('hex');

    const cacheKey = this.cacheService.tenantKey(
      organizationId,
      'search',
      `${permissionsHash}:${cacheKeyHash}`,
    );

    const cachedResult = this.cacheService.get<UnifiedSearchResult>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // Execute queries across authorized providers with bounded concurrency
    const providerResults = await boundedParallel<
      SearchProvider,
      SearchRecord[]
    >(authorizedProviders, 5, async (provider) => {
      try {
        return await provider.search({
          organizationId,
          query: queryDto.q,
          filters: queryDto.filters as unknown as FilterNode,
          limit: limit * 2,
          offset: 0,
          sortBy: queryDto.sortBy,
          sortOrder: queryDto.sortOrder,
        });
      } catch {
        return [];
      }
    });
    const allRecords: SearchRecord[] = providerResults.flat();

    // INV-485: Deterministic ranking and sorting
    const rankedRecords = this.rankingService.rankAndSort(
      allRecords,
      queryDto.q,
    );

    // Apply pagination slice
    const total = rankedRecords.length;
    const paginatedRecords = rankedRecords.slice(offset, offset + limit);
    const totalPages = Math.ceil(total / limit);
    const executionTimeMs = Date.now() - startTime;

    const result: UnifiedSearchResult = {
      data: paginatedRecords,
      meta: {
        total,
        page,
        limit,
        totalPages,
        scope,
        executionTimeMs,
        matchedResourceTypes: Array.from(
          new Set(paginatedRecords.map((r) => r.resourceType)),
        ),
      },
    };

    // Cache result with short TTL (30s)
    this.cacheService.set(cacheKey, result, 30);

    // Record history asynchronously if requested
    if (userId && queryDto.recordHistory && queryDto.q) {
      void this.historyService.recordSearch({
        organizationId,
        userId,
        queryText: queryDto.q,
        scope,
        resultCount: total,
      });
    }

    // Record analytics event asynchronously (INV-499)
    void this.analyticsService.recordSearchEvent({
      organizationId,
      userId,
      query: queryDto.q,
      scope,
      resourceTypes: result.meta.matchedResourceTypes,
      resultCount: total,
      durationMs: executionTimeMs,
    });

    return result;
  }

  /**
   * Search suggestions across authorized domain providers
   */
  async getSuggestions(params: {
    organizationId: string;
    userId?: string;
    userPermissions?: string[];
    dto: SearchSuggestionsDto;
  }): Promise<SuggestionItem[]> {
    const { organizationId, userPermissions = [], dto } = params;

    const authorizedProviders = this.resolveAuthorizedProviders({
      scope: dto.scope || SearchScope.GLOBAL,
      userPermissions,
    });

    const limit = Math.min(20, Math.max(1, dto.limit || 10));

    const results = await boundedParallel<SearchProvider, SuggestionItem[]>(
      authorizedProviders,
      5,
      async (provider) => {
        try {
          return await provider.suggest({
            organizationId,
            query: dto.q,
            limit: 5,
          });
        } catch {
          return [];
        }
      },
    );
    return results.flat().slice(0, limit);
  }
}
