import { AnalyticsDefinitionRegistry } from '../registry/analytics-definition.registry';
import { AnalyticsQueryEngineService } from '../services/analytics-query-engine.service';
import { TimeAnalyticsService } from '../services/time-analytics.service';
import { SavedReportsService } from '../services/saved-reports.service';
import { DashboardsService } from '../services/dashboards.service';
import { ReportSchedulingService } from '../services/report-scheduling.service';
import { ReportExecutionService } from '../services/report-execution.service';
import {
  validateFilterAst,
  AST_BOUNDS,
  AstValidationError,
} from '../dto/analytics-query.dto';
import {
  ReportVisibility,
  ReportShareType,
  DashboardVisibility,
  DashboardWidgetType,
  ReportExecutionStatus,
} from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('Authoritative M45 Invariants Verification Matrix (INV-501 -> INV-525)', () => {
  let engine: AnalyticsQueryEngineService;
  let timeService: TimeAnalyticsService;
  let savedReportsService: SavedReportsService;
  let dashboardsService: DashboardsService;
  let schedulingService: ReportSchedulingService;
  let executionService: ReportExecutionService;

  let mockPrisma: any;
  let mockUsageRepo: any;
  let mockReportRepo: any;
  let mockDashboardRepo: any;
  let mockScheduleRepo: any;
  let mockExecutionRepo: any;
  let mockAuditService: any;
  let mockNotificationsService: any;
  let mockCacheService: any;
  let cacheStore: Map<string, any>;

  beforeEach(() => {
    timeService = new TimeAnalyticsService();
    cacheStore = new Map<string, any>();
    mockCacheService = {
      get: jest.fn((key: string) => cacheStore.get(key) ?? null),
      set: jest.fn((key: string, val: any) => {
        cacheStore.set(key, val);
      }),
    };

    mockPrisma = {
      order: { findMany: jest.fn().mockResolvedValue([]) },
      salesOrder: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
      invoice: { findMany: jest.fn().mockResolvedValue([]) },
      savedReport: { findMany: jest.fn().mockResolvedValue([]) },
      dashboard: { findMany: jest.fn().mockResolvedValue([]) },
    };

    mockUsageRepo = {
      recordEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      listEvents: jest.fn().mockResolvedValue({ events: [], total: 0 }),
    };

    mockAuditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    mockNotificationsService = {
      notify: jest.fn().mockResolvedValue({
        notificationId: 'notif-1',
        isDuplicate: false,
        status: 'DELIVERED',
        recipientsCount: 1,
        deliveries: [],
      }),
    };

    mockReportRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      addShare: jest.fn(),
      removeShare: jest.fn(),
      countByOrganization: jest.fn().mockResolvedValue(0),
    };

    mockDashboardRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      addWidget: jest.fn(),
      updateWidget: jest.fn(),
      removeWidget: jest.fn(),
      addShare: jest.fn(),
      removeShare: jest.fn(),
      countByOrganization: jest.fn().mockResolvedValue(0),
    };

    mockScheduleRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      listSchedules: jest.fn(),
      countByOrganization: jest.fn().mockResolvedValue(0),
    };

    mockExecutionRepo = {
      create: jest.fn(),
      update: jest.fn(),
      findByExecutionId: jest.fn(),
      listExecutions: jest.fn(),
    };

    engine = new AnalyticsQueryEngineService(
      mockPrisma,
      timeService,
      mockUsageRepo,
      mockCacheService,
    );

    savedReportsService = new SavedReportsService(
      mockReportRepo,
      engine,
      mockAuditService,
    );

    dashboardsService = new DashboardsService(
      mockDashboardRepo,
      mockReportRepo,
      mockAuditService,
    );

    executionService = new ReportExecutionService(
      mockExecutionRepo,
      savedReportsService,
      engine,
    );

    schedulingService = new ReportSchedulingService(
      mockScheduleRepo,
      savedReportsService,
      executionService,
      undefined,
      mockNotificationsService,
      mockAuditService,
    );
  });

  // INV-501 — Analytics definitions are globally unique by authoritative key
  it('INV-501: Analytics definitions are globally unique by authoritative key', () => {
    const allDefs = AnalyticsDefinitionRegistry.getAll();
    expect(allDefs.length).toBeGreaterThan(0);
    const keys = allDefs.map((d) => d.definitionKey);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
    expect(AnalyticsDefinitionRegistry.has('sales.revenue')).toBe(true);
    expect(
      AnalyticsDefinitionRegistry.get('sales.revenue')?.definitionKey,
    ).toBe('sales.revenue');
  });

  // INV-502 — Tenant-owned analytics configuration belongs to exactly one organization
  it('INV-502: Tenant-owned analytics configuration belongs to exactly one organization', async () => {
    await expect(
      savedReportsService.createReport({
        organizationId: '',
        userId: 'user-1',
        dto: {
          name: 'Sales Rep',
          definitionKey: 'sales.revenue',
          dimensions: ['customerId'],
        },
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      dashboardsService.createDashboard({
        organizationId: '',
        userId: 'user-1',
        dto: { name: 'Executive Dashboard' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // INV-503 — Analytics execution cannot return aggregates or records outside caller tenant
  it('INV-503: Analytics execution cannot return aggregates or records outside caller tenant', async () => {
    mockPrisma.salesOrder.findMany.mockImplementation((args: any) => {
      expect(args.where.organizationId).toBe('org-tenant-1');
      return Promise.resolve([
        {
          customerId: 'cust-1',
          currency: 'USD',
          totalRevenue: 1000,
          organizationId: 'org-tenant-1',
        },
      ]);
    });

    const result = await engine.execute({
      organizationId: 'org-tenant-1',
      userId: 'user-1',
      userPermissions: ['analytics.admin'],
      query: {
        definitionKey: 'sales.revenue',
        dimensions: ['customerId'],
        measures: [{ name: 'totalRevenue', aggregation: 'SUM' }],
        filterAst: { field: 'currency', operator: 'eq', value: 'USD' },
      },
    });

    expect(result.data.length).toBe(1);
    expect(mockPrisma.salesOrder.findMany).toHaveBeenCalled();
  });

  // INV-504 — Analytics execution cannot expose data caller is unauthorized to access
  it('INV-504: Analytics execution cannot expose data caller is unauthorized to access', async () => {
    // Definition sales.revenue requires ['sales.orders.view']
    await expect(
      engine.execute({
        organizationId: 'org-1',
        userId: 'unauthorized-user',
        userPermissions: ['inventory.items.view'],
        query: {
          definitionKey: 'sales.revenue',
          dimensions: ['customerId'],
        },
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  // INV-505 — Dimensions must belong to the selected analytics definition
  it('INV-505: Dimensions must belong to the selected analytics definition', () => {
    expect(() =>
      engine.validateQuery(
        {
          definitionKey: 'sales.revenue',
          dimensions: ['unregistered_dim_key'],
        },
        ['analytics.admin'],
      ),
    ).toThrow(BadRequestException);
  });

  // INV-506 — Measures must belong to the selected analytics definition
  it('INV-506: Measures must belong to the selected analytics definition', () => {
    expect(() =>
      engine.validateQuery(
        {
          definitionKey: 'sales.revenue',
          measures: [{ name: 'unregistered_measure', aggregation: 'COUNT' }],
        },
        ['analytics.admin'],
      ),
    ).toThrow(BadRequestException);
  });

  // INV-507 — Aggregation operators must be valid for the selected measure type
  it('INV-507: Aggregation operators must be valid for the selected measure type', () => {
    // orderCount measure only allows COUNT, not SUM
    expect(() =>
      engine.validateQuery(
        {
          definitionKey: 'sales.revenue',
          measures: [{ name: 'orderCount', aggregation: 'SUM' }],
        },
        ['analytics.admin'],
      ),
    ).toThrow(BadRequestException);
  });

  // INV-508 — Analytics filter fields and operators must come from explicit allowlists
  it('INV-508: Analytics filter fields and operators must come from explicit allowlists', () => {
    const invalidFieldAst = {
      field: 'injected_column',
      operator: 'eq' as const,
      value: 'val',
    };
    expect(() =>
      validateFilterAst(invalidFieldAst, ['status', 'currency']),
    ).toThrow(AstValidationError);

    const invalidOperatorAst = {
      field: 'status',
      operator: 'raw_sql' as any,
      value: 'val',
    };
    expect(() =>
      validateFilterAst(invalidOperatorAst, ['status', 'currency']),
    ).toThrow(AstValidationError);
  });

  // INV-509 — Analytics query complexity is bounded by enforced limits
  it('INV-509: Analytics query complexity is bounded by enforced depth, node, dimension, measure limits', () => {
    expect(AST_BOUNDS.MAX_DEPTH).toBe(5);
    expect(AST_BOUNDS.MAX_NODES).toBe(20);

    // Over dimension limit (max 10)
    expect(() =>
      engine.validateQuery(
        {
          definitionKey: 'sales.revenue',
          dimensions: [
            'd1',
            'd2',
            'd3',
            'd4',
            'd5',
            'd6',
            'd7',
            'd8',
            'd9',
            'd10',
            'd11',
          ],
        },
        ['analytics.admin'],
      ),
    ).toThrow(BadRequestException);
  });

  // INV-510 — Analytics queries cannot execute arbitrary SQL or dynamic code
  it('INV-510: Analytics queries cannot execute arbitrary SQL or dynamic code', () => {
    const maliciousAst = {
      field: '__proto__',
      operator: 'eq' as const,
      value: 'polluted',
    };
    expect(() => validateFilterAst(maliciousAst, ['currency'])).toThrow(
      AstValidationError,
    );

    const protoBlocked = engine.compileAstToPrismaWhere({
      field: '__proto__',
      operator: 'eq',
      value: 'polluted',
    });
    expect(protoBlocked).toBeNull();

    const where = engine.compileAstToPrismaWhere({
      field: 'currency',
      operator: 'eq',
      value: "USD'; DROP TABLE users; --",
    });
    expect(where).toEqual({
      currency: "USD'; DROP TABLE users; --",
    });
  });

  // INV-511 — Analytics result limits are enforced server-side
  it('INV-511: Analytics result limits are enforced server-side', () => {
    expect(() =>
      engine.validateQuery(
        {
          definitionKey: 'sales.revenue',
          limit: 1500,
        },
        ['analytics.admin'],
      ),
    ).toThrow(BadRequestException);
  });

  // INV-512 — Analytics result ordering is deterministic for equivalent input/state
  it('INV-512: Analytics result ordering is deterministic for equivalent input/state', () => {
    const def = AnalyticsDefinitionRegistry.get('sales.revenue')!;
    const records = [
      { customerId: 'cust-b', totalRevenue: 5000 },
      { customerId: 'cust-a', totalRevenue: 5000 },
      { customerId: 'cust-c', totalRevenue: 10000 },
    ];

    const run1 = engine.aggregateRecords({
      records,
      dimensions: ['customerId'],
      measures: [{ name: 'totalRevenue', aggregation: 'SUM' }],
      timeZone: 'UTC',
      definition: def,
    });

    const run2 = engine.aggregateRecords({
      records,
      dimensions: ['customerId'],
      measures: [{ name: 'totalRevenue', aggregation: 'SUM' }],
      timeZone: 'UTC',
      definition: def,
    });

    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });

  // INV-513 — Analytics time boundaries use an explicit timezone policy
  it('INV-513: Analytics time boundaries use an explicit timezone policy', () => {
    expect(timeService.validateTimeZone('UTC')).toBe('UTC');
    expect(timeService.validateTimeZone('America/New_York')).toBe(
      'America/New_York',
    );
    expect(() => timeService.validateTimeZone('Invalid/Unknown_Zone')).toThrow(
      BadRequestException,
    );
  });

  // INV-514 — Personal reports are accessible only by their owner
  it('INV-514: Personal reports are accessible only by their owner', async () => {
    mockReportRepo.findById.mockResolvedValue({
      id: 'rep-private-1',
      organizationId: 'org-1',
      ownerUserId: 'owner-user',
      visibility: ReportVisibility.PRIVATE,
      shares: [],
    });

    await expect(
      savedReportsService.getReport({
        id: 'rep-private-1',
        organizationId: 'org-1',
        userId: 'other-user',
      }),
    ).rejects.toThrow(ForbiddenException);

    const accessible = await savedReportsService.getReport({
      id: 'rep-private-1',
      organizationId: 'org-1',
      userId: 'owner-user',
    });
    expect(accessible.id).toBe('rep-private-1');
  });

  // INV-515 — Shared report principals must belong to the same tenant
  it('INV-515: Shared report principals must belong to the same tenant', async () => {
    mockReportRepo.findById.mockResolvedValue({
      id: 'rep-1',
      organizationId: 'org-1',
      ownerUserId: 'owner-1',
      visibility: ReportVisibility.PRIVATE,
      shares: [],
    });

    await expect(
      savedReportsService.shareReport({
        savedReportId: 'rep-1',
        organizationId: 'org-1',
        userId: 'owner-1',
        shareType: ReportShareType.USER,
        targetId: '   ',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // INV-516 — Report sharing cannot bypass underlying domain permissions
  it('INV-516: Report sharing cannot bypass underlying domain permissions', async () => {
    mockReportRepo.findById.mockResolvedValue({
      id: 'rep-shared-1',
      organizationId: 'org-1',
      ownerUserId: 'owner-1',
      definitionKey: 'sales.revenue',
      visibility: ReportVisibility.ORGANIZATION,
      shares: [],
    });

    // Caller has no sales.orders.view permission
    await expect(
      savedReportsService.getReport({
        id: 'rep-shared-1',
        organizationId: 'org-1',
        userId: 'user-without-sales-perms',
        userPermissions: ['accounting.reports.view'],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  // INV-517 — Saved report configurations are revalidated against current analytics definitions
  it('INV-517: Saved report configurations are revalidated against current analytics definitions', async () => {
    mockReportRepo.findById.mockResolvedValue({
      id: 'rep-legacy-1',
      organizationId: 'org-1',
      ownerUserId: 'owner-1',
      definitionKey: 'sales.revenue',
      dimensions: ['obsolete_dimension_key'],
      measures: [{ name: 'totalRevenue', aggregation: 'SUM' }],
      visibility: ReportVisibility.ORGANIZATION,
      shares: [],
    });

    await expect(
      executionService.executeSavedReport({
        savedReportId: 'rep-legacy-1',
        organizationId: 'org-1',
        userId: 'owner-1',
        userPermissions: ['sales.orders.view'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // INV-518 — Scheduled reports reference valid authorized reports
  it('INV-518: Scheduled reports reference valid authorized reports', async () => {
    mockReportRepo.findById.mockResolvedValue(null);

    await expect(
      schedulingService.createSchedule({
        organizationId: 'org-1',
        userId: 'user-1',
        dto: {
          savedReportId: 'non-existent-report',
          frequency: 'DAILY' as any,
        },
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // INV-519 — Report executions are idempotent where retryable scheduling can duplicate execution
  it('INV-519: Report executions are idempotent where retryable scheduling can duplicate execution', async () => {
    const existingExecution = {
      id: 'exec-existing-1',
      executionId: 'idemp-key-123',
      organizationId: 'org-1',
      savedReportId: 'rep-1',
      status: ReportExecutionStatus.COMPLETED,
      rowCount: 42,
      durationMs: 15,
      snapshotData: [{ totalRevenue: 10000 }],
    };

    mockExecutionRepo.findByExecutionId.mockResolvedValue(existingExecution);

    const res = await executionService.executeSavedReport({
      savedReportId: 'rep-1',
      organizationId: 'org-1',
      userId: 'user-1',
      executionId: 'idemp-key-123',
    });

    expect(res.execution.executionId).toBe('idemp-key-123');
    expect(res.result.cacheHit).toBe(true);
    expect(mockExecutionRepo.create).not.toHaveBeenCalled();
  });

  // INV-520 — Report execution history is tenant/user scoped and cannot expose restricted payloads
  it('INV-520: Report execution history is tenant/user scoped and cannot expose restricted payloads', async () => {
    mockExecutionRepo.listExecutions.mockResolvedValue({
      executions: [
        {
          id: 'exec-1',
          organizationId: 'org-1',
          executedByUserId: 'user-1',
          status: ReportExecutionStatus.COMPLETED,
        },
      ],
      total: 1,
    });

    const history = await executionService.getExecutionHistory({
      organizationId: 'org-1',
      userId: 'user-1',
    });

    expect(mockExecutionRepo.listExecutions).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
      }),
    );
    expect(history.executions.length).toBe(1);
  });

  // INV-521 — Dashboard widgets may reference only valid analytics definitions
  it('INV-521: Dashboard widgets may reference only valid analytics definitions', async () => {
    mockDashboardRepo.findById.mockResolvedValue({
      id: 'dash-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      visibility: DashboardVisibility.PRIVATE,
      shares: [],
      widgets: [],
    });

    await expect(
      dashboardsService.addWidget({
        dashboardId: 'dash-1',
        organizationId: 'org-1',
        userId: 'user-1',
        dto: {
          title: 'Illegal Widget',
          widgetType: DashboardWidgetType.CHART_LINE,
          position: { x: 0, y: 0, w: 6, h: 4 },
          config: { definitionKey: 'invalid.dataset.key' },
        },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // INV-522 — Dashboard sharing cannot bypass underlying analytics or domain permissions
  it('INV-522: Dashboard sharing cannot bypass underlying analytics or domain permissions', async () => {
    mockDashboardRepo.findById.mockResolvedValue({
      id: 'dash-shared-1',
      organizationId: 'org-1',
      ownerUserId: 'owner-1',
      visibility: DashboardVisibility.ORGANIZATION,
      shares: [],
      widgets: [
        {
          id: 'w-1',
          title: 'Sales Widget',
          config: { definitionKey: 'sales.revenue' },
          savedReport: null,
        },
      ],
    });

    // Caller lacks sales.orders.view
    await expect(
      dashboardsService.getDashboard({
        id: 'dash-shared-1',
        organizationId: 'org-1',
        userId: 'user-no-sales',
        userPermissions: ['inventory.items.view'],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  // INV-523 — Analytics cache keys contain all required tenant/security/query dimensions
  it('INV-523: Analytics cache keys contain all required tenant/security/query dimensions', () => {
    const key1 = engine.buildCacheKey({
      organizationId: 'org-1',
      userId: 'user-1',
      userPermissions: ['sales.orders.view'],
      query: { definitionKey: 'sales.revenue', dimensions: ['customerId'] },
    });

    const key2 = engine.buildCacheKey({
      organizationId: 'org-2',
      userId: 'user-1',
      userPermissions: ['sales.orders.view'],
      query: { definitionKey: 'sales.revenue', dimensions: ['customerId'] },
    });

    const key3 = engine.buildCacheKey({
      organizationId: 'org-1',
      userId: 'user-1',
      userPermissions: ['analytics.admin'],
      query: { definitionKey: 'sales.revenue', dimensions: ['customerId'] },
    });

    expect(key1).toContain('analytics:org-1:user-1:');
    expect(key2).toContain('analytics:org-2:user-1:');
    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
  });

  // INV-524 — Analytics notifications use M43 policies and cannot bypass communication controls
  it('INV-524: Analytics notifications use M43 policies and cannot bypass communication controls', async () => {
    mockScheduleRepo.findById.mockResolvedValue({
      id: 'sched-1',
      organizationId: 'org-1',
      savedReportId: 'rep-1',
      isActive: true,
      recipients: ['user-notify@example.com'],
      channels: ['IN_APP'],
      frequency: 'DAILY',
    });

    mockReportRepo.findById.mockResolvedValue({
      id: 'rep-1',
      organizationId: 'org-1',
      ownerUserId: 'owner-1',
      definitionKey: 'sales.revenue',
      dimensions: ['customerId'],
      visibility: ReportVisibility.ORGANIZATION,
      shares: [],
    });

    mockExecutionRepo.create.mockResolvedValue({ id: 'exec-1', rowCount: 10 });
    mockExecutionRepo.update.mockResolvedValue({ id: 'exec-1', rowCount: 10 });
    mockPrisma.order.findMany.mockResolvedValue([]);

    await schedulingService.processScheduledReport('sched-1', 'org-1');

    expect(mockNotificationsService.notify).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        eventType: 'analytics.report.scheduled',
        recipientDestinations: ['user-notify@example.com'],
      }),
    );
  });

  // INV-525 — Administrative operations are permission-protected and auditable
  it('INV-525: Administrative analytics/report/dashboard operations are auditable via AuditService', async () => {
    mockReportRepo.create.mockResolvedValue({
      id: 'rep-created-1',
      name: 'Audited Report',
      definitionKey: 'sales.revenue',
    });

    await savedReportsService.createReport({
      organizationId: 'org-1',
      userId: 'admin-user',
      dto: {
        name: 'Audited Report',
        definitionKey: 'sales.revenue',
        dimensions: ['customerId'],
      },
    });

    expect(mockAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        actorUserId: 'admin-user',
        action: 'analytics.report.create',
      }),
    );

    mockDashboardRepo.create.mockResolvedValue({
      id: 'dash-created-1',
      name: 'Audited Dashboard',
    });

    await dashboardsService.createDashboard({
      organizationId: 'org-1',
      userId: 'admin-user',
      dto: {
        name: 'Audited Dashboard',
      },
    });

    expect(mockAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        actorUserId: 'admin-user',
        action: 'analytics.dashboard.create',
      }),
    );
  });
});
