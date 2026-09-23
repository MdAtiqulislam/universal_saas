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
import { SavedReportsService } from '../services/saved-reports.service';
import { ReportExecutionService } from '../services/report-execution.service';
import {
  CreateSavedReportDto,
  UpdateSavedReportDto,
  QuerySavedReportsDto,
} from '../dto/saved-report.dto';
import { CreateReportShareDto } from '../dto/report-share.dto';
import { ReportShareType } from '@prisma/client';

@Controller('analytics/reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SavedReportsController {
  constructor(
    private readonly reportsService: SavedReportsService,
    private readonly executionService: ReportExecutionService,
  ) {}

  @Post()
  @RequirePermissions('analytics.reports.create')
  async createReport(
    @Body() dto: CreateSavedReportDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException(
        'Tenant and user context required (INV-506)',
      );
    }

    return this.reportsService.createReport({
      organizationId: tenant.organizationId,
      userId: req.user.id,
      dto,
    });
  }

  @Get()
  @RequirePermissions('analytics.reports.view')
  async listReports(
    @Query() queryDto: QuerySavedReportsDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-506)');
    }

    const userObj = req?.user as unknown as
      { roles?: string[]; teams?: string[] } | undefined;

    return this.reportsService.listReports({
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      userRoles: userObj?.roles ?? [],
      userTeams: userObj?.teams ?? [],
      queryDto,
    });
  }

  @Get(':id')
  @RequirePermissions('analytics.reports.view')
  async getReport(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-506)');
    }

    const userObj = req?.user as unknown as
      { roles?: string[]; teams?: string[] } | undefined;

    return this.reportsService.getReport({
      id,
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      userRoles: userObj?.roles ?? [],
      userTeams: userObj?.teams ?? [],
    });
  }

  @Patch(':id')
  @RequirePermissions('analytics.reports.update')
  async updateReport(
    @Param('id') id: string,
    @Body() dto: UpdateSavedReportDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-506)');
    }

    return this.reportsService.updateReport({
      id,
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      dto,
    });
  }

  @Delete(':id')
  @RequirePermissions('analytics.reports.delete')
  async deleteReport(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-506)');
    }

    return this.reportsService.deleteReport({
      id,
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
    });
  }

  @Post(':id/execute')
  @RequirePermissions('analytics.query.execute')
  async executeReport(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-509)');
    }

    const userObj = req?.user as unknown as
      { permissions?: string[] } | undefined;
    const permissions: string[] = Array.isArray(userObj?.permissions)
      ? userObj.permissions
      : [];

    return this.executionService.executeSavedReport({
      savedReportId: id,
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      userPermissions: permissions,
    });
  }

  @Post(':id/share')
  @RequirePermissions('analytics.reports.share')
  async shareReport(
    @Param('id') id: string,
    @Body() dto: CreateReportShareDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-508)');
    }

    return this.reportsService.shareReport({
      savedReportId: id,
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      shareType: dto.shareType,
      targetId: dto.targetId,
    });
  }

  @Delete(':id/share/:shareType/:targetId')
  @RequirePermissions('analytics.reports.share')
  async revokeShare(
    @Param('id') id: string,
    @Param('shareType') shareType: ReportShareType,
    @Param('targetId') targetId: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-508)');
    }

    await this.reportsService.revokeShare({
      savedReportId: id,
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      shareType,
      targetId,
    });

    return { success: true };
  }

  @Get(':id/shares')
  @RequirePermissions('analytics.reports.view')
  async listShares(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-508)');
    }

    return this.reportsService.listShares({
      savedReportId: id,
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
    });
  }

  @Get(':id/executions')
  @RequirePermissions('analytics.reports.view')
  async listExecutions(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-509)');
    }

    return this.executionService.getExecutionHistory({
      organizationId: tenant.organizationId,
      savedReportId: id,
    });
  }
}
