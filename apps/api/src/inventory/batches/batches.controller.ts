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
import { BatchesService } from './batches.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';

@Controller('inventory/batches')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get()
  @RequirePermissions('inventory.batches.view')
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query('itemId') itemId?: string,
    @Query('locationId') locationId?: string,
    @Query('search') search?: string,
    @Query('expiredOnly') expiredOnly?: string,
  ) {
    const filter = {
      itemId,
      locationId,
      search,
      expiredOnly: expiredOnly === 'true',
    };
    const data = await this.batchesService.findAll(
      tenant.organizationId,
      filter,
    );
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('inventory.batches.view')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.batchesService.findOne(tenant.organizationId, id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('inventory.batches.manage')
  async create(
    @Body() dto: CreateBatchDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.batchesService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('inventory.batches.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBatchDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.batchesService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }
}
