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
import { CustomerGroupsService } from './customer-groups.service';
import { CreateCustomerGroupDto } from './dto/create-group.dto';
import { UpdateCustomerGroupDto } from './dto/update-group.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { CustomerGroup } from '@prisma/client';

@Controller('customer-groups')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CustomerGroupsController {
  constructor(private readonly customerGroupsService: CustomerGroupsService) {}

  @Post()
  @RequirePermissions('sales.customer-groups.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCustomerGroupDto,
  ): Promise<CustomerGroup> {
    return this.customerGroupsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('sales.customer-groups.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<{ groups: CustomerGroup[] }> {
    const groups = await this.customerGroupsService.findAll(
      tenant.organizationId,
      includeInactive === 'true',
    );
    return { groups };
  }

  @Get(':id')
  @RequirePermissions('sales.customer-groups.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CustomerGroup> {
    return this.customerGroupsService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('sales.customer-groups.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerGroupDto,
  ): Promise<CustomerGroup> {
    return this.customerGroupsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Delete(':id')
  @RequirePermissions('sales.customer-groups.manage')
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.customerGroupsService.softDelete(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
