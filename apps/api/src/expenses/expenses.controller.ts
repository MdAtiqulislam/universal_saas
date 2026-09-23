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
import { ExpensesService } from './expenses.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';
import { CreateExpenseClaimantDto } from './dto/create-expense-claimant.dto';
import { UpdateExpenseClaimantDto } from './dto/update-expense-claimant.dto';
import { CreateExpenseClaimDto } from './dto/create-expense-claim.dto';
import { UpdateExpenseClaimDto } from './dto/update-expense-claim.dto';
import { RejectExpenseClaimDto } from './dto/reject-expense-claim.dto';
import { ReimburseExpenseClaimDto } from './dto/reimburse-expense-claim.dto';
import { CreateExpenseReceiptDto } from './dto/create-expense-receipt.dto';
import { ExpenseReportQueryDto } from './dto/expense-report-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../organizations/interfaces/tenant-context.interface';

@Controller('expenses')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  // --------------------------------------------------------------------------
  // CATEGORIES
  // --------------------------------------------------------------------------

  @Get('categories')
  @RequirePermissions('expenses.categories.view')
  async findCategories(@CurrentTenant() tenant: TenantContext) {
    return this.expensesService.findCategories(tenant.organizationId);
  }

  @Post('categories')
  @RequirePermissions('expenses.categories.manage')
  async createCategory(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    return this.expensesService.createCategory(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get('categories/:id')
  @RequirePermissions('expenses.categories.view')
  async findCategory(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.expensesService.findCategory(tenant.organizationId, id);
  }

  @Patch('categories/:id')
  @RequirePermissions('expenses.categories.manage')
  async updateCategory(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseCategoryDto,
  ) {
    return this.expensesService.updateCategory(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Delete('categories/:id')
  @RequirePermissions('expenses.categories.manage')
  async deleteCategory(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.expensesService.deleteCategory(tenant.organizationId, id);
  }

  // --------------------------------------------------------------------------
  // CLAIMANTS
  // --------------------------------------------------------------------------

  @Get('claimants')
  @RequirePermissions('expenses.claimants.view')
  async findClaimants(@CurrentTenant() tenant: TenantContext) {
    return this.expensesService.findClaimants(tenant.organizationId);
  }

  @Post('claimants')
  @RequirePermissions('expenses.claimants.manage')
  async createClaimant(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateExpenseClaimantDto,
  ) {
    return this.expensesService.createClaimant(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get('claimants/:id')
  @RequirePermissions('expenses.claimants.view')
  async findClaimant(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.expensesService.findClaimant(tenant.organizationId, id);
  }

  @Patch('claimants/:id')
  @RequirePermissions('expenses.claimants.manage')
  async updateClaimant(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseClaimantDto,
  ) {
    return this.expensesService.updateClaimant(tenant.organizationId, id, dto);
  }

  // --------------------------------------------------------------------------
  // CLAIMS
  // --------------------------------------------------------------------------

  @Get('claims')
  @RequirePermissions('expenses.claims.view')
  async findClaims(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ExpenseReportQueryDto,
  ) {
    return this.expensesService.findClaims(tenant.organizationId, query);
  }

  @Post('claims')
  @RequirePermissions('expenses.claims.manage')
  async createClaim(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateExpenseClaimDto,
  ) {
    return this.expensesService.createClaim(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get('claims/:id')
  @RequirePermissions('expenses.claims.view')
  async findClaim(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.expensesService.findClaim(tenant.organizationId, id);
  }

  @Patch('claims/:id')
  @RequirePermissions('expenses.claims.manage')
  async updateClaim(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseClaimDto,
  ) {
    return this.expensesService.updateClaim(tenant.organizationId, id, dto);
  }

  @Post('claims/:id/submit')
  @RequirePermissions('expenses.claims.submit')
  async submitClaim(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.expensesService.submitClaim(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post('claims/:id/approve')
  @RequirePermissions('expenses.claims.approve')
  async approveClaim(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.expensesService.approveClaim(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post('claims/:id/reject')
  @RequirePermissions('expenses.claims.approve')
  async rejectClaim(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: RejectExpenseClaimDto,
  ) {
    return this.expensesService.rejectClaim(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post('claims/:id/cancel')
  @RequirePermissions('expenses.claims.cancel')
  async cancelClaim(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.expensesService.cancelClaim(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post('claims/:id/post')
  @RequirePermissions('expenses.claims.post')
  async postClaim(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.expensesService.postClaim(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post('claims/:id/void')
  @RequirePermissions('expenses.claims.void')
  async voidClaim(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.expensesService.voidClaim(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post('claims/:id/receipts')
  @RequirePermissions('expenses.claims.manage')
  async addReceipt(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: CreateExpenseReceiptDto,
  ) {
    return this.expensesService.addReceipt(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  // --------------------------------------------------------------------------
  // REIMBURSEMENTS
  // --------------------------------------------------------------------------

  @Get('reimbursements')
  @RequirePermissions('expenses.reimbursements.view')
  async findReimbursements(@CurrentTenant() tenant: TenantContext) {
    return this.expensesService.findReimbursements(tenant.organizationId);
  }

  @Post('claims/:id/reimburse')
  @RequirePermissions('expenses.reimbursements.manage')
  async reimburseClaim(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: ReimburseExpenseClaimDto,
  ) {
    return this.expensesService.reimburseClaim(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  // --------------------------------------------------------------------------
  // REPORTS
  // --------------------------------------------------------------------------

  @Get('reports/summary')
  @RequirePermissions('expenses.reports.view')
  async getSummaryReport(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ExpenseReportQueryDto,
  ) {
    return this.expensesService.getSummaryReport(tenant.organizationId, query);
  }

  @Get('reports/by-category')
  @RequirePermissions('expenses.reports.view')
  async getByCategoryReport(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ExpenseReportQueryDto,
  ) {
    return this.expensesService.getByCategoryReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('reports/reimbursement-aging')
  @RequirePermissions('expenses.reports.view')
  async getReimbursementAgingReport(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ExpenseReportQueryDto,
  ) {
    return this.expensesService.getReimbursementAgingReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('reports/ledger')
  @RequirePermissions('expenses.reports.view')
  async getLedgerReport(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ExpenseReportQueryDto,
  ) {
    return this.expensesService.getLedgerReport(tenant.organizationId, query);
  }
}
