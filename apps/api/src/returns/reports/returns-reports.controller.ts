import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReturnsReportsService } from './returns-reports.service';
import { ReturnsReportsQueryDto } from './dto/returns-reports.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/returns/reports')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ReturnsReportsController {
  constructor(private readonly reportsService: ReturnsReportsService) {}

  @Get('summary')
  @RequirePermissions('returns.reports.view')
  async getSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ReturnsReportsQueryDto,
  ) {
    return this.reportsService.getSummaryReport(tenant.organizationId, query);
  }

  @Get('customer')
  @RequirePermissions('returns.reports.view')
  async getCustomerReturns(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ReturnsReportsQueryDto,
  ) {
    return this.reportsService.getCustomerReturnsReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('supplier')
  @RequirePermissions('returns.reports.view')
  async getSupplierReturns(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ReturnsReportsQueryDto,
  ) {
    return this.reportsService.getSupplierReturnsReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('reasons')
  @RequirePermissions('returns.reports.view')
  async getReasonAnalysis(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ReturnsReportsQueryDto,
  ) {
    return this.reportsService.getReasonAnalysisReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('dispositions')
  @RequirePermissions('returns.reports.view')
  async getDispositionsAnalysis(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ReturnsReportsQueryDto,
  ) {
    return this.reportsService.getDispositionAnalysisReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('financial-impact')
  @RequirePermissions('returns.reports.view')
  async getFinancialImpact(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ReturnsReportsQueryDto,
  ) {
    return this.reportsService.getFinancialImpactReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('aging')
  @RequirePermissions('returns.reports.view')
  async getAging(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ReturnsReportsQueryDto,
  ) {
    return this.reportsService.getAgingReport(tenant.organizationId, query);
  }

  @Get('quality')
  @RequirePermissions('returns.reports.view')
  async getQualityLinked(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ReturnsReportsQueryDto,
  ) {
    return this.reportsService.getQualityLinkedReturnsReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('trends')
  @RequirePermissions('returns.reports.view')
  async getTrends(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ReturnsReportsQueryDto,
  ) {
    return this.reportsService.getTrendsReport(tenant.organizationId, query);
  }
}
