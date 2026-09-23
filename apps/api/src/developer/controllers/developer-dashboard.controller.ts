import { Controller, Get, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { DeveloperDashboardService } from '../services/developer-dashboard.service';

@Controller('developer/overview')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DeveloperDashboardController {
  constructor(private readonly dashboardService: DeveloperDashboardService) {}

  @Get()
  @RequirePermissions('developer.view')
  async getOverview(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const data = await this.dashboardService.getOverview(tenant.organizationId);
    return {
      success: true,
      data,
      message: 'Developer platform overview loaded',
    };
  }
}
