import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ShipmentReportsService } from './shipment-reports.service';
import { ShipmentReportsQueryDto } from './dto/shipment-reports-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/shipping/reports')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ShipmentReportsController {
  constructor(private readonly reportsService: ShipmentReportsService) {}

  @Get('summary')
  @RequirePermissions('shipping.reports.view')
  async getSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ShipmentReportsQueryDto,
  ) {
    return this.reportsService.getShipmentSummary(tenant.organizationId, query);
  }

  @Get('open')
  @RequirePermissions('shipping.reports.view')
  async getOpen(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ShipmentReportsQueryDto,
  ) {
    return this.reportsService.getOpenShipments(tenant.organizationId, query);
  }

  @Get('performance')
  @RequirePermissions('shipping.reports.view')
  async getPerformance(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ShipmentReportsQueryDto,
  ) {
    return this.reportsService.getShipmentPerformance(
      tenant.organizationId,
      query,
    );
  }

  @Get('carriers')
  @RequirePermissions('shipping.reports.view')
  async getCarriers(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ShipmentReportsQueryDto,
  ) {
    return this.reportsService.getCarrierPerformance(
      tenant.organizationId,
      query,
    );
  }

  @Get('customers/:customerId')
  @RequirePermissions('shipping.reports.view')
  async getCustomerHistory(
    @CurrentTenant() tenant: TenantContext,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query() query: ShipmentReportsQueryDto,
  ) {
    return this.reportsService.getCustomerShipmentHistory(
      tenant.organizationId,
      customerId,
      query,
    );
  }

  @Get('costs')
  @RequirePermissions('shipping.reports.view')
  async getCosts(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ShipmentReportsQueryDto,
  ) {
    return this.reportsService.getShipmentCostReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('exceptions')
  @RequirePermissions('shipping.reports.view')
  async getExceptions(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ShipmentReportsQueryDto,
  ) {
    return this.reportsService.getTrackingExceptions(
      tenant.organizationId,
      query,
    );
  }
}
