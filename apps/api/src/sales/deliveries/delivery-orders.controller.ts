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
  DeliveryOrdersService,
  DeliveryOrderWithDetails,
} from './delivery-orders.service';
import { CreateDeliveryOrderDto } from './dto/create-delivery.dto';
import { UpdateDeliveryOrderDto } from './dto/update-delivery.dto';
import { DeliveryOrderQueryDto } from './dto/delivery-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { DeliveryOrder } from '@prisma/client';

@Controller('api/v1/sales/deliveries')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class DeliveryOrdersController {
  constructor(private readonly deliveryOrdersService: DeliveryOrdersService) {}

  @Post()
  @RequirePermissions('sales.deliveries.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateDeliveryOrderDto,
  ): Promise<DeliveryOrderWithDetails> {
    return this.deliveryOrdersService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('sales.deliveries.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: DeliveryOrderQueryDto,
  ): Promise<{
    deliveries: DeliveryOrder[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.deliveryOrdersService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('sales.deliveries.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeliveryOrderWithDetails> {
    return this.deliveryOrdersService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('sales.deliveries.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryOrderDto,
  ): Promise<DeliveryOrderWithDetails> {
    return this.deliveryOrdersService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/ready')
  @RequirePermissions('sales.deliveries.manage')
  async ready(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeliveryOrderWithDetails> {
    return this.deliveryOrdersService.ready(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/pick')
  @RequirePermissions('sales.deliveries.pick')
  async pick(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeliveryOrderWithDetails> {
    return this.deliveryOrdersService.pick(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/dispatch')
  @RequirePermissions('sales.deliveries.dispatch')
  async dispatch(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeliveryOrderWithDetails> {
    return this.deliveryOrdersService.dispatch(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/ship')
  @RequirePermissions('sales.deliveries.ship')
  async ship(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeliveryOrderWithDetails> {
    return this.deliveryOrdersService.ship(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/execute')
  @RequirePermissions('sales.deliveries.execute')
  async execute(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeliveryOrderWithDetails> {
    return this.deliveryOrdersService.executeDelivery(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/deliver')
  @RequirePermissions('sales.deliveries.deliver')
  async deliver(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeliveryOrderWithDetails> {
    return this.deliveryOrdersService.deliver(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/cancel')
  @RequirePermissions('sales.deliveries.cancel')
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ): Promise<DeliveryOrderWithDetails> {
    return this.deliveryOrdersService.cancel(
      tenant.organizationId,
      id,
      reason,
      tenant.userId,
    );
  }
}
