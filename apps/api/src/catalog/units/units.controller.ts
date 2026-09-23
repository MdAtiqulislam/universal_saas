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
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Controller('catalog/units')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  @RequirePermissions('catalog.units.view')
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    const filter = {
      isActive:
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search,
    };
    const data = await this.unitsService.findAll(tenant.organizationId, filter);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('catalog.units.view')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.unitsService.findOne(tenant.organizationId, id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('catalog.units.manage')
  async create(
    @Body() dto: CreateUnitDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.unitsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('catalog.units.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnitDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.unitsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('catalog.units.manage')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const result = await this.unitsService.deactivate(
      tenant.organizationId,
      id,
      tenant.userId,
    );
    return { success: true, message: result.message };
  }
}
