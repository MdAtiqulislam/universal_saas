import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import {
  BankMatchingService,
  MatchedTransactionWithDetails,
} from './bank-matching.service';
import { MatchTransactionDto } from './dto/match-transaction.dto';
import { PostBankAdjustmentDto } from './dto/post-bank-adjustment.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('banking/transactions')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class BankMatchingController {
  constructor(private readonly matchingService: BankMatchingService) {}

  @Get(':id/suggestions')
  @RequirePermissions('banking.reconciliation.view')
  async getSuggestions(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.matchingService.getSuggestions(tenant.organizationId, id);
  }

  @Post(':id/match-payment')
  @RequirePermissions('banking.reconciliation.match')
  async matchPayment(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: MatchTransactionDto,
  ): Promise<MatchedTransactionWithDetails> {
    return this.matchingService.matchPayment(
      tenant.organizationId,
      id,
      dto.paymentId!,
      tenant.userId,
    );
  }

  @Post(':id/match-journal')
  @RequirePermissions('banking.reconciliation.match')
  async matchJournal(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: MatchTransactionDto,
  ): Promise<MatchedTransactionWithDetails> {
    return this.matchingService.matchJournal(
      tenant.organizationId,
      id,
      dto.journalEntryId!,
      tenant.userId,
    );
  }

  @Post(':id/unmatch')
  @RequirePermissions('banking.reconciliation.match')
  async unmatch(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<MatchedTransactionWithDetails> {
    return this.matchingService.unmatch(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/post-adjustment')
  @RequirePermissions('banking.adjustments.manage')
  async postAdjustment(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: PostBankAdjustmentDto,
  ): Promise<MatchedTransactionWithDetails> {
    return this.matchingService.postAdjustment(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }
}
