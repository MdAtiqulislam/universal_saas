import { Injectable } from '@nestjs/common';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseClaimantsService } from './expense-claimants.service';
import { ExpenseClaimsService } from './expense-claims.service';
import { ExpenseReimbursementsService } from './expense-reimbursements.service';
import { ExpenseReportsService } from './expense-reports.service';
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

@Injectable()
export class ExpensesService {
  constructor(
    public readonly categories: ExpenseCategoriesService,
    public readonly claimants: ExpenseClaimantsService,
    public readonly claims: ExpenseClaimsService,
    public readonly reimbursements: ExpenseReimbursementsService,
    public readonly reports: ExpenseReportsService,
  ) {}

  // Categories
  async createCategory(
    orgId: string,
    dto: CreateExpenseCategoryDto,
    userId?: string,
  ) {
    return this.categories.create(orgId, dto, userId);
  }
  async findCategories(orgId: string) {
    return this.categories.findAll(orgId);
  }
  async findCategory(orgId: string, id: string) {
    return this.categories.findOne(orgId, id);
  }
  async updateCategory(
    orgId: string,
    id: string,
    dto: UpdateExpenseCategoryDto,
    userId?: string,
  ) {
    return this.categories.update(orgId, id, dto, userId);
  }
  async deleteCategory(orgId: string, id: string) {
    return this.categories.delete(orgId, id);
  }

  // Claimants
  async createClaimant(
    orgId: string,
    dto: CreateExpenseClaimantDto,
    userId?: string,
  ) {
    return this.claimants.create(orgId, dto, userId);
  }
  async findClaimants(orgId: string) {
    return this.claimants.findAll(orgId);
  }
  async findClaimant(orgId: string, id: string) {
    return this.claimants.findOne(orgId, id);
  }
  async updateClaimant(
    orgId: string,
    id: string,
    dto: UpdateExpenseClaimantDto,
  ) {
    return this.claimants.update(orgId, id, dto);
  }

  // Claims
  async createClaim(orgId: string, dto: CreateExpenseClaimDto, userId: string) {
    return this.claims.create(orgId, dto, userId);
  }
  async findClaims(orgId: string, query: ExpenseReportQueryDto) {
    return this.claims.findAll(orgId, query);
  }
  async findClaim(orgId: string, id: string) {
    return this.claims.findOne(orgId, id);
  }
  async updateClaim(orgId: string, id: string, dto: UpdateExpenseClaimDto) {
    return this.claims.update(orgId, id, dto);
  }
  async submitClaim(orgId: string, id: string, userId: string) {
    return this.claims.submit(orgId, id, userId);
  }
  async approveClaim(orgId: string, id: string, userId: string) {
    return this.claims.approve(orgId, id, userId);
  }
  async rejectClaim(
    orgId: string,
    id: string,
    dto: RejectExpenseClaimDto,
    userId: string,
  ) {
    return this.claims.reject(orgId, id, dto, userId);
  }
  async cancelClaim(orgId: string, id: string, userId: string) {
    return this.claims.cancel(orgId, id, userId);
  }
  async postClaim(orgId: string, id: string, userId: string) {
    return this.claims.post(orgId, id, userId);
  }
  async voidClaim(orgId: string, id: string, userId: string) {
    return this.claims.void(orgId, id, userId);
  }
  async addReceipt(
    orgId: string,
    id: string,
    dto: CreateExpenseReceiptDto,
    userId: string,
  ) {
    return this.claims.addReceipt(orgId, id, dto, userId);
  }

  // Reimbursements
  async reimburseClaim(
    orgId: string,
    id: string,
    dto: ReimburseExpenseClaimDto,
    userId: string,
  ) {
    return this.reimbursements.reimburse(orgId, id, dto, userId);
  }
  async findReimbursements(orgId: string) {
    return this.reimbursements.findAll(orgId);
  }

  // Reports
  async getSummaryReport(orgId: string, query: ExpenseReportQueryDto) {
    return this.reports.getSummary(orgId, query);
  }
  async getByCategoryReport(orgId: string, query: ExpenseReportQueryDto) {
    return this.reports.getByCategory(orgId, query);
  }
  async getReimbursementAgingReport(
    orgId: string,
    query: ExpenseReportQueryDto,
  ) {
    return this.reports.getReimbursementAging(orgId, query);
  }
  async getLedgerReport(orgId: string, query: ExpenseReportQueryDto) {
    return this.reports.getLedger(orgId, query);
  }
}
