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
  WarehouseReplenishmentService,
  ReplenishmentRuleWithDetails,
  ReplenishmentTaskWithDetails,
} from './warehouse-replenishment.service';
import {
  CreateReplenishmentRuleDto,
  GenerateReplenishmentDto,
  ReplenishmentQueryDto,
} from './dto/create-replenishment-rule.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/warehouse/replenishment')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class WarehouseReplenishmentController {
  constructor(
    private readonly replenishmentService: WarehouseReplenishmentService,
  ) {}

  @Post('rules')
  @RequirePermissions('warehouse.replenishment.manage')
  @HttpCode(HttpStatus.CREATED)
  async createRule(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateReplenishmentRuleDto,
  ): Promise<ReplenishmentRuleWithDetails> {
    return this.replenishmentService.createRule(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get('rules')
  @RequirePermissions('warehouse.replenishment.view')
  async findAllRules(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ReplenishmentQueryDto,
  ): Promise<ReplenishmentRuleWithDetails[]> {
    return this.replenishmentService.findAllRules(tenant.organizationId, query);
  }

  @Post('generate')
  @RequirePermissions('warehouse.replenishment.manage')
  @HttpCode(HttpStatus.OK)
  async generateTasks(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: GenerateReplenishmentDto,
  ): Promise<ReplenishmentTaskWithDetails[]> {
    return this.replenishmentService.generateTasks(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get('tasks')
  @RequirePermissions('warehouse.replenishment.view')
  async findAllTasks(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ReplenishmentQueryDto,
  ): Promise<ReplenishmentTaskWithDetails[]> {
    return this.replenishmentService.findAllTasks(tenant.organizationId, query);
  }

  @Put('tasks/:id/complete')
  @RequirePermissions('warehouse.replenishment.manage')
  async completeTask(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ReplenishmentTaskWithDetails> {
    return this.replenishmentService.completeTask(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Put('tasks/:id/cancel')
  @RequirePermissions('warehouse.replenishment.manage')
  async cancelTask(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ReplenishmentTaskWithDetails> {
    return this.replenishmentService.cancelTask(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
