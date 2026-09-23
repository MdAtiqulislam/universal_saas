import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceBenchmarkService } from './performance-benchmark.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PerformanceBenchmarkService (Milestone M36)', () => {
  let service: PerformanceBenchmarkService;
  let prisma: any;

  const mockOrgId = 'org-benchmark-1';

  beforeEach(async () => {
    prisma = {
      customer: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      salesOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _count: 0, _sum: { grandTotal: 0 } }),
      },
      customerInvoice: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({
          _count: 0,
          _sum: { grandTotal: 0, amountPaid: 0, amountDue: 0 },
        }),
      },
      opportunity: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      lead: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      idempotencyRecord: {
        create: jest.fn().mockResolvedValue({ id: 'rec-1' }),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      backgroundJob: {
        create: jest.fn().mockResolvedValue({ id: 'job-1' }),
        delete: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceBenchmarkService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PerformanceBenchmarkService>(
      PerformanceBenchmarkService,
    );
  });

  it('should run benchmark suite across Read, Write, and Heavy workloads', async () => {
    const report = await service.runBenchmarkSuite(mockOrgId, 5);

    expect(report).toBeDefined();
    expect(report.readBenchmarks.length).toBeGreaterThanOrEqual(3);
    expect(report.writeBenchmarks.length).toBeGreaterThanOrEqual(2);
    expect(report.heavyBenchmarks.length).toBeGreaterThanOrEqual(2);
    expect(report.summary.totalWorkloadsTested).toBeGreaterThanOrEqual(7);

    // Verify percentile calculations
    for (const b of report.readBenchmarks) {
      expect(b.operationsCount).toBe(5);
      expect(b.p50LatencyMs).toBeGreaterThanOrEqual(0);
      expect(b.p95LatencyMs).toBeGreaterThanOrEqual(b.p50LatencyMs);
      expect(b.p99LatencyMs).toBeGreaterThanOrEqual(b.p95LatencyMs);
    }
  });
});
