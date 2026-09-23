import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QuotationsService, QuotationWithDetails } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationQueryDto } from './dto/quotation-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { Quotation } from '@prisma/client';

@Controller('quotations')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Post()
  @RequirePermissions('sales.quotations.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateQuotationDto,
  ): Promise<QuotationWithDetails> {
    return this.quotationsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('sales.quotations.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QuotationQueryDto,
  ): Promise<{
    quotations: Quotation[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.quotationsService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('sales.quotations.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<QuotationWithDetails> {
    return this.quotationsService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('sales.quotations.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateQuotationDto,
  ): Promise<QuotationWithDetails> {
    return this.quotationsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/send')
  @RequirePermissions('sales.quotations.send')
  async send(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<QuotationWithDetails> {
    return this.quotationsService.send(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/accept')
  @RequirePermissions('sales.quotations.accept')
  async accept(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<QuotationWithDetails> {
    return this.quotationsService.accept(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/reject')
  @RequirePermissions('sales.quotations.reject')
  async reject(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<QuotationWithDetails> {
    return this.quotationsService.reject(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/cancel')
  @RequirePermissions('sales.quotations.cancel')
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<QuotationWithDetails> {
    return this.quotationsService.cancel(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/convert')
  @RequirePermissions('sales.quotations.manage')
  async convert(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<any> {
    return this.quotationsService.convert(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
