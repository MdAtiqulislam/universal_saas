import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface BenchmarkMetrics {
  name: string;
  operationsCount: number;
  totalDurationMs: number;
  throughputOpsPerSec: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  successRatePercentage: number;
}

export interface PlatformBenchmarkReport {
  timestamp: string;
  readBenchmarks: BenchmarkMetrics[];
  writeBenchmarks: BenchmarkMetrics[];
  heavyBenchmarks: BenchmarkMetrics[];
  summary: {
    totalWorkloadsTested: number;
    overallThroughputOpsPerSec: number;
    averageP95LatencyMs: number;
  };
}

@Injectable()
export class PerformanceBenchmarkService {
  private readonly logger = new Logger(PerformanceBenchmarkService.name);

  constructor(private readonly prisma: PrismaService) {}

  private calculatePercentile(
    sortedValues: number[],
    percentile: number,
  ): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return Number(
      sortedValues[
        Math.max(0, Math.min(index, sortedValues.length - 1))
      ].toFixed(2),
    );
  }

  async runBenchmarkSuite(
    organizationId: string,
    iterations: number = 20,
  ): Promise<PlatformBenchmarkReport> {
    const readBenchmarks: BenchmarkMetrics[] = [];
    const writeBenchmarks: BenchmarkMetrics[] = [];
    const heavyBenchmarks: BenchmarkMetrics[] = [];

    // --- 1. Read Benchmarks ---
    // 1.1 Customer list
    readBenchmarks.push(
      await this.measureWorkload(
        'Read: Customer List (Paginated)',
        iterations,
        async () => {
          await this.prisma.customer.findMany({
            where: { organizationId, deletedAt: null },
            take: 20,
            orderBy: { createdAt: 'desc' },
          });
        },
      ),
    );

    // 1.2 Sales Order listing with composite index
    readBenchmarks.push(
      await this.measureWorkload(
        'Read: Sales Orders (Status + Date)',
        iterations,
        async () => {
          await this.prisma.salesOrder.findMany({
            where: { organizationId, status: 'DRAFT' },
            take: 20,
            orderBy: { createdAt: 'desc' },
          });
        },
      ),
    );

    // 1.3 Invoice listing
    readBenchmarks.push(
      await this.measureWorkload(
        'Read: Customer Invoices (Status Filter)',
        iterations,
        async () => {
          await this.prisma.customerInvoice.findMany({
            where: { organizationId, status: 'DRAFT' },
            take: 20,
            orderBy: { createdAt: 'desc' },
          });
        },
      ),
    );

    // 1.4 CRM Opportunity Pipeline
    readBenchmarks.push(
      await this.measureWorkload(
        'Read: CRM Opportunities (Stage + Probability)',
        iterations,
        async () => {
          await this.prisma.opportunity.findMany({
            where: { organizationId },
            take: 20,
            orderBy: { createdAt: 'desc' },
          });
        },
      ),
    );

    // --- 2. Write Benchmarks ---
    // 2.1 Idempotency Key registration & resolution
    writeBenchmarks.push(
      await this.measureWorkload(
        'Write: Idempotency Record Mutation',
        iterations,
        async (i) => {
          const key = `bench-key-${Date.now()}-${i}-${Math.random()}`;
          const record = await this.prisma.idempotencyRecord.create({
            data: {
              organizationId,
              idempotencyKey: key,
              action: 'benchmark_test',
              status: 'PENDING',
              expiresAt: new Date(Date.now() + 3600000),
            },
          });
          await this.prisma.idempotencyRecord.update({
            where: { id: record.id },
            data: { status: 'COMPLETED', statusCode: 200 },
          });
          await this.prisma.idempotencyRecord.delete({
            where: { id: record.id },
          });
        },
      ),
    );

    // 2.2 Background Job Queueing
    writeBenchmarks.push(
      await this.measureWorkload(
        'Write: Background Job Enqueue',
        iterations,
        async (i) => {
          const job = await this.prisma.backgroundJob.create({
            data: {
              organizationId,
              jobType: 'BENCHMARK_TEST',
              status: 'PENDING',
              payload: { iteration: i },
            },
          });
          await this.prisma.backgroundJob.delete({
            where: { id: job.id },
          });
        },
      ),
    );

    // --- 3. Heavy Workloads ---
    // 3.1 Aggregate calculations across ledger
    heavyBenchmarks.push(
      await this.measureWorkload(
        'Heavy: Sales and Invoice Aggregations',
        iterations,
        async () => {
          await Promise.all([
            this.prisma.salesOrder.aggregate({
              where: { organizationId },
              _count: true,
              _sum: { grandTotal: true },
            }),
            this.prisma.customerInvoice.aggregate({
              where: { organizationId },
              _count: true,
              _sum: { grandTotal: true, amountPaid: true, amountDue: true },
            }),
          ]);
        },
      ),
    );

    // 3.2 Multi-table composite telemetry
    heavyBenchmarks.push(
      await this.measureWorkload(
        'Heavy: CRM Pipeline Summary Aggregations',
        iterations,
        async () => {
          await Promise.all([
            this.prisma.opportunity.groupBy({
              by: ['stage'],
              where: { organizationId },
              _count: true,
              _sum: { estimatedValue: true },
            }),
            this.prisma.lead.groupBy({
              by: ['status'],
              where: { organizationId },
              _count: true,
            }),
          ]);
        },
      ),
    );

    // Summary calculation
    const allBenchmarks = [
      ...readBenchmarks,
      ...writeBenchmarks,
      ...heavyBenchmarks,
    ];
    const totalOps = allBenchmarks.reduce(
      (sum, b) => sum + b.operationsCount,
      0,
    );
    const totalDuration = allBenchmarks.reduce(
      (sum, b) => sum + b.totalDurationMs,
      0,
    );
    const avgThroughput =
      totalDuration > 0
        ? Number((totalOps / (totalDuration / 1000)).toFixed(1))
        : 0;
    const avgP95 = Number(
      (
        allBenchmarks.reduce((sum, b) => sum + b.p95LatencyMs, 0) /
        allBenchmarks.length
      ).toFixed(2),
    );

    return {
      timestamp: new Date().toISOString(),
      readBenchmarks,
      writeBenchmarks,
      heavyBenchmarks,
      summary: {
        totalWorkloadsTested: allBenchmarks.length,
        overallThroughputOpsPerSec: avgThroughput,
        averageP95LatencyMs: avgP95,
      },
    };
  }

  private async measureWorkload(
    name: string,
    iterations: number,
    operation: (index: number) => Promise<void>,
  ): Promise<BenchmarkMetrics> {
    const latencies: number[] = [];
    let successes = 0;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      const opStart = performance.now();
      try {
        await operation(i);
        successes++;
      } catch (err: any) {
        this.logger.warn(
          `Benchmark operation "${name}" iteration ${i} failed: ${err.message}`,
        );
      } finally {
        latencies.push(performance.now() - opStart);
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const sorted = [...latencies].sort((a, b) => a - b);
    const throughput =
      totalDurationMs > 0
        ? Number((iterations / (totalDurationMs / 1000)).toFixed(1))
        : 0;

    return {
      name,
      operationsCount: iterations,
      totalDurationMs,
      throughputOpsPerSec: throughput,
      p50LatencyMs: this.calculatePercentile(sorted, 50),
      p95LatencyMs: this.calculatePercentile(sorted, 95),
      p99LatencyMs: this.calculatePercentile(sorted, 99),
      minLatencyMs: Number((sorted[0] || 0).toFixed(2)),
      maxLatencyMs: Number((sorted[sorted.length - 1] || 0).toFixed(2)),
      successRatePercentage: Number(
        ((successes / iterations) * 100).toFixed(1),
      ),
    };
  }
}
