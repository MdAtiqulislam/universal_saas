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
} from '@nestjs/common';
import { CustomersService, CustomerWithDetails } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { Customer } from '@prisma/client';

@Controller('customers')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @RequirePermissions('sales.customers.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCustomerDto,
  ): Promise<Customer> {
    return this.customersService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('sales.customers.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: CustomerQueryDto,
  ): Promise<{
    customers: Customer[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.customersService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('sales.customers.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CustomerWithDetails> {
    return this.customersService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('sales.customers.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<Customer> {
    return this.customersService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Delete(':id')
  @RequirePermissions('sales.customers.manage')
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.customersService.softDelete(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
