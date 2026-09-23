import { Controller, Post, Query, UseGuards } from '@nestjs/common';
import { PerformanceBenchmarkService } from './performance-benchmark.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/benchmarks')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class PerformanceBenchmarkController {
  constructor(private readonly benchmarkService: PerformanceBenchmarkService) {}

  @Post('run')
  @RequirePermissions('system.benchmarks.run')
  async runSuite(
    @CurrentTenant() tenant: TenantContext,
    @Query('iterations') iterations?: string,
  ) {
    const iter = iterations ? parseInt(iterations, 10) : 20;
    return this.benchmarkService.runBenchmarkSuite(tenant.organizationId, iter);
  }
}
