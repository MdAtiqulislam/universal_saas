import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  WarehouseCountsService,
  CycleCountWithDetails,
} from './warehouse-counts.service';
import {
  CreateCycleCountDto,
  RecordCountDto,
  RecountDto,
  CycleCountQueryDto,
} from './dto/create-count.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/warehouse/counts')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class WarehouseCountsController {
  constructor(private readonly countsService: WarehouseCountsService) {}

  @Post()
  @RequirePermissions('warehouse.counts.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCycleCountDto,
  ): Promise<CycleCountWithDetails> {
    return this.countsService.create(tenant.organizationId, dto, tenant.userId);
  }

  @Get()
  @RequirePermissions('warehouse.counts.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: CycleCountQueryDto,
  ): Promise<{
    data: CycleCountWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.countsService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('warehouse.counts.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CycleCountWithDetails> {
    return this.countsService.findOne(tenant.organizationId, id);
  }

  @Put(':id/start')
  @RequirePermissions('warehouse.counts.manage')
  async start(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CycleCountWithDetails> {
    return this.countsService.start(tenant.organizationId, id, tenant.userId);
  }

  @Put(':id/record')
  @RequirePermissions('warehouse.counts.manage')
  async recordCount(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: RecordCountDto,
  ): Promise<CycleCountWithDetails> {
    return this.countsService.recordCount(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Put(':id/recount')
  @RequirePermissions('warehouse.counts.manage')
  async recount(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: RecountDto,
  ): Promise<CycleCountWithDetails> {
    return this.countsService.recount(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Put(':id/review')
  @RequirePermissions('warehouse.counts.review')
  async review(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CycleCountWithDetails> {
    return this.countsService.review(tenant.organizationId, id, tenant.userId);
  }

  @Put(':id/post')
  @RequirePermissions('warehouse.counts.post')
  async post(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CycleCountWithDetails> {
    return this.countsService.post(tenant.organizationId, id, tenant.userId);
  }

  @Put(':id/cancel')
  @RequirePermissions('warehouse.counts.manage')
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CycleCountWithDetails> {
    return this.countsService.cancel(tenant.organizationId, id, tenant.userId);
  }
}
