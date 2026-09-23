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
import { TaxesService } from './taxes.service';
import { CreateTaxDto } from './dto/create-tax.dto';
import { UpdateTaxDto } from './dto/update-tax.dto';

@Controller('taxes')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class TaxesController {
  constructor(private readonly taxesService: TaxesService) {}

  @Get()
  @RequirePermissions('master-data.taxes.view')
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
    const data = await this.taxesService.findAll(tenant.organizationId, filter);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('master-data.taxes.view')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.taxesService.findOne(tenant.organizationId, id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('master-data.taxes.manage')
  async create(
    @Body() dto: CreateTaxDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.taxesService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('master-data.taxes.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaxDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.taxesService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('master-data.taxes.manage')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const result = await this.taxesService.archive(
      tenant.organizationId,
      id,
      tenant.userId,
    );
    return { success: true, message: result.message };
  }
}
