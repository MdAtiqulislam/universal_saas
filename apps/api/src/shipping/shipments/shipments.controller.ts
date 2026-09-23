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
import { ShipmentsService, ShipmentWithDetails } from './shipments.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { ShipmentQueryDto } from './dto/shipment-query.dto';
import { AssignCarrierDto } from './dto/assign-carrier.dto';
import { AssignVehicleDto } from './dto/assign-vehicle.dto';
import { DispatchShipmentDto } from './dto/dispatch-shipment.dto';
import { FailShipmentDto } from './dto/fail-shipment.dto';
import { ReturnShipmentDto } from './dto/return-shipment.dto';
import { CancelShipmentDto } from './dto/cancel-shipment.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { Shipment } from '@prisma/client';

@Controller('api/v1/shipping/shipments')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @RequirePermissions('shipping.shipments.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateShipmentDto,
  ): Promise<ShipmentWithDetails> {
    return this.shipmentsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('shipping.shipments.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ShipmentQueryDto,
  ): Promise<{
    shipments: Shipment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.shipmentsService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('shipping.shipments.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ShipmentWithDetails> {
    return this.shipmentsService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('shipping.shipments.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShipmentDto,
  ): Promise<ShipmentWithDetails> {
    return this.shipmentsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/ready')
  @RequirePermissions('shipping.shipments.prepare')
  async prepare(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ShipmentWithDetails> {
    return this.shipmentsService.prepare(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/assign-carrier')
  @RequirePermissions('shipping.shipments.assign')
  async assignCarrier(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignCarrierDto,
  ): Promise<ShipmentWithDetails> {
    return this.shipmentsService.assignCarrier(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/assign-vehicle')
  @RequirePermissions('shipping.shipments.assign')
  async assignVehicle(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignVehicleDto,
  ): Promise<ShipmentWithDetails> {
    return this.shipmentsService.assignVehicle(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/dispatch')
  @RequirePermissions('shipping.shipments.dispatch')
  async dispatch(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DispatchShipmentDto,
  ): Promise<ShipmentWithDetails> {
    return this.shipmentsService.dispatch(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/in-transit')
  @RequirePermissions('shipping.shipments.track')
  async markInTransit(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('notes') notes?: string,
    @Body('location') location?: string,
  ): Promise<ShipmentWithDetails> {
    return this.shipmentsService.markInTransit(
      tenant.organizationId,
      id,
      notes,
      location,
      tenant.userId,
    );
  }

  @Post(':id/deliver')
  @RequirePermissions('shipping.shipments.deliver')
  async markDelivered(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('notes') notes?: string,
    @Body('location') location?: string,
  ): Promise<ShipmentWithDetails> {
    return this.shipmentsService.markDelivered(
      tenant.organizationId,
      id,
      notes,
      location,
      tenant.userId,
    );
  }

  @Post(':id/fail')
  @RequirePermissions('shipping.shipments.return')
  async markFailed(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FailShipmentDto,
  ): Promise<ShipmentWithDetails> {
    return this.shipmentsService.markFailed(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/return')
  @RequirePermissions('shipping.shipments.return')
  async initiateReturn(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnShipmentDto,
  ): Promise<ShipmentWithDetails> {
    return this.shipmentsService.initiateReturn(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/close')
  @RequirePermissions('shipping.shipments.close')
  async close(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ShipmentWithDetails> {
    return this.shipmentsService.close(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/cancel')
  @RequirePermissions('shipping.shipments.cancel')
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelShipmentDto,
  ): Promise<ShipmentWithDetails> {
    return this.shipmentsService.cancel(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }
}
