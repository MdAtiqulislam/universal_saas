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
import { PayrollConfigService } from './payroll-config.service';
import { PayrollComponentsService } from './payroll-components.service';
import { PayrollPeriodsService } from './payroll-periods.service';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayrollPostingService } from './payroll-posting.service';
import { PayrollPaymentService } from './payroll-payment.service';
import { PayrollBudgetService } from './payroll-budget.service';
import { PayrollReportsService } from './payroll-reports.service';
import { UpdatePayrollConfigDto } from './dto/update-payroll-config.dto';
import {
  CreatePayrollComponentDto,
  UpdatePayrollComponentDto,
} from './dto/create-payroll-component.dto';
import {
  CreatePayrollPeriodDto,
  PayrollPeriodQueryDto,
} from './dto/create-payroll-period.dto';
import { CreatePayrollInputDto } from './dto/create-payroll-input.dto';
import { PayrollBudgetCheckDto } from './dto/payroll-budget-check.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../organizations/interfaces/tenant-context.interface';

@Controller('payroll')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class PayrollController {
  constructor(
    private readonly configService: PayrollConfigService,
    private readonly componentsService: PayrollComponentsService,
    private readonly periodsService: PayrollPeriodsService,
    private readonly calculationService: PayrollCalculationService,
    private readonly postingService: PayrollPostingService,
    private readonly paymentService: PayrollPaymentService,
    private readonly budgetService: PayrollBudgetService,
    private readonly reportsService: PayrollReportsService,
  ) {}

  // --------------------------------------------------------------------------
  // PAYROLL CONFIGURATION
  // --------------------------------------------------------------------------

  @Get('configuration')
  @RequirePermissions('payroll.configuration.view')
  async getConfig(@CurrentTenant() tenant: TenantContext) {
    return this.configService.getOrCreate(tenant.organizationId);
  }

  @Patch('configuration')
  @RequirePermissions('payroll.configuration.manage')
  async updateConfig(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdatePayrollConfigDto,
  ) {
    return this.configService.update(tenant.organizationId, dto);
  }

  // --------------------------------------------------------------------------
  // PAYROLL COMPONENTS
  // --------------------------------------------------------------------------

  @Get('components')
  @RequirePermissions('payroll.components.view')
  async findAllComponents(@CurrentTenant() tenant: TenantContext) {
    return this.componentsService.findAll(tenant.organizationId);
  }

  @Post('components')
  @RequirePermissions('payroll.components.manage')
  async createComponent(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePayrollComponentDto,
  ) {
    return this.componentsService.create(tenant.organizationId, dto);
  }

  @Get('components/:id')
  @RequirePermissions('payroll.components.view')
  async findOneComponent(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.componentsService.findOne(tenant.organizationId, id);
  }

  @Patch('components/:id')
  @RequirePermissions('payroll.components.manage')
  async updateComponent(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdatePayrollComponentDto,
  ) {
    return this.componentsService.update(tenant.organizationId, id, dto);
  }

  @Delete('components/:id')
  @RequirePermissions('payroll.components.manage')
  async deleteComponent(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.componentsService.delete(tenant.organizationId, id);
  }

  // --------------------------------------------------------------------------
  // PAYROLL PERIODS & INPUTS
  // --------------------------------------------------------------------------

  @Get('periods')
  @RequirePermissions('payroll.periods.view')
  async findAllPeriods(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PayrollPeriodQueryDto,
  ) {
    return this.periodsService.findAll(tenant.organizationId, query);
  }

  @Post('periods')
  @RequirePermissions('payroll.periods.manage')
  async createPeriod(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePayrollPeriodDto,
  ) {
    return this.periodsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get('periods/:id')
  @RequirePermissions('payroll.periods.view')
  async findOnePeriod(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.periodsService.findOne(tenant.organizationId, id);
  }

  @Post('periods/:id/inputs')
  @RequirePermissions('payroll.periods.manage')
  async addInput(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: Omit<CreatePayrollInputDto, 'payrollPeriodId'>,
  ) {
    return this.periodsService.addInput(tenant.organizationId, {
      ...dto,
      payrollPeriodId: id,
    });
  }

  // --------------------------------------------------------------------------
  // PAYROLL WORKFLOW
  // --------------------------------------------------------------------------

  @Post('periods/:id/calculate')
  @RequirePermissions('payroll.calculate')
  async calculatePayroll(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.calculationService.calculate(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post('periods/:id/approve')
  @RequirePermissions('payroll.approve')
  async approvePayroll(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.calculationService.approve(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post('periods/:id/post')
  @RequirePermissions('payroll.post')
  async postPayroll(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.postingService.post(tenant.organizationId, id, tenant.userId);
  }

  @Post('periods/:id/pay')
  @RequirePermissions('payroll.pay')
  async payPayroll(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body('paymentAccountId') paymentAccountId?: string,
  ) {
    return this.paymentService.pay(
      tenant.organizationId,
      id,
      paymentAccountId,
      tenant.userId,
    );
  }

  @Post('periods/:id/close')
  @RequirePermissions('payroll.close')
  async closePeriod(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.periodsService.close(tenant.organizationId, id, tenant.userId);
  }

  @Post('periods/:id/cancel')
  @RequirePermissions('payroll.cancel')
  async cancelPeriod(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.periodsService.cancel(tenant.organizationId, id, tenant.userId);
  }

  // --------------------------------------------------------------------------
  // PAYROLL REPORTS
  // --------------------------------------------------------------------------

  @Get('reports/summary')
  @RequirePermissions('payroll.reports.view')
  async getSummaryReport(
    @CurrentTenant() tenant: TenantContext,
    @Query('periodId') periodId: string,
  ) {
    return this.reportsService.getSummary(tenant.organizationId, periodId);
  }

  @Get('reports/employee')
  @RequirePermissions('payroll.reports.sensitive')
  async getEmployeeReport(
    @CurrentTenant() tenant: TenantContext,
    @Query('periodId') periodId: string,
  ) {
    return this.reportsService.getEmployeeReport(
      tenant.organizationId,
      periodId,
    );
  }

  @Get('reports/department')
  @RequirePermissions('payroll.reports.view')
  async getDepartmentReport(
    @CurrentTenant() tenant: TenantContext,
    @Query('periodId') periodId: string,
  ) {
    return this.reportsService.getDepartmentReport(
      tenant.organizationId,
      periodId,
    );
  }

  @Get('reports/liabilities')
  @RequirePermissions('payroll.reports.view')
  async getLiabilitiesReport(
    @CurrentTenant() tenant: TenantContext,
    @Query('periodId') periodId: string,
  ) {
    return this.reportsService.getLiabilitiesReport(
      tenant.organizationId,
      periodId,
    );
  }

  @Get('reports/history')
  @RequirePermissions('payroll.reports.sensitive')
  async getHistoryReport(
    @CurrentTenant() tenant: TenantContext,
    @Query('employeeId') employeeId: string,
  ) {
    return this.reportsService.getHistory(tenant.organizationId, employeeId);
  }

  // --------------------------------------------------------------------------
  // PAYROLL BUDGET CONTROL
  // --------------------------------------------------------------------------

  @Post('budget-control/check')
  @RequirePermissions('payroll.budget-control.view')
  async checkBudgetAvailability(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: PayrollBudgetCheckDto,
  ) {
    return this.budgetService.checkBudgetAvailability(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }
}
