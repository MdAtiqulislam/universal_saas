import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ShipmentTrackingService } from './shipment-tracking.service';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { ShipmentTrackingEvent } from '@prisma/client';

@Controller('api/v1/shipping/shipments/:id/tracking')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ShipmentTrackingController {
  constructor(private readonly trackingService: ShipmentTrackingService) {}

  @Get()
  @RequirePermissions('shipping.shipments.view')
  async getTrackingHistory(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{
    shipmentId: string;
    shipmentNumber: string;
    carrierName: string | null;
    trackingNumber: string | null;
    currentStatus: string;
    events: ShipmentTrackingEvent[];
  }> {
    return this.trackingService.getTrackingHistory(tenant.organizationId, id);
  }

  @Post()
  @RequirePermissions('shipping.shipments.track')
  async addTrackingEvent(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTrackingEventDto,
  ): Promise<ShipmentTrackingEvent> {
    return this.trackingService.addTrackingEvent(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }
}
