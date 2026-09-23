import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ShipmentCarriersService } from './shipment-carriers.service';
import { CreateCarrierDto } from './dto/create-carrier.dto';
import { UpdateCarrierDto } from './dto/update-carrier.dto';
import { CarrierQueryDto } from './dto/carrier-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { ShipmentCarrier } from '@prisma/client';

@Controller('api/v1/shipping/carriers')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ShipmentCarriersController {
  constructor(private readonly carriersService: ShipmentCarriersService) {}

  @Post()
  @RequirePermissions('shipping.carriers.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCarrierDto,
  ): Promise<ShipmentCarrier> {
    return this.carriersService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('shipping.carriers.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: CarrierQueryDto,
  ): Promise<{
    carriers: ShipmentCarrier[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.carriersService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('shipping.carriers.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ShipmentCarrier> {
    return this.carriersService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('shipping.carriers.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCarrierDto,
  ): Promise<ShipmentCarrier> {
    return this.carriersService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/activate')
  @RequirePermissions('shipping.carriers.manage')
  async activate(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ShipmentCarrier> {
    return this.carriersService.activate(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/deactivate')
  @RequirePermissions('shipping.carriers.manage')
  async deactivate(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ShipmentCarrier> {
    return this.carriersService.deactivate(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Delete(':id')
  @RequirePermissions('shipping.carriers.manage')
  async delete(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.carriersService.delete(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
