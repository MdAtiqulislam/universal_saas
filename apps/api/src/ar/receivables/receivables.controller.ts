import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ReceivablesService,
  CustomerArBalance,
  ArAgingReport,
} from './receivables.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('receivables')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ReceivablesController {
  constructor(private readonly receivablesService: ReceivablesService) {}

  @Get('customers/:customerId')
  @RequirePermissions('sales.receivables.view')
  async getCustomerBalance(
    @CurrentTenant() tenant: TenantContext,
    @Param('customerId') customerId: string,
  ): Promise<CustomerArBalance> {
    return this.receivablesService.getCustomerBalance(
      tenant.organizationId,
      customerId,
    );
  }

  @Get('aging')
  @RequirePermissions('sales.receivables.aging')
  async getAgingReport(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<ArAgingReport> {
    return this.receivablesService.getAgingReport(tenant.organizationId);
  }
}
