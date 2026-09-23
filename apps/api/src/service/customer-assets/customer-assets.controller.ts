import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CustomerAssetsService } from './customer-assets.service';
import {
  CreateCustomerAssetDto,
  UpdateCustomerAssetDto,
  QueryCustomerAssetDto,
} from '../dto/customer-asset.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/service/customer-assets')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CustomerAssetsController {
  constructor(private readonly customerAssetsService: CustomerAssetsService) {}

  @Get()
  @RequirePermissions('service.customer-assets.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryCustomerAssetDto,
  ) {
    return this.customerAssetsService.findAll(tenant.organizationId, query);
  }

  @Post()
  @RequirePermissions('service.customer-assets.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCustomerAssetDto,
  ) {
    return this.customerAssetsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get(':id')
  @RequirePermissions('service.customer-assets.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customerAssetsService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('service.customer-assets.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerAssetDto,
  ) {
    return this.customerAssetsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Get(':id/history')
  @RequirePermissions('service.customer-assets.view')
  async getServiceHistory(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customerAssetsService.getServiceHistory(
      tenant.organizationId,
      id,
    );
  }
}
