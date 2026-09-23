import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { WarehouseReportsService } from './warehouse-reports.service';
import { WarehouseReportsQueryDto } from './dto/warehouse-reports-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/warehouse/reports')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class WarehouseReportsController {
  constructor(private readonly reportsService: WarehouseReportsService) {}

  @Get('stock-by-location')
  @RequirePermissions('warehouse.reports.view')
  async getStockByLocation(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: WarehouseReportsQueryDto,
  ) {
    return this.reportsService.getStockByLocation(tenant.organizationId, query);
  }

  @Get('location-occupancy')
  @RequirePermissions('warehouse.reports.view')
  async getLocationOccupancy(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: WarehouseReportsQueryDto,
  ) {
    return this.reportsService.getLocationOccupancy(
      tenant.organizationId,
      query,
    );
  }

  @Get('task-performance')
  @RequirePermissions('warehouse.reports.view')
  async getTaskPerformance(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: WarehouseReportsQueryDto,
  ) {
    return this.reportsService.getTaskPerformance(tenant.organizationId, query);
  }

  @Get('count-variances')
  @RequirePermissions('warehouse.reports.view')
  async getCountVariances(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: WarehouseReportsQueryDto,
  ) {
    return this.reportsService.getCountVariances(tenant.organizationId, query);
  }

  @Get('quarantine-aging')
  @RequirePermissions('warehouse.reports.view')
  async getQuarantineAging(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: WarehouseReportsQueryDto,
  ) {
    return this.reportsService.getQuarantineAging(tenant.organizationId, query);
  }

  @Get('replenishment-history')
  @RequirePermissions('warehouse.reports.view')
  async getReplenishmentHistory(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: WarehouseReportsQueryDto,
  ) {
    return this.reportsService.getReplenishmentHistory(
      tenant.organizationId,
      query,
    );
  }

  @Get('transfer-analysis')
  @RequirePermissions('warehouse.reports.view')
  async getTransferAnalysis(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: WarehouseReportsQueryDto,
  ) {
    return this.reportsService.getTransferAnalysis(
      tenant.organizationId,
      query,
    );
  }

  @Get('accuracy-rate')
  @RequirePermissions('warehouse.reports.view')
  async getInventoryAccuracyRate(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: WarehouseReportsQueryDto,
  ) {
    return this.reportsService.getInventoryAccuracyRate(
      tenant.organizationId,
      query,
    );
  }

  @Get('picking-velocity')
  @RequirePermissions('warehouse.reports.view')
  async getPickingVelocity(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: WarehouseReportsQueryDto,
  ) {
    return this.reportsService.getPickingAccuracyAndVelocity(
      tenant.organizationId,
      query,
    );
  }
}
