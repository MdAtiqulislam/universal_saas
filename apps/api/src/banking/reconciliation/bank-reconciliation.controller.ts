import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import {
  BankReconciliationService,
  BankReconciliationWithDetails,
} from './bank-reconciliation.service';
import { CreateBankReconciliationDto } from './dto/create-bank-reconciliation.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('banking/reconciliations')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class BankReconciliationController {
  constructor(
    private readonly reconciliationService: BankReconciliationService,
  ) {}

  @Get()
  @RequirePermissions('banking.reconciliation.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<BankReconciliationWithDetails[]> {
    return this.reconciliationService.findAll(tenant.organizationId);
  }

  @Post()
  @RequirePermissions('banking.reconciliation.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateBankReconciliationDto,
  ): Promise<BankReconciliationWithDetails> {
    return this.reconciliationService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get(':id')
  @RequirePermissions('banking.reconciliation.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<BankReconciliationWithDetails> {
    return this.reconciliationService.findOne(tenant.organizationId, id);
  }

  @Post(':id/complete')
  @RequirePermissions('banking.reconciliation.complete')
  async complete(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<BankReconciliationWithDetails> {
    return this.reconciliationService.complete(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/cancel')
  @RequirePermissions('banking.reconciliation.manage')
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<BankReconciliationWithDetails> {
    return this.reconciliationService.cancel(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
