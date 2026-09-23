import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { SupplierAddressesService } from './supplier-addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Controller('suppliers/:supplierId/addresses')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class SupplierAddressesController {
  constructor(private readonly addressesService: SupplierAddressesService) {}

  @Get()
  @RequirePermissions('purchasing.suppliers.view')
  async list(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.addressesService.findAll(
      tenant.organizationId,
      supplierId,
    );
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('purchasing.suppliers.manage')
  async create(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Body() dto: CreateAddressDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.addressesService.create(
      tenant.organizationId,
      supplierId,
      dto,
      tenant.userId,
    );
    return { success: true, data, message: 'Address added successfully' };
  }

  @Patch(':addressId')
  @RequirePermissions('purchasing.suppliers.manage')
  async update(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateAddressDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.addressesService.update(
      tenant.organizationId,
      supplierId,
      addressId,
      dto,
      tenant.userId,
    );
    return { success: true, data, message: 'Address updated successfully' };
  }

  @Delete(':addressId')
  @RequirePermissions('purchasing.suppliers.manage')
  async delete(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const result = await this.addressesService.remove(
      tenant.organizationId,
      supplierId,
      addressId,
      tenant.userId,
    );
    return result;
  }
}
