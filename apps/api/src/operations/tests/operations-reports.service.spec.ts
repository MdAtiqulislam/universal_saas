import { Test, TestingModule } from '@nestjs/testing';
import { OperationsReportsService } from '../reports/operations-reports.service';
import { MetricsService } from '../metrics/metrics.service';
import { IncidentService } from '../incidents/incident.service';
import { SloService } from '../slo/slo.service';
import { JobService } from '../../common/jobs/job.service';
import { SecurityEventsService } from '../../security/events/security-events.service';
import { SloStatus } from '@prisma/client';

describe('M38: Operations Reports Service', () => {
  let reportsService: OperationsReportsService;
  let metricsMock: any;
  let incidentMock: any;
  let sloMock: any;
  let jobsMock: any;
  let securityMock: any;

  beforeEach(async () => {
    metricsMock = {
      getHistogramPercentiles: jest
        .fn()
        .mockReturnValue({ p50: 45, p95: 120, p99: 250 }),
      getCounterValue: jest
        .fn()
        .mockImplementation((k: string) =>
          k === 'cache.hits' ? 85 : k === 'cache.misses' ? 15 : 0,
        ),
    };
    incidentMock = {
      listIncidents: jest.fn().mockResolvedValue([
        { id: '1', status: 'OPEN' },
        { id: '2', status: 'RESOLVED' },
      ]),
    };
    sloMock = {
      listSlos: jest.fn().mockResolvedValue([
        { id: '1', status: SloStatus.HEALTHY },
        { id: '2', status: SloStatus.BREACHED },
      ]),
    };
    jobsMock = {};
    securityMock = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperationsReportsService,
        { provide: MetricsService, useValue: metricsMock },
        { provide: IncidentService, useValue: incidentMock },
        { provide: SloService, useValue: sloMock },
        { provide: JobService, useValue: jobsMock },
        { provide: SecurityEventsService, useValue: securityMock },
      ],
    }).compile();

    reportsService = module.get<OperationsReportsService>(
      OperationsReportsService,
    );
  });

  it('1. should return platform availability report', async () => {
    const report = await reportsService.getPlatformAvailabilityReport();
    expect(report.uptime).toBeGreaterThanOrEqual(99.0);
  });

  it('2. should return API performance percentiles report', async () => {
    const report = await reportsService.getApiPerformanceReport();
    expect(report.averageLatencyMs).toBe(45);
    expect(report.p95LatencyMs).toBe(120);
  });

  it('3. should return incident summary with open and resolved counts', async () => {
    const report = await reportsService.getIncidentSummary('org-1');
    expect(report.openIncidents).toBe(1);
    expect(report.resolvedLast7Days).toBe(1);
  });

  it('4. should return SLO compliance summary', async () => {
    const report = await reportsService.getSloComplianceReport('org-1');
    expect(report.healthySlos).toBe(1);
    expect(report.breachingSlos).toBe(1);
  });

  it('5. should return cache performance metrics', async () => {
    const report = await reportsService.getCachePerformanceReport();
    expect(report.hitRate).toBe(85.0);
  });
});
