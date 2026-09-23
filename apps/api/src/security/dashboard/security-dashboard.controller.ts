import { Controller, Get, UseGuards } from '@nestjs/common';
import { SecurityDashboardService } from './security-dashboard.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/security/dashboard')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class SecurityDashboardController {
  constructor(private readonly dashboardService: SecurityDashboardService) {}

  @Get()
  @RequirePermissions('security.view')
  async getSummary(@CurrentTenant() tenant: TenantContext) {
    return this.dashboardService.getDashboardSummary(tenant.organizationId);
  }
}
