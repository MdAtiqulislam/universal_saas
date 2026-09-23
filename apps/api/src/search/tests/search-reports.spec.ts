/* eslint-disable @typescript-eslint/unbound-method */
import { SearchReportsService } from '../services/search-reports.service';
import { SearchAnalyticsRepository } from '../repositories/search-analytics.repository';

describe('SearchReportsService (Milestone M44)', () => {
  let service: SearchReportsService;
  let analyticsRepo: jest.Mocked<SearchAnalyticsRepository>;

  const mockOrgId = 'org-reports-1';

  beforeEach(() => {
    analyticsRepo = {
      getSearchUsageOverview: jest.fn(),
      getVolumeByModule: jest.fn(),
      getZeroResultSearches: jest.fn(),
      getSearchPerformance: jest.fn(),
      getPopularSearchTerms: jest.fn(),
      getSavedViewsUsage: jest.fn(),
      getSearchAlertActivity: jest.fn(),
      getSearchApiUsage: jest.fn(),
      recordSearchEvent: jest.fn(),
    } as any;

    service = new SearchReportsService(analyticsRepo);
  });

  it('1. should generate Search Usage Overview report', async () => {
    analyticsRepo.getSearchUsageOverview.mockResolvedValue({
      totalSearches: 150,
      zeroResultSearches: 15,
      zeroResultRate: 0.1,
      avgDurationMs: 14,
      timeframeDays: 30,
    });

    const report = await service.getUsageOverview(mockOrgId, 30);
    expect(report.totalSearches).toBe(150);
    expect(report.zeroResultRate).toBe(0.1);
    expect(analyticsRepo.getSearchUsageOverview).toHaveBeenCalledWith(
      mockOrgId,
      30,
    );
  });

  it('2. should generate Search Volume by Module report', async () => {
    analyticsRepo.getVolumeByModule.mockResolvedValue([
      { scope: 'CRM', count: 60, percentage: 0.4 },
      { scope: 'SALES', count: 45, percentage: 0.3 },
      { scope: 'INVENTORY', count: 45, percentage: 0.3 },
    ]);

    const report = await service.getVolumeByModule(mockOrgId, 30);
    expect(report).toHaveLength(3);
    expect(report[0].scope).toBe('CRM');
    expect(analyticsRepo.getVolumeByModule).toHaveBeenCalledWith(mockOrgId, 30);
  });

  it('3. should generate Zero-Result Searches report', async () => {
    analyticsRepo.getZeroResultSearches.mockResolvedValue([
      {
        queryHash: 'hash-missing-item',
        scope: 'INVENTORY',
        resourceTypes: ['Item'],
        durationMs: 12,
        occurredAt: new Date(),
      },
    ] as any);

    const report = await service.getZeroResultSearches(mockOrgId, 30);
    expect(report).toHaveLength(1);
    expect(report[0].queryHash).toBe('hash-missing-item');
    expect(analyticsRepo.getZeroResultSearches).toHaveBeenCalledWith(
      mockOrgId,
      30,
    );
  });

  it('4. should generate Search Performance report with latency percentiles', async () => {
    analyticsRepo.getSearchPerformance.mockResolvedValue({
      p50: 8,
      p90: 22,
      p99: 45,
      max: 60,
      avg: 12,
      sampleSize: 200,
    });

    const report = await service.getSearchPerformance(mockOrgId, 30);
    expect(report.p50).toBe(8);
    expect(report.p99).toBe(45);
    expect(analyticsRepo.getSearchPerformance).toHaveBeenCalledWith(
      mockOrgId,
      30,
    );
  });

  it('5. should generate Popular Search Terms report', async () => {
    analyticsRepo.getPopularSearchTerms.mockResolvedValue([
      { queryHash: 'hash-alpha', scope: 'SALES', frequency: 80 },
      { queryHash: 'hash-beta', scope: 'CRM', frequency: 50 },
    ]);

    const report = await service.getPopularSearchTerms(mockOrgId, 30);
    expect(report).toHaveLength(2);
    expect(report[0].frequency).toBe(80);
    expect(analyticsRepo.getPopularSearchTerms).toHaveBeenCalledWith(
      mockOrgId,
      30,
    );
  });

  it('6. should generate Saved Views Usage report', async () => {
    analyticsRepo.getSavedViewsUsage.mockResolvedValue({
      totalViews: 25,
      personalViews: 15,
      sharedViews: 7,
      tenantViews: 3,
      viewsWithAlerts: 4,
    });

    const report = await service.getSavedViewsUsage(mockOrgId);
    expect(report.totalViews).toBe(25);
    expect(report.personalViews).toBe(15);
    expect(analyticsRepo.getSavedViewsUsage).toHaveBeenCalledWith(mockOrgId);
  });

  it('7. should generate Search Alert Activity report', async () => {
    analyticsRepo.getSearchAlertActivity.mockResolvedValue({
      totalEvaluations: 400,
      triggeredCount: 12,
      totalMatchesDiscovered: 48,
      recentExecutions: [],
    });

    const report = await service.getSearchAlertActivity(mockOrgId, 30);
    expect(report.totalEvaluations).toBe(400);
    expect(report.triggeredCount).toBe(12);
    expect(analyticsRepo.getSearchAlertActivity).toHaveBeenCalledWith(
      mockOrgId,
      30,
    );
  });

  it('8. should generate Search API Usage report', async () => {
    analyticsRepo.getSearchApiUsage.mockResolvedValue({
      totalApiRequests: 1200,
      periodDays: 30,
      dailyAverage: 40,
    });

    const report = await service.getSearchApiUsage(mockOrgId, 30);
    expect(report.totalApiRequests).toBe(1200);
    expect(report.dailyAverage).toBe(40);
    expect(analyticsRepo.getSearchApiUsage).toHaveBeenCalledWith(mockOrgId, 30);
  });
});
