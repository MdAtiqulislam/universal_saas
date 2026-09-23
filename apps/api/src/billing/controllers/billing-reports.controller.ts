import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { BillingReportsService } from '../services/billing-reports.service';

@Controller('billing/reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingReportsController {
  constructor(private readonly reportsService: BillingReportsService) {}

  @Get('mrr')
  @RequirePermissions('billing.reports.read')
  async getMrr(@Query('currency') currency?: string) {
    const report = await this.reportsService.getMrrReport(currency || 'USD');
    return {
      success: true,
      data: report,
      message: 'MRR report generated',
    };
  }

  @Get('arr')
  @RequirePermissions('billing.reports.read')
  async getArr(@Query('currency') currency?: string) {
    const report = await this.reportsService.getArrReport(currency || 'USD');
    return {
      success: true,
      data: report,
      message: 'ARR report generated',
    };
  }

  @Get('subscriptions')
  @RequirePermissions('billing.reports.read')
  async getSubscriptionSummary() {
    const report = await this.reportsService.getSubscriptionSummary();
    return {
      success: true,
      data: report,
      message: 'Subscription summary report generated',
    };
  }

  @Get('new-subscriptions')
  @RequirePermissions('billing.reports.read')
  async getNewSubscriptions(@Query('days') days?: number) {
    const report = await this.reportsService.getNewSubscriptions(
      days ? Number(days) : 30,
    );
    return {
      success: true,
      data: report,
      message: 'New subscriptions report generated',
    };
  }

  @Get('churn')
  @RequirePermissions('billing.reports.read')
  async getChurn(@Query('days') days?: number) {
    const report = await this.reportsService.getChurnReport(
      days ? Number(days) : 30,
    );
    return {
      success: true,
      data: report,
      message: 'Churn analysis report generated',
    };
  }

  @Get('aging')
  @RequirePermissions('billing.reports.read')
  async getAging(@Query('currency') currency?: string) {
    const report = await this.reportsService.getInvoiceAgingReport(
      currency || 'USD',
    );
    return {
      success: true,
      data: report,
      message: 'Invoice aging report generated',
    };
  }

  @Get('reliability')
  @RequirePermissions('billing.reports.read')
  async getReliability() {
    const report = await this.reportsService.getPaymentReliabilityReport();
    return {
      success: true,
      data: report,
      message: 'Payment reliability report generated',
    };
  }

  @Get('revenue-by-plan')
  @RequirePermissions('billing.reports.read')
  async getRevenueByPlan() {
    const report = await this.reportsService.getRevenueByPlanReport();
    return {
      success: true,
      data: report,
      message: 'Revenue by plan report generated',
    };
  }

  @Get('movements')
  @RequirePermissions('billing.reports.read')
  async getMovements() {
    const report = await this.reportsService.getUpgradeDowngradeMovement();
    return {
      success: true,
      data: report,
      message: 'Upgrade/downgrade movements retrieved',
    };
  }
}
