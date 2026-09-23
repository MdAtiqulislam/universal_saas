import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { ReportSchedulingService } from '../services/report-scheduling.service';
import {
  CreateReportScheduleDto,
  UpdateReportScheduleDto,
} from '../dto/report-schedule.dto';

@Controller('analytics/schedules')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReportSchedulesController {
  constructor(private readonly scheduleService: ReportSchedulingService) {}

  @Post()
  @RequirePermissions('analytics.schedules.manage')
  async createSchedule(
    @Body() dto: CreateReportScheduleDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-518)');
    }

    const userObj = req?.user as unknown as
      { permissions?: string[] } | undefined;
    const permissions: string[] = Array.isArray(userObj?.permissions)
      ? userObj.permissions
      : [];

    return this.scheduleService.createSchedule({
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      userPermissions: permissions,
      dto,
    });
  }

  @Get()
  @RequirePermissions('analytics.schedules.manage')
  async listSchedules(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-510)');
    }

    return this.scheduleService.listSchedules(tenant.organizationId);
  }

  @Get(':id')
  @RequirePermissions('analytics.schedules.manage')
  async getSchedule(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-510)');
    }

    return this.scheduleService.getSchedule(id, tenant.organizationId);
  }

  @Patch(':id')
  @RequirePermissions('analytics.schedules.manage')
  async updateSchedule(
    @Param('id') id: string,
    @Body() dto: UpdateReportScheduleDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-518)');
    }

    return this.scheduleService.updateSchedule({
      id,
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      dto,
    });
  }

  @Delete(':id')
  @RequirePermissions('analytics.schedules.manage')
  async deleteSchedule(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-518)');
    }

    return this.scheduleService.deleteSchedule(
      id,
      tenant.organizationId,
      req?.user?.id,
    );
  }
}
