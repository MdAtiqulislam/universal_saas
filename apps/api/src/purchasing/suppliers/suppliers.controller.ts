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
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierQueryDto } from './dto/supplier-query.dto';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @RequirePermissions('purchasing.suppliers.view')
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SupplierQueryDto,
  ) {
    const data = await this.suppliersService.findAll(
      tenant.organizationId,
      query,
    );
    return { success: true, ...data };
  }

  @Get(':id')
  @RequirePermissions('purchasing.suppliers.view')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.suppliersService.findOne(tenant.organizationId, id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('purchasing.suppliers.manage')
  async create(
    @Body() dto: CreateSupplierDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.suppliersService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
    return { success: true, data, message: 'Supplier created successfully' };
  }

  @Patch(':id')
  @RequirePermissions('purchasing.suppliers.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.suppliersService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
    return { success: true, data, message: 'Supplier updated successfully' };
  }

  @Delete(':id')
  @RequirePermissions('purchasing.suppliers.manage')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const result = await this.suppliersService.softDelete(
      tenant.organizationId,
      id,
      tenant.userId,
    );
    return result;
  }
}
