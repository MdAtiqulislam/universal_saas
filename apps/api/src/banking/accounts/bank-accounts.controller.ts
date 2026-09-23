import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseBoolPipe,
} from '@nestjs/common';
import {
  BankAccountsService,
  BankAccountProfileWithDetails,
} from './bank-accounts.service';
import { CreateBankAccountProfileDto } from './dto/create-bank-account-profile.dto';
import { UpdateBankAccountProfileDto } from './dto/update-bank-account-profile.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('banking/accounts')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class BankAccountsController {
  constructor(private readonly accountsService: BankAccountsService) {}

  @Get()
  @RequirePermissions('banking.accounts.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query('isActive', new ParseBoolPipe({ optional: true }))
    isActive?: boolean,
  ): Promise<BankAccountProfileWithDetails[]> {
    return this.accountsService.findAll(tenant.organizationId, isActive);
  }

  @Post()
  @RequirePermissions('banking.accounts.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateBankAccountProfileDto,
  ): Promise<BankAccountProfileWithDetails> {
    return this.accountsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get(':id')
  @RequirePermissions('banking.accounts.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<BankAccountProfileWithDetails> {
    return this.accountsService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('banking.accounts.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateBankAccountProfileDto,
  ): Promise<BankAccountProfileWithDetails> {
    return this.accountsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Delete(':id')
  @RequirePermissions('banking.accounts.manage')
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.accountsService.remove(tenant.organizationId, id);
  }
}
