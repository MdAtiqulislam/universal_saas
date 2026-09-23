import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  BankStatementsService,
  BankStatementWithDetails,
} from './bank-statements.service';
import { CreateBankStatementDto } from './dto/create-bank-statement.dto';
import { ImportStatementTransactionsDto } from './dto/import-statement-transactions.dto';
import { BankStatementQueryDto } from './dto/bank-statement-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { BankStatement, BankStatementTransaction } from '@prisma/client';

@Controller('banking/statements')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class BankStatementsController {
  constructor(private readonly statementsService: BankStatementsService) {}

  @Get()
  @RequirePermissions('banking.statements.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: BankStatementQueryDto,
  ): Promise<{
    statements: BankStatement[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.statementsService.findAll(tenant.organizationId, query);
  }

  @Post()
  @RequirePermissions('banking.statements.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateBankStatementDto,
  ): Promise<BankStatementWithDetails> {
    return this.statementsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get(':id')
  @RequirePermissions('banking.statements.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<BankStatementWithDetails> {
    return this.statementsService.findOne(tenant.organizationId, id);
  }

  @Post(':id/import')
  @RequirePermissions('banking.statements.import')
  async importTransactions(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: ImportStatementTransactionsDto,
  ): Promise<{ importedCount: number; statement: BankStatementWithDetails }> {
    return this.statementsService.importTransactions(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Get(':id/transactions')
  @RequirePermissions('banking.statements.view')
  async getTransactions(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<BankStatementTransaction[]> {
    return this.statementsService.getTransactions(tenant.organizationId, id);
  }
}
