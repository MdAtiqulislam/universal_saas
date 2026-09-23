import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PaginationService } from './pagination/pagination.service';
import { IdempotencyService } from './idempotency/idempotency.service';
import { CacheService } from './cache/cache.service';
import { JobService } from './jobs/job.service';
import { JobController } from './jobs/job.controller';
import { PerformanceBenchmarkService } from './benchmarks/performance-benchmark.service';
import { PerformanceBenchmarkController } from './benchmarks/performance-benchmark.controller';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [JobController, PerformanceBenchmarkController],
  providers: [
    PaginationService,
    IdempotencyService,
    CacheService,
    JobService,
    PerformanceBenchmarkService,
  ],
  exports: [
    PaginationService,
    IdempotencyService,
    CacheService,
    JobService,
    PerformanceBenchmarkService,
  ],
})
export class CommonModule {}
