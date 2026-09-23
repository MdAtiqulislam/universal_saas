import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  SalesOrdersService,
  SalesOrderWithDetails,
} from './sales-orders.service';
import { CreateSalesOrderDto } from './dto/create-order.dto';
import { UpdateSalesOrderDto } from './dto/update-order.dto';
import { SalesOrderQueryDto } from './dto/order-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { SalesOrder } from '@prisma/client';

@Controller('api/v1/sales/orders')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class SalesOrdersController {
  constructor(private readonly salesOrdersService: SalesOrdersService) {}

  @Post()
  @RequirePermissions('sales.orders.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateSalesOrderDto,
  ): Promise<SalesOrderWithDetails> {
    return this.salesOrdersService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('sales.orders.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SalesOrderQueryDto,
  ): Promise<{
    orders: SalesOrder[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.salesOrdersService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('sales.orders.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalesOrderWithDetails> {
    return this.salesOrdersService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('sales.orders.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalesOrderDto,
  ): Promise<SalesOrderWithDetails> {
    return this.salesOrdersService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/submit')
  @RequirePermissions('sales.orders.submit')
  async submit(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalesOrderWithDetails> {
    return this.salesOrdersService.submit(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/approve')
  @RequirePermissions('sales.orders.approve')
  async approve(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalesOrderWithDetails> {
    return this.salesOrdersService.approve(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/reject')
  @RequirePermissions('sales.orders.manage')
  async reject(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ): Promise<SalesOrderWithDetails> {
    return this.salesOrdersService.reject(
      tenant.organizationId,
      id,
      reason,
      tenant.userId,
    );
  }

  @Post(':id/confirm')
  @RequirePermissions('sales.orders.confirm')
  async confirm(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalesOrderWithDetails> {
    return this.salesOrdersService.confirm(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Get(':id/availability')
  @RequirePermissions('sales.orders.view')
  async checkAvailability(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesOrdersService.checkAvailability(tenant.organizationId, id);
  }

  @Post(':id/allocate')
  @RequirePermissions('sales.orders.allocate')
  async allocate(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalesOrderWithDetails> {
    return this.salesOrdersService.allocate(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/release-allocation')
  @RequirePermissions('sales.orders.allocate')
  async releaseAllocation(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalesOrderWithDetails> {
    return this.salesOrdersService.releaseAllocation(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Get(':id/financial-summary')
  @RequirePermissions('sales.orders.view')
  async getFinancialSummary(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesOrdersService.getFinancialSummary(
      tenant.organizationId,
      id,
    );
  }

  @Post(':id/invoice')
  @RequirePermissions('sales.orders.manage')
  async invoice(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesOrdersService.invoice(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/cancel')
  @RequirePermissions('sales.orders.cancel')
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ): Promise<SalesOrderWithDetails> {
    return this.salesOrdersService.cancel(
      tenant.organizationId,
      id,
      reason,
      tenant.userId,
    );
  }

  @Post(':id/close')
  @RequirePermissions('sales.orders.close')
  async close(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalesOrderWithDetails> {
    return this.salesOrdersService.close(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
