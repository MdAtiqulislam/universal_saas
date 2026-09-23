import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  FinancialReportsService,
  TrialBalanceReport,
  GeneralLedgerReport,
  BalanceSheetReport,
  IncomeStatementReport,
  CashFlowReport,
} from './financial-reports.service';
import { TrialBalanceQueryDto } from './dto/trial-balance-query.dto';
import { GeneralLedgerQueryDto } from './dto/general-ledger-query.dto';
import { FinancialStatementQueryDto } from './dto/financial-statement-query.dto';
import { FinancialKpiQueryDto } from './dto/financial-kpi-query.dto';
import { ReconciliationQueryDto } from './dto/reconciliation-query.dto';
import { BudgetReportQueryDto } from './dto/budget-report-query.dto';
import { CreateReportSnapshotDto } from './dto/create-snapshot.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { ReportSnapshotType, FinancialReportSnapshot } from '@prisma/client';

@Controller('accounting/reports')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class FinancialReportsController {
  constructor(private readonly reportsService: FinancialReportsService) {}

  @Get('trial-balance')
  @RequirePermissions('accounting.reports.trial-balance.view')
  async getTrialBalance(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: TrialBalanceQueryDto,
  ): Promise<TrialBalanceReport> {
    return this.reportsService.getTrialBalance(
      tenant.organizationId,
      query,
      tenant.userId,
    );
  }

  @Get('general-ledger')
  @RequirePermissions('accounting.reports.general-ledger.view')
  async getGeneralLedger(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: GeneralLedgerQueryDto,
  ): Promise<GeneralLedgerReport> {
    return this.reportsService.getGeneralLedger(
      tenant.organizationId,
      query,
      tenant.userId,
    );
  }

  @Get('accounts/:accountId/balance')
  @RequirePermissions('accounting.reports.view')
  async getAccountBalance(
    @CurrentTenant() tenant: TenantContext,
    @Param('accountId') accountId: string,
    @Query() query: FinancialStatementQueryDto,
  ) {
    return this.reportsService.getAccountBalance(
      tenant.organizationId,
      accountId,
      query,
    );
  }

  @Get('balance-sheet')
  @RequirePermissions('accounting.reports.balance-sheet.view')
  async getBalanceSheet(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: FinancialStatementQueryDto,
  ): Promise<BalanceSheetReport> {
    return this.reportsService.getBalanceSheet(
      tenant.organizationId,
      query,
      tenant.userId,
    );
  }

  @Get('income-statement')
  @RequirePermissions('accounting.reports.profit-loss.view')
  async getIncomeStatement(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: FinancialStatementQueryDto,
  ): Promise<IncomeStatementReport> {
    return this.reportsService.getIncomeStatement(
      tenant.organizationId,
      query,
      tenant.userId,
    );
  }

  @Get('profit-loss')
  @RequirePermissions('accounting.reports.profit-loss.view')
  async getProfitLoss(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: FinancialStatementQueryDto,
  ): Promise<IncomeStatementReport> {
    return this.reportsService.getIncomeStatement(
      tenant.organizationId,
      query,
      tenant.userId,
    );
  }

  @Get('cash-flow')
  @RequirePermissions('accounting.reports.cash-flow.view')
  async getCashFlow(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: FinancialStatementQueryDto,
  ): Promise<CashFlowReport> {
    return this.reportsService.getCashFlow(
      tenant.organizationId,
      query,
      tenant.userId,
    );
  }

  @Get('financial-kpis')
  @RequirePermissions('accounting.reports.kpis.view')
  async getFinancialKpis(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: FinancialKpiQueryDto,
  ) {
    return this.reportsService.getFinancialKpis(
      tenant.organizationId,
      query,
      tenant.userId,
    );
  }

  @Get('reconciliation')
  @RequirePermissions('accounting.reports.reconciliation.view')
  async getSubledgerReconciliation(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ReconciliationQueryDto,
  ) {
    return this.reportsService.getSubledgerReconciliation(
      tenant.organizationId,
      query,
    );
  }

  @Get('budget-vs-actual')
  @RequirePermissions('accounting.reports.view')
  async getBudgetVsActual(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: BudgetReportQueryDto,
  ) {
    return this.reportsService.getBudgetVsActual(tenant.organizationId, query);
  }

  @Post('snapshots')
  @RequirePermissions('accounting.reports.view')
  async createSnapshot(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateReportSnapshotDto,
  ): Promise<FinancialReportSnapshot> {
    return this.reportsService.createSnapshot(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get('snapshots')
  @RequirePermissions('accounting.reports.view')
  async getSnapshots(
    @CurrentTenant() tenant: TenantContext,
    @Query('reportType') reportType?: ReportSnapshotType,
    @Query('fiscalPeriodId') fiscalPeriodId?: string,
  ): Promise<FinancialReportSnapshot[]> {
    return this.reportsService.getSnapshots(
      tenant.organizationId,
      reportType,
      fiscalPeriodId,
    );
  }
}
