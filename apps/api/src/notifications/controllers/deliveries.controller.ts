import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { DeliveryRepository } from '../repositories/delivery.repository';
import { NotificationDeliveryStatus } from '@prisma/client';

@Controller('notifications/deliveries')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DeliveriesController {
  constructor(private readonly deliveryRepo: DeliveryRepository) {}

  @Get()
  @RequirePermissions('notifications.deliveries.read')
  async listDeliveries(
    @Query('notificationId') notificationId?: string,
    @Query('status') status?: NotificationDeliveryStatus,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const offset = (page - 1) * limit;

    const result = await this.deliveryRepo.listDeliveries({
      organizationId: tenant.organizationId,
      notificationId,
      status,
      limit,
      offset,
    });

    return {
      success: true,
      data: result.items,
      meta: {
        total: result.total,
        page,
        limit,
      },
    };
  }

  @Get(':id')
  @RequirePermissions('notifications.deliveries.read')
  async getDelivery(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const delivery = await this.deliveryRepo.findDeliveryById(
      id,
      tenant.organizationId,
    );
    return {
      success: true,
      data: delivery,
    };
  }
}
