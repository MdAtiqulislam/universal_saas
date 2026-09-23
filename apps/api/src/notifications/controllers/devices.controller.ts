import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { PushDeviceService } from '../services/push-device.service';
import { RegisterPushDeviceDto } from '../dto/device.dto';

@Controller('notifications/devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly deviceService: PushDeviceService) {}

  @Get()
  async listMyDevices(
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException(
        'Authentication and tenant context required',
      );
    }
    const devices = await this.deviceService.listUserDevices(
      tenant.organizationId,
      req.user.id,
    );
    return {
      success: true,
      data: devices,
    };
  }

  @Post()
  async registerDevice(
    @Body() dto: RegisterPushDeviceDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException(
        'Authentication and tenant context required',
      );
    }
    const device = await this.deviceService.registerDevice(
      tenant.organizationId,
      req.user.id,
      dto,
    );
    return {
      success: true,
      data: device,
      message: 'Push device registered successfully',
    };
  }

  @Delete()
  async unregisterDevice(
    @Body('deviceToken') deviceToken: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException(
        'Authentication and tenant context required',
      );
    }
    await this.deviceService.unregisterDevice(
      tenant.organizationId,
      req.user.id,
      deviceToken,
    );
    return {
      success: true,
      message: 'Push device unregistered',
    };
  }
}
