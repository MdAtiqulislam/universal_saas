import { Test, TestingModule } from '@nestjs/testing';
import { ApiUsageService } from '../services/api-usage.service';
import { ApiUsageRepository } from '../repositories/api-usage.repository';
import { MetricsService } from '../../operations/metrics/metrics.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';

describe('ApiUsageService (M41)', () => {
  let service: ApiUsageService;
  let repo: {
    createUsageRecord: jest.Mock;
    findUsageRecords: jest.Mock;
    getAggregatedMetrics: jest.Mock;
    getEndpointMetrics: jest.Mock;
    getStatusCodeBreakdown: jest.Mock;
    getRecentErrors: jest.Mock;
  };
  let metricsService: {
    incrementCounter: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      createUsageRecord: jest.fn(),
      findUsageRecords: jest.fn(),
      getAggregatedMetrics: jest.fn(),
      getEndpointMetrics: jest.fn(),
      getStatusCodeBreakdown: jest.fn(),
      getRecentErrors: jest.fn(),
    };
    metricsService = {
      incrementCounter: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiUsageService,
        { provide: ApiUsageRepository, useValue: repo },
        { provide: MetricsService, useValue: metricsService },
        {
          provide: StructuredLoggingService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ApiUsageService>(ApiUsageService);
  });

  it('should hash IP addresses with SHA-256 and return null for empty input', () => {
    expect(service.hashIp(null)).toBeNull();
    expect(service.hashIp(undefined)).toBeNull();
    const hash = service.hashIp('192.168.1.1');
    expect(hash).toHaveLength(64);
  });

  it('should compute correct response class for HTTP status codes', () => {
    expect(service.computeResponseClass(200)).toBe('2xx');
    expect(service.computeResponseClass(201)).toBe('2xx');
    expect(service.computeResponseClass(301)).toBe('3xx');
    expect(service.computeResponseClass(404)).toBe('4xx');
    expect(service.computeResponseClass(500)).toBe('5xx');
  });

  it('should normalize route paths by stripping query parameters and trailing slashes', () => {
    expect(
      service.normalizeRoute('/api/v1/crm/customers?page=1&limit=20'),
    ).toBe('/api/v1/crm/customers');
    expect(service.normalizeRoute('/api/v1/orders/')).toBe('/api/v1/orders');
    expect(service.normalizeRoute('')).toBe('/');
  });

  it('should record usage, normalize route, compute SHA-256 IP hash, and increment metrics', async () => {
    repo.createUsageRecord.mockResolvedValue({ id: 'rec-1' });

    await service.recordUsage({
      organizationId: 'org-1',
      apiKeyId: 'key-1',
      route: '/api/v1/crm/leads?page=1&sort=desc',
      method: 'GET',
      statusCode: 200,
      durationMs: 42,
      clientIp: '192.168.1.1',
      userAgent: 'Mozilla/5.0 TestAgent',
      requestId: 'req-1',
    });

    expect(repo.createUsageRecord).toHaveBeenCalledTimes(1);
    const recordedCall = repo.createUsageRecord.mock.calls[0][0];
    expect(recordedCall.route).toBe('/api/v1/crm/leads'); // Query stripped
    expect(recordedCall.responseClass).toBe('2xx');
    expect(recordedCall.clientIpHash).toHaveLength(64); // SHA-256 hex
    expect(metricsService.incrementCounter).toHaveBeenCalledWith(
      'tenant.org-1.api_requests',
      {
        method: 'GET',
        statusCode: '200',
        responseClass: '2xx',
      },
    );
  });

  it('should query usage and return paginated data with meta', async () => {
    repo.findUsageRecords.mockResolvedValue({
      records: [{ id: 'rec-1', route: '/api/v1/orders', statusCode: 200 }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const result = await service.getUsageRecords('org-1', {
      page: 1,
      limit: 20,
    });
    expect(result.records).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('should aggregate usage summary stats correctly', async () => {
    repo.getAggregatedMetrics.mockResolvedValue({
      totalRequests: 100,
      successfulRequests: 95,
      failedRequests: 5,
      avgDurationMs: 38,
      p95DurationMs: 95,
      p99DurationMs: 140,
    });
    repo.getEndpointMetrics.mockResolvedValue([
      { route: '/api/v1/crm/customers', count: 50 },
    ]);
    repo.getStatusCodeBreakdown.mockResolvedValue({
      classes: { '2xx': 95, '5xx': 5 },
      codes: { 200: 95, 500: 5 },
    });

    const summary = await service.getSummary('org-1', 7);
    expect(summary.summary.totalRequests).toBe(100);
    expect(summary.topEndpoints).toHaveLength(1);
    expect(summary.statusBreakdown.codes[200]).toBe(95);
  });
});
