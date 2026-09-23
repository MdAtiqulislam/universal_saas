import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CrmReportsService } from './crm-reports.service';
import { CrmReportFilterDto } from '../dto/crm-reports.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/crm/reports')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CrmReportsController {
  constructor(private readonly reportsService: CrmReportsService) {}

  @Get('funnel')
  @RequirePermissions('crm.reports.view')
  async getLeadFunnel(
    @CurrentTenant() tenant: TenantContext,
    @Query() filter: CrmReportFilterDto,
  ) {
    return this.reportsService.getLeadFunnelReport(
      tenant.organizationId,
      filter,
    );
  }

  @Get('lead-sources')
  @RequirePermissions('crm.reports.view')
  async getLeadSources(
    @CurrentTenant() tenant: TenantContext,
    @Query() filter: CrmReportFilterDto,
  ) {
    return this.reportsService.getLeadSourcePerformance(
      tenant.organizationId,
      filter,
    );
  }

  @Get('pipeline')
  @RequirePermissions('crm.reports.view')
  async getPipeline(
    @CurrentTenant() tenant: TenantContext,
    @Query() filter: CrmReportFilterDto,
  ) {
    return this.reportsService.getOpportunityPipelineReport(
      tenant.organizationId,
      filter,
    );
  }

  @Get('weighted-forecast')
  @RequirePermissions('crm.reports.view')
  async getWeightedForecast(
    @CurrentTenant() tenant: TenantContext,
    @Query() filter: CrmReportFilterDto,
  ) {
    return this.reportsService.getWeightedPipelineForecast(
      tenant.organizationId,
      filter,
    );
  }

  @Get('aging')
  @RequirePermissions('crm.reports.view')
  async getAging(
    @CurrentTenant() tenant: TenantContext,
    @Query() filter: CrmReportFilterDto,
  ) {
    return this.reportsService.getOpportunityAgingReport(
      tenant.organizationId,
      filter,
    );
  }

  @Get('win-loss')
  @RequirePermissions('crm.reports.view')
  async getWinLoss(
    @CurrentTenant() tenant: TenantContext,
    @Query() filter: CrmReportFilterDto,
  ) {
    return this.reportsService.getWinLossAnalysis(
      tenant.organizationId,
      filter,
    );
  }

  @Get('sales-reps')
  @RequirePermissions('crm.reports.view')
  async getSalesReps(
    @CurrentTenant() tenant: TenantContext,
    @Query() filter: CrmReportFilterDto,
  ) {
    return this.reportsService.getSalesRepPerformance(
      tenant.organizationId,
      filter,
    );
  }

  @Get('sales-cycle')
  @RequirePermissions('crm.reports.view')
  async getSalesCycle(
    @CurrentTenant() tenant: TenantContext,
    @Query() filter: CrmReportFilterDto,
  ) {
    return this.reportsService.getSalesCycleAnalysis(
      tenant.organizationId,
      filter,
    );
  }

  @Get('quotation-conversion')
  @RequirePermissions('crm.reports.view')
  async getQuotationConversion(
    @CurrentTenant() tenant: TenantContext,
    @Query() filter: CrmReportFilterDto,
  ) {
    return this.reportsService.getQuotationConversionReport(
      tenant.organizationId,
      filter,
    );
  }

  @Get('customer-acquisition')
  @RequirePermissions('crm.reports.view')
  async getCustomerAcquisition(
    @CurrentTenant() tenant: TenantContext,
    @Query() filter: CrmReportFilterDto,
  ) {
    return this.reportsService.getCustomerAcquisitionReport(
      tenant.organizationId,
      filter,
    );
  }

  @Get('revenue-forecast')
  @RequirePermissions('crm.reports.view')
  async getRevenueForecast(
    @CurrentTenant() tenant: TenantContext,
    @Query() filter: CrmReportFilterDto,
  ) {
    return this.reportsService.getRevenueForecast(
      tenant.organizationId,
      filter,
    );
  }

  @Get('activities')
  @RequirePermissions('crm.reports.view')
  async getActivities(
    @CurrentTenant() tenant: TenantContext,
    @Query() filter: CrmReportFilterDto,
  ) {
    return this.reportsService.getCustomer360ActivityReport(
      tenant.organizationId,
      filter,
    );
  }
}
