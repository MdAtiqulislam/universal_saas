import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-order.dto';
import { PurchaseOrderQueryDto } from './dto/order-query.dto';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class PurchaseOrdersController {
  constructor(private readonly ordersService: PurchaseOrdersService) {}

  @Get()
  @RequirePermissions('purchasing.orders.view')
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PurchaseOrderQueryDto,
  ) {
    const data = await this.ordersService.findAll(tenant.organizationId, query);
    return { success: true, ...data };
  }

  @Get(':id')
  @RequirePermissions('purchasing.orders.view')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.ordersService.findOne(tenant.organizationId, id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('purchasing.orders.manage')
  async create(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.ordersService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
    return {
      success: true,
      data,
      message: 'Purchase order draft created successfully',
    };
  }

  @Patch(':id')
  @RequirePermissions('purchasing.orders.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.ordersService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
    return {
      success: true,
      data,
      message: 'Purchase order draft updated successfully',
    };
  }

  @Post(':id/submit')
  @RequirePermissions('purchasing.orders.submit')
  async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.ordersService.submit(
      tenant.organizationId,
      id,
      tenant.userId,
    );
    return {
      success: true,
      data,
      message: 'Purchase order submitted successfully',
    };
  }

  @Post(':id/approve')
  @RequirePermissions('purchasing.orders.approve')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.ordersService.approve(
      tenant.organizationId,
      id,
      tenant.userId,
    );
    return {
      success: true,
      data,
      message: 'Purchase order approved successfully',
    };
  }

  @Post(':id/cancel')
  @RequirePermissions('purchasing.orders.cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.ordersService.cancel(
      tenant.organizationId,
      id,
      reason,
      tenant.userId,
    );
    return {
      success: true,
      data,
      message: 'Purchase order cancelled successfully',
    };
  }

  @Post(':id/close')
  @RequirePermissions('purchasing.orders.manage')
  async close(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.ordersService.close(
      tenant.organizationId,
      id,
      tenant.userId,
    );
    return {
      success: true,
      data,
      message: 'Purchase order closed successfully',
    };
  }
}
