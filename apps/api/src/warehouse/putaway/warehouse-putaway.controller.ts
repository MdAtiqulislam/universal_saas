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
  WarehousePutawayService,
  PutawayTaskWithDetails,
} from './warehouse-putaway.service';
import {
  CreatePutawayTaskDto,
  AssignPutawayTaskDto,
  CompletePutawayTaskDto,
  PutawayQueryDto,
} from './dto/create-putaway.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/warehouse/putaway')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class WarehousePutawayController {
  constructor(private readonly putawayService: WarehousePutawayService) {}

  @Post()
  @RequirePermissions('warehouse.putaway.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePutawayTaskDto,
  ): Promise<PutawayTaskWithDetails> {
    return this.putawayService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('warehouse.putaway.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PutawayQueryDto,
  ): Promise<{
    data: PutawayTaskWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.putawayService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('warehouse.putaway.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<PutawayTaskWithDetails> {
    return this.putawayService.findOne(tenant.organizationId, id);
  }

  @Put(':id/assign')
  @RequirePermissions('warehouse.putaway.manage')
  async assign(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: AssignPutawayTaskDto,
  ): Promise<PutawayTaskWithDetails> {
    return this.putawayService.assign(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Put(':id/start')
  @RequirePermissions('warehouse.putaway.manage')
  async start(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<PutawayTaskWithDetails> {
    return this.putawayService.start(tenant.organizationId, id, tenant.userId);
  }

  @Put(':id/complete')
  @RequirePermissions('warehouse.putaway.execute')
  async complete(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: CompletePutawayTaskDto,
  ): Promise<PutawayTaskWithDetails> {
    return this.putawayService.complete(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Put(':id/cancel')
  @RequirePermissions('warehouse.putaway.manage')
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<PutawayTaskWithDetails> {
    return this.putawayService.cancel(tenant.organizationId, id, tenant.userId);
  }
}
