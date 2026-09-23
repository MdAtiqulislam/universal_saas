import { AnalyticsReportsService } from '../services/analytics-reports.service';

describe('AnalyticsReportsService (8 Operational Telemetry Reports)', () => {
  let reportsService: AnalyticsReportsService;
  let mockPrisma: any;
  let mockUsageRepo: any;
  let mockSavedReportsRepo: any;
  let mockDashboardsRepo: any;
  let mockSchedulesRepo: any;

  beforeEach(() => {
    mockPrisma = {
      reportExecution: {
        findMany: jest.fn().mockResolvedValue([
          { status: 'COMPLETED', durationMs: 45, executedAt: new Date() },
          { status: 'COMPLETED', durationMs: 55, executedAt: new Date() },
          { status: 'FAILED', durationMs: 10, executedAt: new Date() },
        ]),
      },
      savedReport: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'r1',
            name: 'Revenue',
            definitionKey: 'sales.revenue',
            updatedAt: new Date(),
          },
          {
            id: 'r2',
            name: 'Stock',
            definitionKey: 'inventory.stock',
            updatedAt: new Date(),
          },
        ]),
      },
      dashboard: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'd1', name: 'Exec Dashboard', updatedAt: new Date() },
          ]),
      },
      analyticsUsageEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            eventType: 'analytics.query.executed',
            durationMs: 250,
            rowCount: 100,
          },
          {
            eventType: 'analytics.export.executed',
            durationMs: 80,
            rowCount: 500,
          },
        ]),
      },
      reportSchedule: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 's1',
            frequency: 'DAILY',
            isActive: true,
            savedReport: { name: 'Daily Rev' },
          },
        ]),
      },
      reportShare: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'sh1', savedReportId: 'r1', createdAt: new Date() },
          ]),
      },
      dashboardShare: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'dsh1', dashboardId: 'd1', createdAt: new Date() },
          ]),
      },
    };

    mockUsageRepo = {
      listEvents: jest.fn().mockResolvedValue({
        events: [{ eventType: 'analytics.query.executed' }],
        total: 1,
      }),
    };

    mockSavedReportsRepo = {
      countByOrganization: jest.fn().mockResolvedValue(5),
    };

    mockDashboardsRepo = {
      countByOrganization: jest.fn().mockResolvedValue(2),
    };

    mockSchedulesRepo = {
      countByOrganization: jest.fn().mockResolvedValue(3),
    };

    reportsService = new AnalyticsReportsService(
      mockPrisma,
      mockUsageRepo,
      mockSavedReportsRepo,
      mockDashboardsRepo,
      mockSchedulesRepo,
    );
  });

  it('Report 1: returns Analytics Usage Overview', async () => {
    const report = await reportsService.getUsageOverview('org-1');
    expect(report.organizationId).toBe('org-1');
    expect(report.totalReports).toBe(5);
    expect(report.totalDashboards).toBe(2);
    expect(report.totalSchedules).toBe(3);
  });

  it('Report 2: returns Report Execution Performance with success rate and average latency', async () => {
    const report = await reportsService.getExecutionPerformance('org-1');
    expect(report.totalExecutions).toBe(3);
    expect(report.completedCount).toBe(2);
    expect(report.failedCount).toBe(1);
    expect(report.avgDurationMs).toBe(50); // (45 + 55) / 2
    expect(report.successRate).toBeCloseTo(66.67, 1);
  });

  it('Report 3: returns Popular Reports & Dashboards', async () => {
    const report = await reportsService.getPopularResources('org-1');
    expect(report.topReports.length).toBe(2);
    expect(report.topDashboards.length).toBe(1);
  });

  it('Report 4: returns Slow Queries exceeding latency threshold', async () => {
    const report = await reportsService.getSlowQueries('org-1');
    expect(report.thresholdMs).toBe(200);
    expect(mockPrisma.analyticsUsageEvent.findMany).toHaveBeenCalled();
  });

  it('Report 5: returns Export Volume & Delivery statistics', async () => {
    const report = await reportsService.getExportVolume('org-1');
    expect(report.totalExports).toBe(2);
    expect(report.totalRowsExported).toBe(600); // 100 + 500
  });

  it('Report 6: returns Schedule Execution Reliability', async () => {
    const report = await reportsService.getScheduleReliability('org-1');
    expect(report.activeSchedulesCount).toBe(1);
    expect(report.inactiveSchedulesCount).toBe(0);
    expect(report.schedules[0].reportName).toBe('Daily Rev');
  });

  it('Report 7: returns Domain Dataset Utilization', async () => {
    const report = await reportsService.getDatasetUtilization('org-1');
    expect(report.totalReportsSurveyed).toBe(2);
    expect(report.datasetCounts['sales.revenue']).toBe(1);
    expect(report.datasetCounts['inventory.stock']).toBe(1);
  });

  it('Report 8: returns Access & Sharing Security Audit', async () => {
    const report = await reportsService.getSecurityAudit('org-1');
    expect(report.totalReportShares).toBe(1);
    expect(report.totalDashboardShares).toBe(1);
  });
});
