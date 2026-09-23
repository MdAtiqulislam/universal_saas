import {
  Controller,
  Get,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { SearchReportsService } from '../services/search-reports.service';

@Controller('search/reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SearchReportsController {
  constructor(private readonly reportsService: SearchReportsService) {}

  @Get('usage')
  @RequirePermissions('search.analytics.read')
  async getUsageOverview(
    @Query('days') days?: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId)
      throw new ForbiddenException('Tenant context required');
    const data = await this.reportsService.getUsageOverview(
      tenant.organizationId,
      days ? parseInt(days, 10) : 30,
    );
    return { success: true, data };
  }

  @Get('volume-by-module')
  @RequirePermissions('search.analytics.read')
  async getVolumeByModule(
    @Query('days') days?: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId)
      throw new ForbiddenException('Tenant context required');
    const data = await this.reportsService.getVolumeByModule(
      tenant.organizationId,
      days ? parseInt(days, 10) : 30,
    );
    return { success: true, data };
  }

  @Get('zero-results')
  @RequirePermissions('search.analytics.read')
  async getZeroResultSearches(
    @Query('days') days?: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId)
      throw new ForbiddenException('Tenant context required');
    const data = await this.reportsService.getZeroResultSearches(
      tenant.organizationId,
      days ? parseInt(days, 10) : 30,
    );
    return { success: true, data };
  }

  @Get('performance')
  @RequirePermissions('search.analytics.read')
  async getSearchPerformance(
    @Query('days') days?: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId)
      throw new ForbiddenException('Tenant context required');
    const data = await this.reportsService.getSearchPerformance(
      tenant.organizationId,
      days ? parseInt(days, 10) : 30,
    );
    return { success: true, data };
  }

  @Get('popular-terms')
  @RequirePermissions('search.analytics.read')
  async getPopularSearchTerms(
    @Query('days') days?: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId)
      throw new ForbiddenException('Tenant context required');
    const data = await this.reportsService.getPopularSearchTerms(
      tenant.organizationId,
      days ? parseInt(days, 10) : 30,
    );
    return { success: true, data };
  }

  @Get('saved-views-usage')
  @RequirePermissions('search.analytics.read')
  async getSavedViewsUsage(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId)
      throw new ForbiddenException('Tenant context required');
    const data = await this.reportsService.getSavedViewsUsage(
      tenant.organizationId,
    );
    return { success: true, data };
  }

  @Get('alert-activity')
  @RequirePermissions('search.analytics.read')
  async getSearchAlertActivity(
    @Query('days') days?: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId)
      throw new ForbiddenException('Tenant context required');
    const data = await this.reportsService.getSearchAlertActivity(
      tenant.organizationId,
      days ? parseInt(days, 10) : 30,
    );
    return { success: true, data };
  }

  @Get('api-usage')
  @RequirePermissions('search.analytics.read')
  async getSearchApiUsage(
    @Query('days') days?: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId)
      throw new ForbiddenException('Tenant context required');
    const data = await this.reportsService.getSearchApiUsage(
      tenant.organizationId,
      days ? parseInt(days, 10) : 30,
    );
    return { success: true, data };
  }
}
