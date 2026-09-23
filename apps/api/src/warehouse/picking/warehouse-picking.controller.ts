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
  WarehousePickingService,
  PickTaskWithDetails,
} from './warehouse-picking.service';
import {
  CreatePickTaskDto,
  AssignPickTaskDto,
  ExecutePickTaskDto,
  PickQueryDto,
} from './dto/create-pick.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/warehouse/picks')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class WarehousePickingController {
  constructor(private readonly pickingService: WarehousePickingService) {}

  @Post()
  @RequirePermissions('warehouse.picking.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePickTaskDto,
  ): Promise<PickTaskWithDetails> {
    return this.pickingService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('warehouse.picking.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PickQueryDto,
  ): Promise<{
    data: PickTaskWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.pickingService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('warehouse.picking.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<PickTaskWithDetails> {
    return this.pickingService.findOne(tenant.organizationId, id);
  }

  @Put(':id/assign')
  @RequirePermissions('warehouse.picking.manage')
  async assign(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: AssignPickTaskDto,
  ): Promise<PickTaskWithDetails> {
    return this.pickingService.assign(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Put(':id/start')
  @RequirePermissions('warehouse.picking.manage')
  async start(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<PickTaskWithDetails> {
    return this.pickingService.start(tenant.organizationId, id, tenant.userId);
  }

  @Put(':id/execute')
  @RequirePermissions('warehouse.picking.execute')
  async executePick(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: ExecutePickTaskDto,
  ): Promise<PickTaskWithDetails> {
    return this.pickingService.executePick(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Put(':id/cancel')
  @RequirePermissions('warehouse.picking.manage')
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<PickTaskWithDetails> {
    return this.pickingService.cancel(tenant.organizationId, id, tenant.userId);
  }
}
