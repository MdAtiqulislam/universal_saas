import { Controller, Get, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { BillingDashboardService } from '../services/billing-dashboard.service';

@Controller('billing/dashboard')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingDashboardController {
  constructor(private readonly dashboardService: BillingDashboardService) {}

  @Get('overview')
  @RequirePermissions('billing.read')
  async getTenantOverview(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const data = await this.dashboardService.getTenantDashboard(
      tenant.organizationId,
    );
    return {
      success: true,
      data,
      message: 'Tenant billing overview retrieved',
    };
  }

  @Get('admin-kpis')
  @RequirePermissions('billing.reports.read')
  async getAdminKpis() {
    const kpis = await this.dashboardService.getAdminKpis();
    return {
      success: true,
      data: kpis,
      message: 'Admin billing KPIs retrieved',
    };
  }
}
