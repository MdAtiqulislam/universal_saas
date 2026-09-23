import { Injectable } from '@nestjs/common';
import { HealthStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { JobService } from '../../common/jobs/job.service';

export interface HealthCheckResult {
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
}

export interface HealthState {
  status: HealthStatus;
  components: {
    database: HealthCheckResult;
    cache: HealthCheckResult;
    jobs: HealthCheckResult;
  };
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly jobs: JobService,
  ) {}

  async check(): Promise<HealthState> {
    const dbCheck = await this.checkDb();
    const cacheCheck = this.checkCache();
    const jobsCheck = this.checkJobs();

    const components = {
      database: dbCheck,
      cache: cacheCheck,
      jobs: jobsCheck,
    };

    let overallStatus: HealthStatus = HealthStatus.UP;
    if (Object.values(components).some((c) => c.status === HealthStatus.DOWN)) {
      overallStatus = HealthStatus.DEGRADED;
    }

    return {
      status: overallStatus,
      components,
      timestamp: new Date().toISOString(),
    };
  }

  getLiveness(): Promise<{ status: HealthStatus }> {
    return Promise.resolve({ status: HealthStatus.UP });
  }

  async getReadiness(): Promise<{ status: HealthStatus }> {
    const db = await this.checkDb();
    return {
      status:
        db.status === HealthStatus.UP ? HealthStatus.UP : HealthStatus.DOWN,
    };
  }

  private async checkDb(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: HealthStatus.UP, latencyMs: Date.now() - start };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Database check failed';
      return { status: HealthStatus.DOWN, message: msg };
    }
  }

  private checkCache(): HealthCheckResult {
    const start = Date.now();
    try {
      this.cache.set('health_check', 'ok', 5);
      const val = this.cache.get<string>('health_check');
      if (val !== 'ok') throw new Error('Cache miss');
      return { status: HealthStatus.UP, latencyMs: Date.now() - start };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Cache check failed';
      return { status: HealthStatus.DOWN, message: msg };
    }
  }

  private checkJobs(): HealthCheckResult {
    const start = Date.now();
    try {
      return { status: HealthStatus.UP, latencyMs: Date.now() - start };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Job service check failed';
      return { status: HealthStatus.DOWN, message: msg };
    }
  }
}
