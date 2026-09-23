import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CustomerRefundsService,
  CustomerRefundWithDetails,
} from './customer-refunds.service';
import { CreateCustomerRefundDto } from './dto/create-customer-refund.dto';
import { CustomerRefundQueryDto } from './dto/customer-refund-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('sales/refunds')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CustomerRefundsController {
  constructor(private readonly refundsService: CustomerRefundsService) {}

  @Get()
  @RequirePermissions('sales.refunds.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: CustomerRefundQueryDto,
  ) {
    return this.refundsService.findAll(tenant.organizationId, query);
  }

  @Post()
  @RequirePermissions('sales.refunds.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCustomerRefundDto,
  ): Promise<CustomerRefundWithDetails> {
    return this.refundsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get(':id')
  @RequirePermissions('sales.refunds.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CustomerRefundWithDetails> {
    return this.refundsService.findOne(tenant.organizationId, id);
  }

  @Post(':id/post')
  @RequirePermissions('sales.refunds.post')
  async post(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CustomerRefundWithDetails> {
    return this.refundsService.post(tenant.organizationId, id, tenant.userId);
  }

  @Post(':id/void')
  @RequirePermissions('sales.refunds.void')
  async void(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CustomerRefundWithDetails> {
    return this.refundsService.void(tenant.organizationId, id, tenant.userId);
  }
}
