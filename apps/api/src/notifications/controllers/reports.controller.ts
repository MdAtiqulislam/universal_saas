import {
  Controller,
  Get,
  Param,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { NotificationDashboardService } from '../services/notification-dashboard.service';
import { NotificationReportsService } from '../services/notification-reports.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class NotificationReportsController {
  constructor(
    private readonly dashboardService: NotificationDashboardService,
    private readonly reportsService: NotificationReportsService,
  ) {}

  @Get('dashboard')
  @RequirePermissions('notifications.read')
  async getDashboard(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const summary = await this.dashboardService.getDashboardSummary(
      tenant.organizationId,
    );
    return {
      success: true,
      data: summary,
    };
  }

  @Get('reports/:reportType')
  @RequirePermissions('notifications.reports.read')
  async getReport(
    @Param('reportType') reportType: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const orgId = tenant.organizationId;

    let data: unknown;
    switch (reportType) {
      case 'volume':
        data = await this.reportsService.getNotificationVolumeReport(orgId);
        break;
      case 'success-rate':
        data = await this.reportsService.getDeliverySuccessRateReport(orgId);
        break;
      case 'failure-rate':
        data = await this.reportsService.getDeliveryFailureRateReport(orgId);
        break;
      case 'channels':
        data = await this.reportsService.getChannelDistributionReport(orgId);
        break;
      case 'providers':
        data = await this.reportsService.getProviderPerformanceReport(orgId);
        break;
      case 'bounces':
        data = await this.reportsService.getBounceReport(orgId);
        break;
      case 'preferences':
        data = await this.reportsService.getPreferenceAdoptionReport(orgId);
        break;
      case 'schedules':
        data = await this.reportsService.getScheduledNotificationReport(orgId);
        break;
      case 'retries':
        data = await this.reportsService.getRetryFailureAnalysisReport(orgId);
        break;
      case 'usage':
        data =
          await this.reportsService.getTenantCommunicationUsageReport(orgId);
        break;
      default:
        throw new NotFoundException(
          `Unknown notification report type '${reportType}'`,
        );
    }

    return {
      success: true,
      reportType,
      data,
    };
  }
}
