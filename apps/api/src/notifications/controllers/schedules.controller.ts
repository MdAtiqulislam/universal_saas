import {
  Controller,
  Get,
  Post,
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
import { NotificationSchedulingService } from '../services/notification-scheduling.service';
import { BulkNotificationsService } from '../services/bulk-notifications.service';
import { CreateScheduleDto, BulkNotificationDto } from '../dto/schedule.dto';

@Controller('notifications/schedules')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SchedulesController {
  constructor(
    private readonly schedulingService: NotificationSchedulingService,
    private readonly bulkService: BulkNotificationsService,
  ) {}

  @Get()
  @RequirePermissions('notifications.schedules.read')
  async listSchedules(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const schedules = await this.schedulingService.listSchedules(
      tenant.organizationId,
    );
    return {
      success: true,
      data: schedules,
    };
  }

  @Post()
  @RequirePermissions('notifications.schedules.manage')
  async scheduleNotification(
    @Body() dto: CreateScheduleDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const schedule = await this.schedulingService.scheduleNotification(
      tenant.organizationId,
      dto,
      req?.user?.id,
    );
    return {
      success: true,
      data: schedule,
      message: 'Notification scheduled successfully',
    };
  }

  @Post('bulk')
  @RequirePermissions('notifications.send')
  async sendBulk(
    @Body() dto: BulkNotificationDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const result = await this.bulkService.sendBulk(
      tenant.organizationId,
      dto,
      req?.user?.id,
    );
    return {
      success: true,
      data: result,
      message: `Bulk notification completed. Processed ${result.totalRecipients} recipients in ${result.batchesCount} batches.`,
    };
  }

  @Delete(':id')
  @RequirePermissions('notifications.schedules.manage')
  async cancelSchedule(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const cancelled = await this.schedulingService.cancelSchedule(
      id,
      tenant.organizationId,
      req?.user?.id,
    );
    return {
      success: true,
      data: cancelled,
      message: 'Scheduled notification cancelled',
    };
  }
}
