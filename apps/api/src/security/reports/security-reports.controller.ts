import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SecurityReportsService } from './security-reports.service';
import { SecurityReportQueryDto } from '../dto/security-reports.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/security/reports')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class SecurityReportsController {
  constructor(private readonly reportsService: SecurityReportsService) {}

  @Get('auth-activity')
  @RequirePermissions('security.reports.view')
  async getAuthActivity(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SecurityReportQueryDto,
  ) {
    return this.reportsService.getAuthActivityReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('failed-logins')
  @RequirePermissions('security.reports.view')
  async getFailedLogins(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SecurityReportQueryDto,
  ) {
    return this.reportsService.getFailedLoginReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('active-sessions')
  @RequirePermissions('security.reports.view')
  async getActiveSessions(@CurrentTenant() tenant: TenantContext) {
    return this.reportsService.getActiveSessionReport(tenant.organizationId);
  }

  @Get('privileged-actions')
  @RequirePermissions('security.reports.view')
  async getPrivilegedActions(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SecurityReportQueryDto,
  ) {
    return this.reportsService.getPrivilegedActionReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('auth-failures')
  @RequirePermissions('security.reports.view')
  async getAuthFailures(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SecurityReportQueryDto,
  ) {
    return this.reportsService.getAuthFailureReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('tenant-events')
  @RequirePermissions('security.reports.view')
  async getTenantEvents(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SecurityReportQueryDto,
  ) {
    return this.reportsService.getTenantSecurityEventsReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('rate-limits')
  @RequirePermissions('security.reports.view')
  async getRateLimits(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SecurityReportQueryDto,
  ) {
    return this.reportsService.getRateLimitViolationReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('suspicious-activity')
  @RequirePermissions('security.reports.view')
  async getSuspiciousActivity(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SecurityReportQueryDto,
  ) {
    return this.reportsService.getSuspiciousActivityReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('incident-timeline')
  @RequirePermissions('security.reports.view')
  async getIncidentTimeline(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SecurityReportQueryDto,
  ) {
    return this.reportsService.getSecurityIncidentTimeline(
      tenant.organizationId,
      query,
    );
  }

  @Get('admin-changes')
  @RequirePermissions('security.reports.view')
  async getAdminChanges(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SecurityReportQueryDto,
  ) {
    return this.reportsService.getAdminChangeReport(
      tenant.organizationId,
      query,
    );
  }
}
