import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QualityReportsService } from './quality-reports.service';
import { QualityReportsQueryDto } from './dto/quality-reports.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/quality/reports')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class QualityReportsController {
  constructor(private readonly reportsService: QualityReportsService) {}

  @Get('inspection-summary')
  @RequirePermissions('quality.reports.view')
  async getInspectionSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QualityReportsQueryDto,
  ) {
    return this.reportsService.getInspectionSummary(
      tenant.organizationId,
      query,
    );
  }

  @Get('pass-fail')
  @RequirePermissions('quality.reports.view')
  async getPassFailReport(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QualityReportsQueryDto,
  ) {
    return this.reportsService.getPassFailReport(tenant.organizationId, query);
  }

  @Get('lot-aging')
  @RequirePermissions('quality.reports.view')
  async getLotAging(@CurrentTenant() tenant: TenantContext) {
    return this.reportsService.getInspectionLotAging(tenant.organizationId);
  }

  @Get('holds')
  @RequirePermissions('quality.reports.view')
  async getHoldReport(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QualityReportsQueryDto,
  ) {
    return this.reportsService.getQualityHoldReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('quarantine-aging')
  @RequirePermissions('quality.reports.view')
  async getQuarantineAging(@CurrentTenant() tenant: TenantContext) {
    return this.reportsService.getQuarantineAgingReport(tenant.organizationId);
  }

  @Get('non-conformance')
  @RequirePermissions('quality.reports.view')
  async getNonConformanceReport(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QualityReportsQueryDto,
  ) {
    return this.reportsService.getNonConformanceReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('ncr-aging')
  @RequirePermissions('quality.reports.view')
  async getNcrAging(@CurrentTenant() tenant: TenantContext) {
    return this.reportsService.getNcrAgingReport(tenant.organizationId);
  }

  @Get('capa')
  @RequirePermissions('quality.reports.view')
  async getCapaReport(@CurrentTenant() tenant: TenantContext) {
    return this.reportsService.getCapaStatusReport(tenant.organizationId);
  }

  @Get('supplier-quality')
  @RequirePermissions('quality.reports.view')
  async getSupplierQuality(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QualityReportsQueryDto,
  ) {
    return this.reportsService.getSupplierQualityReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('customer-quality')
  @RequirePermissions('quality.reports.view')
  async getCustomerQuality(@CurrentTenant() tenant: TenantContext) {
    return this.reportsService.getCustomerQualityReport(tenant.organizationId);
  }

  @Get('rework-scrap')
  @RequirePermissions('quality.reports.view')
  async getReworkScrap(@CurrentTenant() tenant: TenantContext) {
    return this.reportsService.getReworkAndScrapReport(tenant.organizationId);
  }

  @Get('trends')
  @RequirePermissions('quality.reports.view')
  async getTrends(@CurrentTenant() tenant: TenantContext) {
    return this.reportsService.getQualityTrendAnalysis(tenant.organizationId);
  }
}
