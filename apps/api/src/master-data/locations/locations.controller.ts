import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Controller('locations')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @RequirePermissions('master-data.locations.view')
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query('isActive') isActive?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    const filter = {
      isActive:
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      type,
      search,
    };
    const data = await this.locationsService.findAll(
      tenant.organizationId,
      filter,
    );
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('master-data.locations.view')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.locationsService.findOne(tenant.organizationId, id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('master-data.locations.manage')
  async create(
    @Body() dto: CreateLocationDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.locationsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('master-data.locations.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLocationDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.locationsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('master-data.locations.manage')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const result = await this.locationsService.softDelete(
      tenant.organizationId,
      id,
      tenant.userId,
    );
    return { success: true, message: result.message };
  }
}
