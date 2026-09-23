import {
  Controller,
  Get,
  Post,
  Patch,
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
import { PurchaseCostsService } from './purchase-costs.service';
import { CreatePurchaseCostDto } from './dto/create-cost.dto';
import { UpdatePurchaseCostDto } from './dto/update-cost.dto';
import { PurchaseCostQueryDto } from './dto/cost-query.dto';

@Controller('purchase-costs')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class PurchaseCostsController {
  constructor(private readonly costsService: PurchaseCostsService) {}

  @Get()
  @RequirePermissions('purchasing.costs.view')
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PurchaseCostQueryDto,
  ) {
    const data = await this.costsService.findAll(tenant.organizationId, query);
    return { success: true, ...data };
  }

  @Get(':id')
  @RequirePermissions('purchasing.costs.view')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.costsService.findOne(tenant.organizationId, id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('purchasing.costs.manage')
  async create(
    @Body() dto: CreatePurchaseCostDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.costsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
    return {
      success: true,
      data,
      message: 'Purchase cost allocation created successfully',
    };
  }

  @Patch(':id')
  @RequirePermissions('purchasing.costs.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseCostDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.costsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
    return {
      success: true,
      data,
      message: 'Purchase cost allocation updated successfully',
    };
  }
}
