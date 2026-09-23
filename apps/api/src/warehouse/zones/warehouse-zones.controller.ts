import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  WarehouseZonesService,
  WarehouseZoneWithLocation,
} from './warehouse-zones.service';
import { CreateWarehouseZoneDto } from './dto/create-zone.dto';
import { UpdateWarehouseZoneDto } from './dto/update-zone.dto';
import { WarehouseZoneQueryDto } from './dto/zone-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/warehouse/zones')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class WarehouseZonesController {
  constructor(private readonly zonesService: WarehouseZonesService) {}

  @Post()
  @RequirePermissions('warehouse.locations.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateWarehouseZoneDto,
  ): Promise<WarehouseZoneWithLocation> {
    return this.zonesService.create(tenant.organizationId, dto, tenant.userId);
  }

  @Get()
  @RequirePermissions('warehouse.locations.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: WarehouseZoneQueryDto,
  ): Promise<{
    data: WarehouseZoneWithLocation[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.zonesService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('warehouse.locations.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<WarehouseZoneWithLocation> {
    return this.zonesService.findOne(tenant.organizationId, id);
  }

  @Put(':id')
  @RequirePermissions('warehouse.locations.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseZoneDto,
  ): Promise<WarehouseZoneWithLocation> {
    return this.zonesService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }
}
