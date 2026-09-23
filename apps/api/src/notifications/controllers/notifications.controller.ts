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
import { NotificationsService } from '../services/notifications.service';
import {
  SendNotificationDto,
  QueryNotificationsDto,
} from '../dto/notification.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @RequirePermissions('notifications.send')
  async sendNotification(
    @Body() dto: SendNotificationDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const result = await this.notificationsService.notify(
      tenant.organizationId,
      dto,
      req?.user?.id,
    );
    return {
      success: true,
      data: result,
      message: result.isDuplicate
        ? 'Duplicate notification skipped via idempotency'
        : 'Notification dispatched successfully',
    };
  }

  @Get()
  async listMyNotifications(
    @Query() query: QueryNotificationsDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException(
        'Authentication and tenant context required',
      );
    }
    const result = await this.notificationsService.listUserNotifications(
      tenant.organizationId,
      req.user.id,
      query,
      tenant.organizationId,
    );
    return {
      success: true,
      data: result.items,
      meta: {
        total: result.total,
        unreadCount: result.unreadCount,
      },
    };
  }

  @Get(':id')
  @RequirePermissions('notifications.read')
  async getNotification(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const notif = await this.notificationsService.getNotification(
      id,
      tenant.organizationId,
    );
    return {
      success: true,
      data: notif,
    };
  }

  @Post(':recipientId/read')
  async markRead(
    @Param('recipientId') recipientId: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException(
        'Authentication and tenant context required',
      );
    }
    const res = await this.notificationsService.markRead(
      recipientId,
      tenant.organizationId,
      req.user.id,
    );
    return {
      success: true,
      data: res,
      message: 'Notification marked as read',
    };
  }

  @Post('read-all')
  async markAllRead(
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException(
        'Authentication and tenant context required',
      );
    }
    const res = await this.notificationsService.markAllRead(
      tenant.organizationId,
      req.user.id,
    );
    return {
      success: true,
      data: res,
      message: 'All notifications marked as read',
    };
  }
}
