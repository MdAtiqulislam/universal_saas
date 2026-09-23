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
  WarehouseTasksService,
  WarehouseTaskWithWarehouse,
} from './warehouse-tasks.service';
import {
  CreateWarehouseTaskDto,
  AssignWarehouseTaskDto,
  WarehouseTaskQueryDto,
} from './dto/create-task.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/warehouse/tasks')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class WarehouseTasksController {
  constructor(private readonly tasksService: WarehouseTasksService) {}

  @Post()
  @RequirePermissions('warehouse.tasks.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateWarehouseTaskDto,
  ): Promise<WarehouseTaskWithWarehouse> {
    return this.tasksService.create(tenant.organizationId, dto, tenant.userId);
  }

  @Get()
  @RequirePermissions('warehouse.tasks.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: WarehouseTaskQueryDto,
  ): Promise<{
    data: WarehouseTaskWithWarehouse[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.tasksService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('warehouse.tasks.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<WarehouseTaskWithWarehouse> {
    return this.tasksService.findOne(tenant.organizationId, id);
  }

  @Put(':id/assign')
  @RequirePermissions('warehouse.tasks.manage')
  async assign(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: AssignWarehouseTaskDto,
  ): Promise<WarehouseTaskWithWarehouse> {
    return this.tasksService.assign(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Put(':id/start')
  @RequirePermissions('warehouse.tasks.manage')
  async start(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<WarehouseTaskWithWarehouse> {
    return this.tasksService.start(tenant.organizationId, id, tenant.userId);
  }

  @Put(':id/complete')
  @RequirePermissions('warehouse.tasks.manage')
  async complete(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<WarehouseTaskWithWarehouse> {
    return this.tasksService.complete(tenant.organizationId, id, tenant.userId);
  }

  @Put(':id/cancel')
  @RequirePermissions('warehouse.tasks.manage')
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<WarehouseTaskWithWarehouse> {
    return this.tasksService.cancel(tenant.organizationId, id, tenant.userId);
  }
}
