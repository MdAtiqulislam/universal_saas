import { Controller, Get, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { AnalyticsReportsService } from '../services/analytics-reports.service';

@Controller('analytics/operational-reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AnalyticsReportsController {
  constructor(private readonly reportsService: AnalyticsReportsService) {}

  @Get('overview')
  @RequirePermissions('analytics.admin')
  async getOverview(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.reportsService.getUsageOverview(tenant.organizationId);
  }

  @Get('performance')
  @RequirePermissions('analytics.admin')
  async getPerformance(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.reportsService.getExecutionPerformance(tenant.organizationId);
  }

  @Get('popular')
  @RequirePermissions('analytics.admin')
  async getPopular(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.reportsService.getPopularResources(tenant.organizationId);
  }

  @Get('slow-queries')
  @RequirePermissions('analytics.admin')
  async getSlowQueries(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.reportsService.getSlowQueries(tenant.organizationId);
  }

  @Get('export-volume')
  @RequirePermissions('analytics.admin')
  async getExportVolume(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.reportsService.getExportVolume(tenant.organizationId);
  }

  @Get('schedule-reliability')
  @RequirePermissions('analytics.admin')
  async getScheduleReliability(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.reportsService.getScheduleReliability(tenant.organizationId);
  }

  @Get('dataset-utilization')
  @RequirePermissions('analytics.admin')
  async getDatasetUtilization(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.reportsService.getDatasetUtilization(tenant.organizationId);
  }

  @Get('security-audit')
  @RequirePermissions('analytics.admin')
  async getSecurityAudit(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.reportsService.getSecurityAudit(tenant.organizationId);
  }
}
