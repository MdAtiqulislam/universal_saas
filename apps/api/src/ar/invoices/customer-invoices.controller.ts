import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  CustomerInvoicesService,
  CustomerInvoiceWithDetails,
} from './customer-invoices.service';
import { CreateCustomerInvoiceDto } from './dto/create-customer-invoice.dto';
import { UpdateCustomerInvoiceDto } from './dto/update-customer-invoice.dto';
import { CustomerInvoiceQueryDto } from './dto/customer-invoice-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { CustomerInvoice } from '@prisma/client';

@Controller('customer-invoices')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CustomerInvoicesController {
  constructor(private readonly invoicesService: CustomerInvoicesService) {}

  @Get()
  @RequirePermissions('sales.invoices.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: CustomerInvoiceQueryDto,
  ): Promise<{
    invoices: CustomerInvoice[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.invoicesService.findAll(tenant.organizationId, query);
  }

  @Post()
  @RequirePermissions('sales.invoices.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCustomerInvoiceDto,
  ): Promise<CustomerInvoiceWithDetails> {
    return this.invoicesService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Post('from-sales-order/:salesOrderId')
  @RequirePermissions('sales.invoices.manage')
  async createFromSalesOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('salesOrderId') salesOrderId: string,
  ): Promise<CustomerInvoiceWithDetails> {
    return this.invoicesService.createFromSalesOrder(
      tenant.organizationId,
      salesOrderId,
      tenant.userId,
    );
  }

  @Post('from-delivery-order/:deliveryOrderId')
  @RequirePermissions('sales.invoices.manage')
  async createFromDeliveryOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('deliveryOrderId') deliveryOrderId: string,
  ): Promise<CustomerInvoiceWithDetails> {
    return this.invoicesService.createFromDeliveryOrder(
      tenant.organizationId,
      deliveryOrderId,
      tenant.userId,
    );
  }

  @Get(':id')
  @RequirePermissions('sales.invoices.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CustomerInvoiceWithDetails> {
    return this.invoicesService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('sales.invoices.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerInvoiceDto,
  ): Promise<CustomerInvoiceWithDetails> {
    return this.invoicesService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Delete(':id')
  @RequirePermissions('sales.invoices.manage')
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.invoicesService.remove(tenant.organizationId, id);
  }

  @Post(':id/issue')
  @RequirePermissions('sales.invoices.issue')
  async issue(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CustomerInvoiceWithDetails> {
    return this.invoicesService.issue(tenant.organizationId, id, tenant.userId);
  }

  @Post(':id/void')
  @RequirePermissions('sales.invoices.void')
  async void(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CustomerInvoiceWithDetails> {
    return this.invoicesService.void(tenant.organizationId, id, tenant.userId);
  }

  @Post(':id/cancel')
  @RequirePermissions('sales.invoices.manage')
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CustomerInvoiceWithDetails> {
    return this.invoicesService.cancel(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
