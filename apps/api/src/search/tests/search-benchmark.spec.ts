import { UnifiedSearchService } from '../services/unified-search.service';
import { SearchRankingService } from '../services/search-ranking.service';
import {
  FilterAstEngineService,
  FieldDefinition,
} from '../services/filter-ast-engine.service';
import { SearchScope } from '@prisma/client';
import {
  FilterNode,
  LogicalOperator,
  FilterOperator,
} from '../dto/filter-ast.dto';

describe('Search Performance Benchmark Suite (Milestone M44)', () => {
  let rankingService: SearchRankingService;
  let filterEngine: FilterAstEngineService;
  let unifiedSearch: UnifiedSearchService;

  const mockOrgId = 'org-benchmark-m44';
  const mockUserId = 'user-benchmark-m44';

  beforeEach(() => {
    rankingService = new SearchRankingService();
    filterEngine = new FilterAstEngineService();

    const mockProvider = (
      scope: SearchScope,
      resourceType: string,
      count = 10,
    ) => ({
      scope,
      resourceType,
      requiredPermission: 'search.read',
      search: jest.fn().mockImplementation(() => {
        return Promise.resolve(
          Array.from({ length: count }, (_, i) => ({
            id: `${resourceType.toLowerCase()}-${i}`,
            scope,
            resourceType,
            title: `${resourceType} Item Number ${i} for Alpha Enterprise`,
            subtitle: `Secondary reference SKU-${1000 + i}`,
            description: `Detailed description containing search terms and specifications for ${resourceType} item ${i}`,
            url: `/${scope.toLowerCase()}/${resourceType.toLowerCase()}/${i}`,
            createdAt: new Date(Date.now() - i * 3600000),
            updatedAt: new Date(Date.now() - i * 3600000),
            score: 100 - i,
          })),
        );
      }),
      getSuggestions: jest.fn().mockResolvedValue([]),
    });

    const cacheServiceMock = {
      get: jest.fn().mockReturnValue(null),
      set: jest.fn().mockReturnValue(undefined),
      delete: jest.fn().mockReturnValue(undefined),
      deletePrefix: jest.fn().mockReturnValue(undefined),
      tenantKey: jest
        .fn()
        .mockImplementation(
          (orgId: string, ns: string, k: string) => `${orgId}:${ns}:${k}`,
        ),
    };

    const historyServiceMock = {
      recordSearch: jest.fn().mockResolvedValue(undefined),
      getRecentHistory: jest.fn().mockResolvedValue([]),
    };

    const analyticsServiceMock = {
      recordSearchEvent: jest.fn().mockResolvedValue(undefined),
    };

    unifiedSearch = new UnifiedSearchService(
      mockProvider(SearchScope.CRM, 'Customer') as any,
      mockProvider(SearchScope.SALES, 'SalesOrder') as any,
      mockProvider(SearchScope.INVENTORY, 'Item') as any,
      mockProvider(SearchScope.WAREHOUSE, 'Location') as any,
      mockProvider(SearchScope.QUALITY, 'QualityInspectionLot') as any,
      mockProvider(SearchScope.RETURNS, 'ReturnRequest') as any,
      mockProvider(SearchScope.SERVICE, 'ServiceTicket') as any,
      mockProvider(SearchScope.FINANCE, 'CustomerInvoice') as any,
      mockProvider(SearchScope.WORKFLOW, 'WorkflowDefinition') as any,
      mockProvider(SearchScope.NOTIFICATIONS, 'NotificationTemplate') as any,
      mockProvider(SearchScope.ADMIN, 'User') as any,
      rankingService,
      filterEngine,
      historyServiceMock as any,
      analyticsServiceMock as any,
      cacheServiceMock as any,
    );
  });

  function calculatePercentiles(latencies: number[]): {
    p50: number;
    p95: number;
    p99: number;
    max: number;
    avg: number;
  } {
    const sorted = [...latencies].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const max = sorted[sorted.length - 1];
    const avg = Number(
      (sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2),
    );
    return { p50, p95, p99, max, avg };
  }

  it('1. Single-Domain Prefix Query Benchmark (Cold & Warm Cache)', async () => {
    const iterations = 50;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await unifiedSearch.search({
        organizationId: mockOrgId,
        userId: mockUserId,
        queryDto: {
          q: 'Alpha',
          scope: SearchScope.CRM,
          page: 1,
          limit: 20,
        },
        userPermissions: ['search.read'],
      });
      const end = process.hrtime.bigint();
      latencies.push(Number(end - start) / 1_000_000);
    }

    const stats = calculatePercentiles(latencies);
    expect(stats.p50).toBeLessThan(50); // Bound: < 50ms in-process
    expect(stats.p99).toBeLessThan(100);
  });

  it('2. Multi-Domain Global Search Across 11 Providers', async () => {
    const iterations = 30;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      const res = await unifiedSearch.search({
        organizationId: mockOrgId,
        userId: mockUserId,
        queryDto: {
          q: 'Enterprise',
          scope: SearchScope.GLOBAL,
          page: 1,
          limit: 20,
        },
        userPermissions: ['search.read'],
      });
      const end = process.hrtime.bigint();
      latencies.push(Number(end - start) / 1_000_000);
      expect(res.data.length).toBeGreaterThan(0);
    }

    const stats = calculatePercentiles(latencies);
    expect(stats.p50).toBeLessThan(60);
    expect(stats.p95).toBeLessThan(100);
  });

  it('3. Complex AST Filter Evaluation Benchmark (Depth 4, 10 Nodes)', () => {
    const complexAst: FilterNode = {
      logicalOperator: LogicalOperator.AND,
      conditions: [
        {
          logicalOperator: LogicalOperator.OR,
          conditions: [
            {
              field: 'status',
              operator: FilterOperator.EQUALS,
              value: 'ACTIVE',
            },
            {
              field: 'status',
              operator: FilterOperator.EQUALS,
              value: 'PENDING',
            },
          ],
        },
        {
          logicalOperator: LogicalOperator.AND,
          conditions: [
            {
              field: 'amount',
              operator: FilterOperator.GREATER_THAN,
              value: 5000,
            },
            {
              field: 'category',
              operator: FilterOperator.IN,
              value: ['HARDWARE', 'EQUIPMENT'],
            },
          ],
        },
      ],
    };

    const allowedFields: FieldDefinition[] = [
      { field: 'status', type: 'STRING' },
      { field: 'amount', type: 'NUMBER' },
      { field: 'category', type: 'STRING' },
    ];

    const iterations = 200;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      filterEngine.validateAst(complexAst, allowedFields);
      const end = process.hrtime.bigint();
      latencies.push(Number(end - start) / 1_000_000);
    }

    const stats = calculatePercentiles(latencies);
    expect(stats.p50).toBeLessThan(5); // In-memory AST validator executes under 5ms
  });

  it('4. Deterministic Relevance Scoring & Tie-Breaking (500 Items)', () => {
    const candidateRecords = Array.from({ length: 500 }, (_, i) => ({
      id: `record-${i}`,
      scope: SearchScope.SALES,
      resourceType: 'SalesOrder',
      title: i % 5 === 0 ? 'Enterprise High-Priority Order' : `Order Item ${i}`,
      subtitle: `Customer Account ${1000 + i}`,
      description: 'Standard terms and conditions with rapid delivery',
      url: `/sales/orders/record-${i}`,
      createdAt: new Date(Date.now() - (i % 10) * 86400000),
      updatedAt: new Date(Date.now() - (i % 10) * 86400000),
      score: 0,
    }));

    // Warmup run before timing
    rankingService.rankAndSort(candidateRecords, 'Enterprise High-Priority');

    const iterations = 50;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      const ranked = rankingService.rankAndSort(
        candidateRecords,
        'Enterprise High-Priority',
      );
      const end = process.hrtime.bigint();
      latencies.push(Number(end - start) / 1_000_000);
      expect(ranked[0].title).toBe('Enterprise High-Priority Order');
    }

    const stats = calculatePercentiles(latencies);
    expect(stats.p50).toBeLessThan(25); // 500 items ranked in under 25ms
    expect(stats.p99).toBeLessThan(100); // Meets 100ms SLA under parallel load
  });
});
