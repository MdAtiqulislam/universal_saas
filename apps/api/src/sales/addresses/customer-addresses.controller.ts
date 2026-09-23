import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CustomerAddressesService } from './customer-addresses.service';
import { CreateCustomerAddressDto } from './dto/create-address.dto';
import { UpdateCustomerAddressDto } from './dto/update-address.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { CustomerAddress } from '@prisma/client';

@Controller('customers/:customerId/addresses')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CustomerAddressesController {
  constructor(
    private readonly customerAddressesService: CustomerAddressesService,
  ) {}

  @Post()
  @RequirePermissions('sales.customers.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Param('customerId') customerId: string,
    @Body() dto: CreateCustomerAddressDto,
  ): Promise<CustomerAddress> {
    return this.customerAddressesService.create(
      tenant.organizationId,
      customerId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('sales.customers.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Param('customerId') customerId: string,
  ): Promise<{ addresses: CustomerAddress[] }> {
    const addresses = await this.customerAddressesService.findAll(
      tenant.organizationId,
      customerId,
    );
    return { addresses };
  }

  @Patch(':addressId')
  @RequirePermissions('sales.customers.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('customerId') customerId: string,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateCustomerAddressDto,
  ): Promise<CustomerAddress> {
    return this.customerAddressesService.update(
      tenant.organizationId,
      customerId,
      addressId,
      dto,
      tenant.userId,
    );
  }

  @Delete(':addressId')
  @RequirePermissions('sales.customers.manage')
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('customerId') customerId: string,
    @Param('addressId') addressId: string,
  ): Promise<{ success: boolean }> {
    return this.customerAddressesService.remove(
      tenant.organizationId,
      customerId,
      addressId,
      tenant.userId,
    );
  }
}
