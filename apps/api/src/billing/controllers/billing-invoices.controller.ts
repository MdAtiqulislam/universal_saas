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
import { CreateInvoiceDto, InvoiceQueryDto } from '../dto/billing-invoice.dto';

@Controller('billing/invoices')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingInvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @RequirePermissions('billing.invoices.read')
  async listInvoices(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: InvoiceQueryDto,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const result = await this.invoicesService.listInvoices(
      tenant.organizationId,
      query,
    );
    return {
      success: true,
      data: result,
      message: 'Invoices retrieved',
    };
  }

  @Get(':id')
  @RequirePermissions('billing.invoices.read')
  async getInvoice(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const invoice = await this.invoicesService.getInvoice(
      id,
      tenant.organizationId,
    );
    return {
      success: true,
      data: invoice,
      message: 'Invoice retrieved',
    };
  }

  @Post()
  @RequirePermissions('billing.invoices.manage')
  async createInvoice(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateInvoiceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const invoice = await this.invoicesService.createInvoice(
      tenant.organizationId,
      dto,
      req.user?.id,
    );
    return {
      success: true,
      data: invoice,
      message: 'Draft invoice created',
    };
  }

  @Post(':id/finalize')
  @RequirePermissions('billing.invoices.manage')
  async finalizeInvoice(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const invoice = await this.invoicesService.finalizeInvoice(
      id,
      tenant.organizationId,
      req.user?.id,
    );
    return {
      success: true,
      data: invoice,
      message: 'Invoice finalized',
    };
  }

  @Post(':id/void')
  @RequirePermissions('billing.invoices.manage')
  async voidInvoice(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const invoice = await this.invoicesService.voidInvoice(
      id,
      tenant.organizationId,
      reason,
      req.user?.id,
    );
    return {
      success: true,
      data: invoice,
      message: 'Invoice voided',
    };
  }
}
