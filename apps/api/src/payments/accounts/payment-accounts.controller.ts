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
  PaymentAccountsService,
  PaymentAccountWithDetails,
} from './payment-accounts.service';
import { CreatePaymentAccountDto } from './dto/create-payment-account.dto';
import { UpdatePaymentAccountDto } from './dto/update-payment-account.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('payment-accounts')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class PaymentAccountsController {
  constructor(private readonly accountsService: PaymentAccountsService) {}

  @Get()
  @RequirePermissions('finance.payments.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query('isActive', new ParseBoolPipe({ optional: true }))
    isActive?: boolean,
  ): Promise<PaymentAccountWithDetails[]> {
    return this.accountsService.findAll(tenant.organizationId, isActive);
  }

  @Post()
  @RequirePermissions('finance.payments.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePaymentAccountDto,
  ): Promise<PaymentAccountWithDetails> {
    return this.accountsService.create(tenant.organizationId, dto);
  }

  @Get(':id')
  @RequirePermissions('finance.payments.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<PaymentAccountWithDetails> {
    return this.accountsService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('finance.payments.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentAccountDto,
  ): Promise<PaymentAccountWithDetails> {
    return this.accountsService.update(tenant.organizationId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('finance.payments.manage')
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.accountsService.remove(tenant.organizationId, id);
  }
}
