import { AnalyticsDefinitionRegistry } from '../registry/analytics-definition.registry';
import { AnalyticsQueryEngineService } from '../services/analytics-query-engine.service';
import { TimeAnalyticsService } from '../services/time-analytics.service';
import { validateFilterAst } from '../dto/analytics-query.dto';

describe('Analytics Benchmark Suite (Phase 4: 5 Required Workloads)', () => {
  let engine: AnalyticsQueryEngineService;
  let timeService: TimeAnalyticsService;
  let mockPrisma: any;
  let mockUsageRepo: any;
  let cacheStore: Map<string, any>;
  let mockCache: any;

  beforeEach(() => {
    timeService = new TimeAnalyticsService();
    cacheStore = new Map<string, any>();
    mockCache = {
      get: jest
        .fn()
        .mockImplementation((key: string) =>
          Promise.resolve(cacheStore.get(key) ?? null),
        ),
      set: jest.fn().mockImplementation((key: string, val: any) => {
        cacheStore.set(key, val);
        return Promise.resolve();
      }),
    };
    mockUsageRepo = { recordEvent: jest.fn().mockResolvedValue({}) };
    mockPrisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    engine = new AnalyticsQueryEngineService(
      mockPrisma,
      timeService,
      mockUsageRepo,
      mockCache,
    );
  });

  // Workload 1: Single-definition aggregation
  it('Workload 1: Single-definition aggregation across 1,000 domain records (<= 50ms)', () => {
    const def = AnalyticsDefinitionRegistry.get('sales.revenue')!;
    const records = Array.from({ length: 1000 }, (_, i) => ({
      customerId: `cust-${i % 10}`,
      currency: 'USD',
      status: 'COMPLETED',
      totalRevenue: 10000 + i * 25,
      createdAt: new Date(Date.now() - i * 3600000),
    }));

    const start = performance.now();
    const aggregated = engine.aggregateRecords({
      records,
      dimensions: ['customerId'],
      measures: [{ name: 'totalRevenue', aggregation: 'SUM' }],
      timeZone: 'UTC',
      definition: def,
    });
    const elapsed = performance.now() - start;

    expect(aggregated.length).toBe(10);
    expect(elapsed).toBeLessThan(50);
    console.log(
      `[Benchmark 1] Single-definition aggregation: ${elapsed.toFixed(3)}ms for 1,000 records`,
    );
  });

  // Workload 2: Multi-dimension aggregation
  it('Workload 2: Multi-dimension aggregation across 1,000 domain records (<= 50ms)', () => {
    const def = AnalyticsDefinitionRegistry.get('sales.revenue')!;
    const records = Array.from({ length: 1000 }, (_, i) => ({
      customerId: `cust-${i % 25}`,
      currency: i % 2 === 0 ? 'USD' : 'EUR',
      status: i % 3 === 0 ? 'COMPLETED' : 'PENDING',
      totalRevenue: 5000 + i * 10,
      createdAt: new Date(Date.now() - i * 3600000),
    }));

    const start = performance.now();
    const aggregated = engine.aggregateRecords({
      records,
      dimensions: ['customerId', 'currency', 'status'],
      measures: [
        { name: 'orderCount', aggregation: 'COUNT' },
        { name: 'totalRevenue', aggregation: 'SUM' },
        { name: 'totalRevenue', aggregation: 'AVG' },
      ],
      timeZone: 'UTC',
      definition: def,
    });
    const elapsed = performance.now() - start;

    expect(aggregated.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(50);
    console.log(
      `[Benchmark 2] Multi-dimension aggregation: ${elapsed.toFixed(3)}ms for 1,000 records`,
    );
  });

  // Workload 3: Bounded filter AST
  it('Workload 3: Bounded filter AST validation across 1,000 iterations (avg <= 1ms)', () => {
    const ast = {
      and: [
        { field: 'currency', operator: 'eq' as const, value: 'USD' },
        {
          field: 'status',
          operator: 'in' as const,
          value: ['COMPLETED', 'SHIPPED', 'DELIVERED'],
        },
        {
          or: [
            { field: 'totalRevenue', operator: 'gte' as const, value: 1000 },
            { field: 'customerId', operator: 'neq' as const, value: 'banned' },
          ],
        },
      ],
    };
    const allowed = ['currency', 'status', 'totalRevenue', 'customerId'];

    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      validateFilterAst(ast, allowed);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    expect(avgMs).toBeLessThan(1);
    console.log(
      `[Benchmark 3] Bounded filter AST: ${avgMs.toFixed(4)}ms avg per iteration (${iterations} iterations)`,
    );
  });

  // Workload 4: Dashboard multi-widget execution
  it('Workload 4: Dashboard multi-widget execution (6 concurrent widgets <= 100ms)', async () => {
    const records = Array.from({ length: 50 }, (_, i) => ({
      organizationId: 'org-bench-1',
      customerId: `cust-${i % 5}`,
      currency: 'USD',
      status: 'COMPLETED',
      totalRevenue: 25000,
      quantityOnHand: 150,
      createdAt: new Date(),
    }));

    mockPrisma.order.findMany.mockResolvedValue(records);
    mockPrisma.inventoryItem.findMany.mockResolvedValue(records);
    mockPrisma.invoice.findMany.mockResolvedValue(records);

    const widgetQueries = [
      {
        definitionKey: 'sales.revenue',
        dimensions: ['customerId'],
        measures: [{ name: 'totalRevenue', aggregation: 'SUM' as const }],
      },
      {
        definitionKey: 'sales.revenue',
        dimensions: ['currency'],
        measures: [{ name: 'orderCount', aggregation: 'COUNT' as const }],
      },
      {
        definitionKey: 'inventory.stock',
        dimensions: ['sku'],
        measures: [{ name: 'quantityOnHand', aggregation: 'SUM' as const }],
      },
      {
        definitionKey: 'inventory.stock',
        dimensions: ['warehouseId'],
        measures: [{ name: 'itemCount', aggregation: 'COUNT' as const }],
      },
      {
        definitionKey: 'finance.invoice',
        dimensions: ['status'],
        measures: [{ name: 'totalAmount', aggregation: 'SUM' as const }],
      },
      {
        definitionKey: 'finance.invoice',
        dimensions: ['currency'],
        measures: [{ name: 'invoiceCount', aggregation: 'COUNT' as const }],
      },
    ];

    const start = performance.now();
    const results = await Promise.all(
      widgetQueries.map((q) =>
        engine.execute({
          organizationId: 'org-bench-1',
          userId: 'user-bench-1',
          userPermissions: ['analytics.admin'],
          query: q,
        }),
      ),
    );
    const elapsed = performance.now() - start;

    expect(results.length).toBe(6);
    expect(elapsed).toBeLessThan(100);
    console.log(
      `[Benchmark 4] Dashboard multi-widget execution: ${elapsed.toFixed(3)}ms for 6 widgets`,
    );
  });

  // Workload 5: Repeated cached analytics query
  it('Workload 5: Repeated cached analytics query (cold miss -> 100 cache hits avg <= 1ms)', async () => {
    const records = Array.from({ length: 20 }, (_, i) => ({
      organizationId: 'org-bench-1',
      customerId: `cust-${i}`,
      currency: 'USD',
      totalRevenue: 12000,
      createdAt: new Date(),
    }));
    mockPrisma.order.findMany.mockResolvedValue(records);

    const queryParams = {
      organizationId: 'org-bench-1',
      userId: 'user-bench-1',
      userPermissions: ['analytics.admin'],
      query: {
        definitionKey: 'sales.revenue',
        dimensions: ['customerId'],
        measures: [{ name: 'totalRevenue', aggregation: 'SUM' as const }],
      },
    };

    // Cold miss
    const coldStart = performance.now();
    const firstResult = await engine.execute(queryParams);
    const coldElapsed = performance.now() - coldStart;
    expect(firstResult.cacheHit).toBe(false);

    // Warm cache hits
    const iterations = 100;
    const warmStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const hitResult = await engine.execute(queryParams);
      expect(hitResult.cacheHit).toBe(true);
    }
    const warmElapsed = performance.now() - warmStart;
    const avgWarmMs = warmElapsed / iterations;

    expect(avgWarmMs).toBeLessThan(1);
    console.log(
      `[Benchmark 5] Repeated cached analytics query: cold miss ${coldElapsed.toFixed(3)}ms, warm avg ${avgWarmMs.toFixed(4)}ms over ${iterations} hits`,
    );
  });
});
