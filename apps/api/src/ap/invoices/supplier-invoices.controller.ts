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
  SupplierInvoicesService,
  SupplierInvoiceWithDetails,
} from './supplier-invoices.service';
import {
  AccountsPayableMatchingService,
  MatchingReport,
} from '../matching/accounts-payable-matching.service';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';
import { UpdateSupplierInvoiceDto } from './dto/update-supplier-invoice.dto';
import { SupplierInvoiceQueryDto } from './dto/supplier-invoice-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { SupplierInvoice } from '@prisma/client';

@Controller('ap/invoices')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class SupplierInvoicesController {
  constructor(
    private readonly invoicesService: SupplierInvoicesService,
    private readonly matchingService: AccountsPayableMatchingService,
  ) {}

  @Get()
  @RequirePermissions('ap.invoices.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SupplierInvoiceQueryDto,
  ): Promise<{
    invoices: SupplierInvoice[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.invoicesService.findAll(tenant.organizationId, query);
  }

  @Post()
  @RequirePermissions('ap.invoices.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateSupplierInvoiceDto,
  ): Promise<SupplierInvoiceWithDetails> {
    return this.invoicesService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get(':id')
  @RequirePermissions('ap.invoices.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<SupplierInvoiceWithDetails> {
    return this.invoicesService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('ap.invoices.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierInvoiceDto,
  ): Promise<SupplierInvoiceWithDetails> {
    return this.invoicesService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Delete(':id')
  @RequirePermissions('ap.invoices.manage')
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.invoicesService.remove(tenant.organizationId, id);
  }

  @Post(':id/submit')
  @RequirePermissions('ap.invoices.submit')
  async submit(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<SupplierInvoiceWithDetails> {
    return this.invoicesService.submit(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/approve')
  @RequirePermissions('ap.invoices.approve')
  async approve(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<SupplierInvoiceWithDetails> {
    return this.invoicesService.approve(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/post')
  @RequirePermissions('ap.invoices.post')
  async post(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<SupplierInvoiceWithDetails> {
    return this.invoicesService.post(tenant.organizationId, id, tenant.userId);
  }

  @Post(':id/cancel')
  @RequirePermissions('ap.invoices.cancel')
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<SupplierInvoiceWithDetails> {
    return this.invoicesService.cancel(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/void')
  @RequirePermissions('ap.invoices.void')
  async void(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<SupplierInvoiceWithDetails> {
    return this.invoicesService.void(tenant.organizationId, id, tenant.userId);
  }

  @Get(':id/matching')
  @RequirePermissions('ap.matching.view')
  async getMatching(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<MatchingReport> {
    return this.matchingService.matchInvoice(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
