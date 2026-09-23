import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService, PaymentWithDetails } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AllocatePaymentDto } from './dto/allocate-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { Payment, PaymentType } from '@prisma/client';

@Controller()
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('payments')
  @RequirePermissions('finance.payments.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PaymentQueryDto,
  ): Promise<{
    payments: Payment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.paymentsService.findAll(tenant.organizationId, query);
  }

  @Post('payments')
  @RequirePermissions('finance.payments.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePaymentDto,
  ): Promise<PaymentWithDetails> {
    return this.paymentsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Post('receipts')
  @RequirePermissions('finance.receipts.manage')
  async createReceipt(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: Omit<CreatePaymentDto, 'type'>,
  ): Promise<PaymentWithDetails> {
    return this.paymentsService.create(
      tenant.organizationId,
      { ...dto, type: PaymentType.RECEIPT },
      tenant.userId,
    );
  }

  @Post('supplier-payments')
  @RequirePermissions('finance.supplier-payments.manage')
  async createSupplierPayment(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: Omit<CreatePaymentDto, 'type'>,
  ): Promise<PaymentWithDetails> {
    return this.paymentsService.create(
      tenant.organizationId,
      { ...dto, type: PaymentType.PAYMENT },
      tenant.userId,
    );
  }

  @Get('payments/:id')
  @RequirePermissions('finance.payments.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<PaymentWithDetails> {
    return this.paymentsService.findOne(tenant.organizationId, id);
  }

  @Post('payments/:id/post')
  @RequirePermissions('finance.payments.post')
  async postPayment(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<PaymentWithDetails> {
    return this.paymentsService.post(tenant.organizationId, id, tenant.userId);
  }

  @Post('payments/:id/allocate')
  @RequirePermissions('finance.payments.allocate')
  async allocatePayment(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: AllocatePaymentDto,
  ): Promise<PaymentWithDetails> {
    return this.paymentsService.allocate(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post('payments/:id/void')
  @RequirePermissions('finance.payments.void')
  async voidPayment(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<PaymentWithDetails> {
    return this.paymentsService.void(tenant.organizationId, id, tenant.userId);
  }

  @Get('receivables/unallocated')
  @RequirePermissions('finance.settlements.view')
  async getUnallocatedReceivables(@CurrentTenant() tenant: TenantContext) {
    return this.paymentsService.getUnallocatedReceivables(
      tenant.organizationId,
    );
  }

  @Get('payables/unallocated')
  @RequirePermissions('finance.settlements.view')
  async getUnallocatedPayables(@CurrentTenant() tenant: TenantContext) {
    return this.paymentsService.getUnallocatedPayables(tenant.organizationId);
  }
}
