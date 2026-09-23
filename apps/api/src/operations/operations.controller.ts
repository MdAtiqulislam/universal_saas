import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { MetricsService } from './metrics/metrics.service';
import { OperationsReportsService } from './reports/operations-reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionGuard } from '../auth/guards/permission.guard';

interface AuthenticatedRequest {
  user?: {
    id?: string;
    organizationId?: string;
  };
}

@Controller('operations')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OperationsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly reportsService: OperationsReportsService,
  ) {}

  @Get('metrics')
  @RequirePermissions('operations.metrics.view')
  getMetrics() {
    return this.metricsService.getMetrics();
  }

  @Get('performance')
  @RequirePermissions('operations.metrics.view')
  getPerformance(@Req() req: AuthenticatedRequest) {
    return this.reportsService.getApiPerformanceReport(
      req.user?.organizationId,
    );
  }

  @Get('errors')
  @RequirePermissions('operations.errors.view')
  getErrors(@Req() req: AuthenticatedRequest) {
    return this.reportsService.getErrorTrendReport(req.user?.organizationId);
  }

  @Get('jobs')
  @RequirePermissions('operations.jobs.view')
  getJobs(@Req() req: AuthenticatedRequest) {
    return this.reportsService.getJobReliabilityReport(
      req.user?.organizationId || '',
    );
  }

  @Get('cache')
  @RequirePermissions('operations.cache.view')
  getCache() {
    return this.reportsService.getCachePerformanceReport();
  }

  @Get('security')
  @RequirePermissions('operations.security.view')
  getSecurity(@Req() req: AuthenticatedRequest) {
    return this.reportsService.getSecurityOperationsSummary(
      req.user?.organizationId || '',
    );
  }
}
