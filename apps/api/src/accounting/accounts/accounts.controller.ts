import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccountsService, AccountWithDetails } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountQueryDto } from './dto/account-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { Account } from '@prisma/client';

@Controller('accounting/accounts')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @RequirePermissions('accounting.accounts.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateAccountDto,
  ): Promise<Account> {
    return this.accountsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('accounting.accounts.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AccountQueryDto,
  ): Promise<{
    accounts: Account[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.accountsService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('accounting.accounts.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<AccountWithDetails> {
    return this.accountsService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('accounting.accounts.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<Account> {
    return this.accountsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Delete(':id')
  @RequirePermissions('accounting.accounts.manage')
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.accountsService.softDelete(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
