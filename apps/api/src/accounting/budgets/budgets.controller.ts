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
import { BudgetsService } from './budgets.service';
import { BudgetVsActualService } from './budget-vs-actual.service';
import { BudgetControlService } from './budget-control.service';
import { BudgetAlertsService } from './budget-alerts.service';
import { BudgetReportsService } from './budget-reports.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { BudgetQueryDto } from './dto/budget-query.dto';
import { BudgetControlCheckDto } from './dto/budget-control-check.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('accounting')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class BudgetsController {
  constructor(
    private readonly budgetsService: BudgetsService,
    private readonly vsActualService: BudgetVsActualService,
    private readonly controlService: BudgetControlService,
    private readonly alertsService: BudgetAlertsService,
    private readonly reportsService: BudgetReportsService,
  ) {}

  // --------------------------------------------------------------------------
  // BUDGET CONTROL CHECK
  // --------------------------------------------------------------------------

  @Post('budget-control/check')
  @RequirePermissions('accounting.budgets.control.view')
  async checkBudgetAvailability(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: BudgetControlCheckDto,
  ) {
    return this.controlService.checkBudgetAvailability(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  // --------------------------------------------------------------------------
  // BUDGET MASTER CRUD
  // --------------------------------------------------------------------------

  @Get('budgets')
  @RequirePermissions('accounting.budgets.view')
  async findAllBudgets(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: BudgetQueryDto,
  ) {
    return this.budgetsService.findAll(tenant.organizationId, query);
  }

  @Post('budgets')
  @RequirePermissions('accounting.budgets.manage')
  async createBudget(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateBudgetDto,
  ) {
    return this.budgetsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get('budgets/:id')
  @RequirePermissions('accounting.budgets.view')
  async findBudget(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.budgetsService.findOne(tenant.organizationId, id);
  }

  @Patch('budgets/:id')
  @RequirePermissions('accounting.budgets.manage')
  async updateBudget(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.budgetsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Delete('budgets/:id')
  @RequirePermissions('accounting.budgets.manage')
  async deleteBudget(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.budgetsService.delete(tenant.organizationId, id);
  }

  // --------------------------------------------------------------------------
  // WORKFLOW TRANSITIONS
  // --------------------------------------------------------------------------

  @Post('budgets/:id/submit')
  @RequirePermissions('accounting.budgets.submit')
  async submitBudget(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.budgetsService.submit(tenant.organizationId, id, tenant.userId);
  }

  @Post('budgets/:id/approve')
  @RequirePermissions('accounting.budgets.approve')
  async approveBudget(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.budgetsService.approve(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post('budgets/:id/activate')
  @RequirePermissions('accounting.budgets.activate')
  async activateBudget(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.budgetsService.activate(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post('budgets/:id/close')
  @RequirePermissions('accounting.budgets.close')
  async closeBudget(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.budgetsService.close(tenant.organizationId, id, tenant.userId);
  }

  @Post('budgets/:id/cancel')
  @RequirePermissions('accounting.budgets.cancel')
  async cancelBudget(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.budgetsService.cancel(tenant.organizationId, id, tenant.userId);
  }

  @Post('budgets/:id/reject')
  @RequirePermissions('accounting.budgets.approve')
  async rejectBudget(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.budgetsService.reject(
      tenant.organizationId,
      id,
      reason,
      tenant.userId,
    );
  }

  // --------------------------------------------------------------------------
  // BUDGET VS ACTUAL & DRILL-DOWN
  // --------------------------------------------------------------------------

  @Get('budgets/:id/summary')
  @RequirePermissions('accounting.budgets.vs-actual.view')
  async getBudgetSummary(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.reportsService.getBudgetSummary(tenant.organizationId, id);
  }

  @Get('budgets/:id/vs-actual')
  @RequirePermissions('accounting.budgets.vs-actual.view')
  async getBudgetVsActual(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Query() query: BudgetQueryDto,
  ) {
    return this.vsActualService.getVsActual(tenant.organizationId, id, query);
  }

  @Get('budgets/:id/utilization')
  @RequirePermissions('accounting.budgets.vs-actual.view')
  async getBudgetUtilization(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.vsActualService.getUtilization(tenant.organizationId, id);
  }

  @Get('budgets/:id/alerts')
  @RequirePermissions('accounting.budgets.alerts.view')
  async getBudgetAlerts(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.alertsService.getAlerts(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Get('budgets/:id/drill-down')
  @RequirePermissions('accounting.budgets.vs-actual.view')
  async getBudgetDrillDown(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Query('accountId') accountId: string,
    @Query('period') period?: string,
  ) {
    return this.vsActualService.getDrillDown(
      tenant.organizationId,
      id,
      accountId,
      period,
    );
  }

  @Get('budgets/:id/reports/account')
  @RequirePermissions('accounting.budgets.vs-actual.view')
  async getAccountBudgetReport(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Query() query: BudgetQueryDto,
  ) {
    return this.reportsService.getAccountBudgetReport(
      tenant.organizationId,
      id,
      query,
    );
  }

  @Get('budgets/:id/reports/category')
  @RequirePermissions('accounting.budgets.vs-actual.view')
  async getCategoryBudgetReport(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Query() query: BudgetQueryDto,
  ) {
    return this.reportsService.getCategoryBudgetReport(
      tenant.organizationId,
      id,
      query,
    );
  }

  @Get('budgets/:id/reports/period')
  @RequirePermissions('accounting.budgets.vs-actual.view')
  async getPeriodBudgetReport(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Query() query: BudgetQueryDto,
  ) {
    return this.reportsService.getPeriodBudgetReport(
      tenant.organizationId,
      id,
      query,
    );
  }
}
