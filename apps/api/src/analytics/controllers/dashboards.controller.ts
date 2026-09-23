import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { DashboardsService } from '../services/dashboards.service';
import {
  CreateDashboardDto,
  UpdateDashboardDto,
  CreateDashboardWidgetDto,
  UpdateDashboardWidgetDto,
  CreateDashboardShareDto,
} from '../dto/dashboard.dto';
import { DashboardVisibility, ReportShareType } from '@prisma/client';

@Controller('analytics/dashboards')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Post()
  @RequirePermissions('analytics.dashboards.manage')
  async createDashboard(
    @Body() dto: CreateDashboardDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException(
        'Tenant and user context required (INV-512)',
      );
    }

    return this.dashboardsService.createDashboard({
      organizationId: tenant.organizationId,
      userId: req.user.id,
      dto,
    });
  }

  @Get()
  @RequirePermissions('analytics.dashboards.view')
  async listDashboards(
    @Query('visibility') visibility?: DashboardVisibility,
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-512)');
    }

    const userObj = req?.user as unknown as
      { roles?: string[]; teams?: string[] } | undefined;

    return this.dashboardsService.listDashboards({
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      userRoles: userObj?.roles ?? [],
      userTeams: userObj?.teams ?? [],
      visibility,
      search,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(':id')
  @RequirePermissions('analytics.dashboards.view')
  async getDashboard(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-512)');
    }

    const userObj = req?.user as unknown as
      | { roles?: string[]; teams?: string[]; permissions?: string[] }
      | undefined;

    return this.dashboardsService.getDashboard({
      id,
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      userRoles: userObj?.roles ?? [],
      userTeams: userObj?.teams ?? [],
      userPermissions: userObj?.permissions ?? [],
    });
  }

  @Patch(':id')
  @RequirePermissions('analytics.dashboards.manage')
  async updateDashboard(
    @Param('id') id: string,
    @Body() dto: UpdateDashboardDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-512)');
    }

    return this.dashboardsService.updateDashboard({
      id,
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      dto,
    });
  }

  @Delete(':id')
  @RequirePermissions('analytics.dashboards.manage')
  async deleteDashboard(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-512)');
    }

    return this.dashboardsService.deleteDashboard({
      id,
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
    });
  }

  @Post(':id/widgets')
  @RequirePermissions('analytics.dashboards.manage')
  async addWidget(
    @Param('id') id: string,
    @Body() dto: CreateDashboardWidgetDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-513)');
    }

    return this.dashboardsService.addWidget({
      dashboardId: id,
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      dto,
    });
  }

  @Patch(':id/widgets/:widgetId')
  @RequirePermissions('analytics.dashboards.manage')
  async updateWidget(
    @Param('id') id: string,
    @Param('widgetId') widgetId: string,
    @Body() dto: UpdateDashboardWidgetDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-513)');
    }

    return this.dashboardsService.updateWidget({
      widgetId,
      dashboardId: id,
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      dto,
    });
  }

  @Delete(':id/widgets/:widgetId')
  @RequirePermissions('analytics.dashboards.manage')
  async removeWidget(
    @Param('id') id: string,
    @Param('widgetId') widgetId: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-513)');
    }

    return this.dashboardsService.removeWidget({
      widgetId,
      dashboardId: id,
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
    });
  }

  @Post(':id/share')
  @RequirePermissions('analytics.dashboards.manage')
  async shareDashboard(
    @Param('id') id: string,
    @Body() dto: CreateDashboardShareDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-512)');
    }

    return this.dashboardsService.shareDashboard({
      dashboardId: id,
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      shareType: dto.shareType,
      targetId: dto.targetId,
    });
  }

  @Delete(':id/share/:shareType/:targetId')
  @RequirePermissions('analytics.dashboards.manage')
  async revokeShare(
    @Param('id') id: string,
    @Param('shareType') shareType: ReportShareType,
    @Param('targetId') targetId: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-512)');
    }

    await this.dashboardsService.revokeShare({
      dashboardId: id,
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      shareType,
      targetId,
    });

    return { success: true };
  }
}
