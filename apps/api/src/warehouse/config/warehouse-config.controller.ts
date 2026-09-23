import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import {
  WarehouseConfigService,
  WarehouseConfigWithLocations,
} from './warehouse-config.service';
import { UpdateWarehouseConfigDto } from './dto/update-warehouse-config.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/warehouse/configuration')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class WarehouseConfigController {
  constructor(private readonly configService: WarehouseConfigService) {}

  @Get()
  @RequirePermissions('warehouse.view')
  async getConfig(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<WarehouseConfigWithLocations> {
    return this.configService.getConfig(tenant.organizationId);
  }

  @Put()
  @RequirePermissions('warehouse.manage')
  async updateConfig(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateWarehouseConfigDto,
  ): Promise<WarehouseConfigWithLocations> {
    return this.configService.updateConfig(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }
}
