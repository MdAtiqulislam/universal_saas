import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SalesFulfillmentReportsService } from './sales-fulfillment-reports.service';
import { FulfillmentReportsQueryDto } from './dto/fulfillment-reports-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/sales/reports')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class SalesFulfillmentReportsController {
  constructor(
    private readonly reportsService: SalesFulfillmentReportsService,
  ) {}

  @Get('summary')
  @RequirePermissions('sales.reports.view')
  async getSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: FulfillmentReportsQueryDto,
  ) {
    return this.reportsService.getSalesOrderSummary(
      tenant.organizationId,
      query,
    );
  }

  @Get('open-orders')
  @RequirePermissions('sales.reports.view')
  async getOpenOrders(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: FulfillmentReportsQueryDto,
  ) {
    return this.reportsService.getOpenSalesOrders(tenant.organizationId, query);
  }

  @Get('fulfillment')
  @RequirePermissions('sales.reports.view')
  async getFulfillment(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: FulfillmentReportsQueryDto,
  ) {
    return this.reportsService.getFulfillmentReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('customer-history/:customerId')
  @RequirePermissions('sales.reports.view')
  async getCustomerHistory(
    @CurrentTenant() tenant: TenantContext,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query() query: FulfillmentReportsQueryDto,
  ) {
    return this.reportsService.getCustomerOrderHistory(
      tenant.organizationId,
      customerId,
      query,
    );
  }

  @Get('delivery-performance')
  @RequirePermissions('sales.reports.view')
  async getDeliveryPerformance(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: FulfillmentReportsQueryDto,
  ) {
    return this.reportsService.getDeliveryPerformance(
      tenant.organizationId,
      query,
    );
  }
}
