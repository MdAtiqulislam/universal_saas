import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ServiceReportsService } from './service-reports.service';
import { ServiceReportQueryDto } from '../dto/service-reports.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/service/reports')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ServiceReportsController {
  constructor(private readonly serviceReportsService: ServiceReportsService) {}

  @Get('summary')
  @RequirePermissions('service.reports.view')
  async getSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ServiceReportQueryDto,
  ) {
    return this.serviceReportsService.getSummary(tenant.organizationId, query);
  }

  @Get('sla')
  @RequirePermissions('service.reports.view')
  async getSlaPerformance(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ServiceReportQueryDto,
  ) {
    return this.serviceReportsService.getSlaPerformance(
      tenant.organizationId,
      query,
    );
  }

  @Get('technicians')
  @RequirePermissions('service.reports.sensitive')
  async getTechnicianPerformance(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ServiceReportQueryDto,
  ) {
    return this.serviceReportsService.getTechnicianPerformance(
      tenant.organizationId,
      query,
    );
  }

  @Get('warranty-cost')
  @RequirePermissions('service.reports.financial')
  async getWarrantyCost(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ServiceReportQueryDto,
  ) {
    return this.serviceReportsService.getWarrantyCostReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('profitability')
  @RequirePermissions('service.reports.financial')
  async getProfitability(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ServiceReportQueryDto,
  ) {
    return this.serviceReportsService.getServiceProfitability(
      tenant.organizationId,
      query,
    );
  }

  @Get('parts')
  @RequirePermissions('service.reports.view')
  async getPartsConsumption(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ServiceReportQueryDto,
  ) {
    return this.serviceReportsService.getPartsConsumptionReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('repeat-repairs')
  @RequirePermissions('service.reports.view')
  async getRepeatRepairs(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ServiceReportQueryDto,
  ) {
    return this.serviceReportsService.getRepeatRepairs(
      tenant.organizationId,
      query,
    );
  }

  @Get('failures')
  @RequirePermissions('service.reports.view')
  async getFailureAnalysis(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ServiceReportQueryDto,
  ) {
    return this.serviceReportsService.getFailureAnalysis(
      tenant.organizationId,
      query,
    );
  }

  @Get('aging')
  @RequirePermissions('service.reports.view')
  async getWorkOrderAging(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ServiceReportQueryDto,
  ) {
    return this.serviceReportsService.getWorkOrderAging(
      tenant.organizationId,
      query,
    );
  }

  @Get('rma')
  @RequirePermissions('service.reports.view')
  async getRmaToService(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ServiceReportQueryDto,
  ) {
    return this.serviceReportsService.getRmaToServiceReport(
      tenant.organizationId,
      query,
    );
  }
}
