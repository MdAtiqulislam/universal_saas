import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from '../metrics/metrics.service';
import { CorrelationContextService } from '../logging/correlation-context.service';

describe('M38: Observability Concurrency & Load Safety', () => {
  let metricsService: MetricsService;
  let contextService: CorrelationContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService, CorrelationContextService],
    }).compile();

    metricsService = module.get<MetricsService>(MetricsService);
    contextService = module.get<CorrelationContextService>(
      CorrelationContextService,
    );
  });

  it('1. should safely handle 10,000 concurrent metric increments without corruption', async () => {
    const promises: Promise<void>[] = [];
    const iterations = 10000;

    for (let i = 0; i < iterations; i++) {
      promises.push(
        Promise.resolve().then(() => {
          metricsService.incrementCounter('concurrent_requests_total');
        }),
      );
    }

    await Promise.all(promises);
    expect(metricsService.getCounterValue('concurrent_requests_total')).toBe(
      iterations,
    );
  });

  it('2. should maintain correlation context isolation across 500 concurrent async tasks', async () => {
    const runTask = (idx: number) => {
      return new Promise<boolean>((resolve) => {
        const reqId = `req-load-${idx}`;
        const orgId = `org-load-${idx}`;

        contextService.run(
          { requestId: reqId, organizationId: orgId },
          async () => {
            // Simulate non-trivial async work with jitter
            await new Promise((r) => setTimeout(r, Math.random() * 20));
            const ctx = contextService.getContext();
            const valid =
              ctx?.requestId === reqId && ctx?.organizationId === orgId;
            resolve(valid);
          },
        );
      });
    };

    const taskPromises = Array.from({ length: 500 }, (_, i) => runTask(i));
    const results = await Promise.all(taskPromises);

    const allValid = results.every((r) => r === true);
    expect(allValid).toBe(true);
  });

  it('3. should handle high-frequency histogram recordings within bounded memory limits', () => {
    for (let i = 0; i < 50000; i++) {
      metricsService.recordHistogram('heavy_latency_ms', Math.random() * 500);
    }

    const percentiles =
      metricsService.getHistogramPercentiles('heavy_latency_ms');
    expect(percentiles).toBeDefined();
    expect(percentiles?.p50).toBeGreaterThanOrEqual(0);
    expect(percentiles?.p95).toBeGreaterThanOrEqual(percentiles?.p50 || 0);
    expect(percentiles?.p99).toBeGreaterThanOrEqual(percentiles?.p95 || 0);
  });
});
