import {
  Controller,
  Get,
  Put,
  Body,
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
import { NotificationPreferencesService } from '../services/notification-preferences.service';
import { UpdatePreferenceDto, UpdatePolicyDto } from '../dto/preference.dto';

@Controller('notifications/preferences')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PreferencesController {
  constructor(
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

  @Get()
  async getMyPreferences(
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException(
        'Authentication and tenant context required',
      );
    }
    const preferences = await this.preferencesService.getUserPreferences(
      tenant.organizationId,
      req.user.id,
      tenant.organizationId,
    );
    return {
      success: true,
      data: preferences,
    };
  }

  @Put()
  async updateMyPreference(
    @Body() dto: UpdatePreferenceDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException(
        'Authentication and tenant context required',
      );
    }
    const updated = await this.preferencesService.updateUserPreference(
      tenant.organizationId,
      req.user.id,
      dto,
      tenant.organizationId,
    );
    return {
      success: true,
      data: updated,
      message: 'Notification preference updated',
    };
  }

  @Get('policies')
  @RequirePermissions('notifications.preferences.read')
  async getPolicies(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const policies = await this.preferencesService.getCommunicationPolicies(
      tenant.organizationId,
    );
    return {
      success: true,
      data: policies,
    };
  }

  @Put('policies')
  @RequirePermissions('notifications.preferences.manage')
  async updatePolicy(
    @Body() dto: UpdatePolicyDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const updated = await this.preferencesService.updateCommunicationPolicy(
      tenant.organizationId,
      dto,
      req?.user?.id,
    );
    return {
      success: true,
      data: updated,
      message: 'Communication policy updated',
    };
  }
}
