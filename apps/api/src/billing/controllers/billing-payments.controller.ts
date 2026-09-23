import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { InvoicesService } from '../services/invoices.service';
import { ApplyPaymentDto } from '../dto/billing-invoice.dto';

@Controller('billing/payments')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingPaymentsController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @RequirePermissions('billing.payments.read')
  async listPayments(
    @CurrentTenant() tenant: TenantContext,
    @Query('limit') limit?: number,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const payments = await this.invoicesService.listPayments(
      tenant.organizationId,
      limit ? Number(limit) : 50,
    );
    return {
      success: true,
      data: payments,
      message: 'Payment history retrieved',
    };
  }

  @Post(':invoiceId')
  @RequirePermissions('billing.invoices.manage')
  async applyPayment(
    @Param('invoiceId') invoiceId: string,
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: ApplyPaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const result = await this.invoicesService.applyPayment(
      invoiceId,
      tenant.organizationId,
      dto,
      req.user?.id,
    );
    return {
      success: true,
      data: result,
      message: 'Payment applied successfully',
    };
  }
}
