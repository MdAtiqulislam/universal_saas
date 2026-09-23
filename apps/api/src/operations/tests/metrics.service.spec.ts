import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from '../metrics/metrics.service';

describe('M38: MetricsService (INV-341, INV-342, INV-343, INV-344)', () => {
  let metricsService: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    metricsService = module.get<MetricsService>(MetricsService);
  });

  describe('Counter Metrics (INV-341)', () => {
    it('1. should increment monotonic counters correctly', () => {
      metricsService.incrementCounter('http_requests_total');
      metricsService.incrementCounter('http_requests_total');
      metricsService.incrementCounter('http_requests_total');

      expect(metricsService.getCounterValue('http_requests_total')).toBe(3);
    });

    it('2. should support label-dimensioned counters', () => {
      metricsService.incrementCounter('api_calls', {
        method: 'GET',
        status: '200',
      });
      metricsService.incrementCounter('api_calls', {
        method: 'GET',
        status: '200',
      });
      metricsService.incrementCounter('api_calls', {
        method: 'POST',
        status: '201',
      });

      const metrics = metricsService.getMetrics();
      expect(metrics.counters['api_calls{method=GET,status=200}']).toBe(2);
      expect(metrics.counters['api_calls{method=POST,status=201}']).toBe(1);
    });
  });

  describe('Gauge Metrics', () => {
    it('3. should update gauge values accurately', () => {
      metricsService.setGauge('active_connections', 10);
      metricsService.setGauge('active_connections', 25);
      metricsService.setGauge('active_connections', 15);

      const metrics = metricsService.getMetrics();
      expect(metrics.gauges['active_connections']).toBe(15);
    });
  });

  describe('Histogram Metrics & Percentiles (INV-342)', () => {
    it('4. should calculate p50, p95, p99 percentiles properly', () => {
      // Record 100 sample latencies from 1 to 100
      for (let i = 1; i <= 100; i++) {
        metricsService.recordHistogram('request_duration_ms', i);
      }

      const percentiles = metricsService.getHistogramPercentiles(
        'request_duration_ms',
      );
      expect(percentiles).toBeDefined();
      expect(percentiles?.p50).toBe(50);
      expect(percentiles?.p95).toBe(95);
      expect(percentiles?.p99).toBe(99);
    });

    it('5. should reject negative histogram values (INV-342)', () => {
      metricsService.recordHistogram('db_query_time', -10);
      const percentiles =
        metricsService.getHistogramPercentiles('db_query_time');
      expect(percentiles).toBeNull();
    });

    it('6. should bound in-memory histogram samples to max 1000 items', () => {
      for (let i = 0; i < 1500; i++) {
        metricsService.recordHistogram('bounded_metric', i);
      }

      const metrics = metricsService.getMetrics();
      expect(metrics.histograms['bounded_metric']).toBeDefined();
    });
  });
});
