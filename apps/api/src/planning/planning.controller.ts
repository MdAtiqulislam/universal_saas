import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../organizations/interfaces/tenant-context.interface';

import { PlanningConfigService } from './planning-config.service';
import { PlanningRunsService } from './planning-runs.service';
import { PlannedOrdersService } from './planned-orders.service';
import { PlanningReportsService } from './planning-reports.service';

import { CreatePlanningRunDto } from './dto/create-planning-run.dto';
import { UpdatePlanningConfigDto } from './dto/update-planning-config.dto';
import { CreateItemPlanningProfileDto } from './dto/create-item-planning-profile.dto';
import {
  PlanningRunQueryDto,
  PlannedOrderQueryDto,
  PlanningReportsQueryDto,
} from './dto/planning-query.dto';
import { PlannedOrderStatus } from '@prisma/client';

@Controller('api/v1/planning')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class PlanningController {
  constructor(
    private readonly configService: PlanningConfigService,
    private readonly runsService: PlanningRunsService,
    private readonly plannedOrdersService: PlannedOrdersService,
    private readonly reportsService: PlanningReportsService,
  ) {}

  // ----------------------------------------------------
  // Configuration & Item Profiles
  // ----------------------------------------------------

  @Get('configuration')
  @RequirePermissions('planning.configuration.view')
  async getConfiguration(@CurrentTenant() tenant: TenantContext) {
    return this.configService.getConfig(tenant.organizationId);
  }

  @Patch('configuration')
  @RequirePermissions('planning.configuration.manage')
  async updateConfiguration(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdatePlanningConfigDto,
  ) {
    return this.configService.updateConfig(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get('profiles')
  @RequirePermissions('planning.configuration.view')
  async listItemProfiles(@CurrentTenant() tenant: TenantContext) {
    return this.configService.listItemProfiles(tenant.organizationId);
  }

  @Post('profiles')
  @RequirePermissions('planning.configuration.manage')
  async upsertItemProfile(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateItemPlanningProfileDto,
  ) {
    return this.configService.upsertItemProfile(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Delete('profiles/:id')
  @RequirePermissions('planning.configuration.manage')
  async deleteItemProfile(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.configService.deleteItemProfile(tenant.organizationId, id);
  }

  // ----------------------------------------------------
  // Planning Runs
  // ----------------------------------------------------

  @Post('runs')
  @RequirePermissions('planning.runs.manage')
  async createRun(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePlanningRunDto,
  ) {
    return this.runsService.create(tenant.organizationId, dto, tenant.userId);
  }

  @Get('runs')
  @RequirePermissions('planning.runs.view')
  async listRuns(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PlanningRunQueryDto,
  ) {
    return this.runsService.findAll(tenant.organizationId, query);
  }

  @Get('runs/:id')
  @RequirePermissions('planning.runs.view')
  async getRun(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.runsService.findOne(tenant.organizationId, id);
  }

  @Post('runs/:id/execute')
  @RequirePermissions('planning.runs.execute')
  async executeRun(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.runsService.execute(tenant.organizationId, id, tenant.userId);
  }

  @Post('runs/:id/cancel')
  @RequirePermissions('planning.runs.manage')
  async cancelRun(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.runsService.cancel(tenant.organizationId, id, tenant.userId);
  }

  // ----------------------------------------------------
  // Planned Orders / Recommendations
  // ----------------------------------------------------

  @Get('planned-orders')
  @RequirePermissions('planning.planned-orders.view')
  async listPlannedOrders(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PlannedOrderQueryDto,
  ) {
    return this.plannedOrdersService.findAll(tenant.organizationId, query);
  }

  @Get('planned-orders/:id')
  @RequirePermissions('planning.planned-orders.view')
  async getPlannedOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.plannedOrdersService.findOne(tenant.organizationId, id);
  }

  @Patch('planned-orders/:id/status')
  @RequirePermissions('planning.runs.manage')
  async updatePlannedOrderStatus(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body('status') status: PlannedOrderStatus,
  ) {
    return this.plannedOrdersService.updateStatus(
      tenant.organizationId,
      id,
      status,
      tenant.userId,
    );
  }

  // ----------------------------------------------------
  // Reports
  // ----------------------------------------------------

  @Get('reports/summary')
  @RequirePermissions('planning.reports.view')
  async getSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PlanningReportsQueryDto,
  ) {
    return this.reportsService.getSummary(tenant.organizationId, query);
  }

  @Get('reports/material-requirements')
  @RequirePermissions('planning.reports.view')
  async getMaterialRequirements(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PlanningReportsQueryDto,
  ) {
    return this.reportsService.getMaterialRequirements(
      tenant.organizationId,
      query,
    );
  }

  @Get('reports/supply-demand')
  @RequirePermissions('planning.reports.view')
  async getSupplyDemand(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PlanningReportsQueryDto,
  ) {
    return this.reportsService.getSupplyDemand(tenant.organizationId, query);
  }

  @Get('reports/shortages')
  @RequirePermissions('planning.shortages.view')
  async getShortages(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PlanningReportsQueryDto,
  ) {
    return this.reportsService.getShortages(tenant.organizationId, query);
  }
}
