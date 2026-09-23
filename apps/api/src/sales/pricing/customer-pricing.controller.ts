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
import {
  CustomerPricingService,
  CustomerPriceWithDetails,
} from './customer-pricing.service';
import { CreateCustomerPriceDto } from './dto/create-customer-price.dto';
import { UpdateCustomerPriceDto } from './dto/update-customer-price.dto';
import { CustomerPriceQueryDto } from './dto/customer-price-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { CustomerPrice } from '@prisma/client';

@Controller('customer-prices')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CustomerPricingController {
  constructor(
    private readonly customerPricingService: CustomerPricingService,
  ) {}

  @Post()
  @RequirePermissions('sales.customer-pricing.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCustomerPriceDto,
  ): Promise<CustomerPrice> {
    return this.customerPricingService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('sales.customer-pricing.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: CustomerPriceQueryDto,
  ): Promise<{
    prices: CustomerPriceWithDetails[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.customerPricingService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('sales.customer-pricing.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CustomerPriceWithDetails> {
    return this.customerPricingService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('sales.customer-pricing.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerPriceDto,
  ): Promise<CustomerPrice> {
    return this.customerPricingService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Delete(':id')
  @RequirePermissions('sales.customer-pricing.manage')
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.customerPricingService.remove(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
