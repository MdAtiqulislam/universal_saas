import {
  Controller,
  Get,
  Post,
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
import { ChannelRouterService } from '../services/channel-router.service';
import { ConfigureProviderDto, TestProviderDto } from '../dto/provider.dto';

@Controller('notifications/providers')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProvidersController {
  constructor(
    private readonly preferencesService: NotificationPreferencesService,
    private readonly routerService: ChannelRouterService,
  ) {}

  @Get()
  @RequirePermissions('notifications.providers.read')
  async listProviders(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const configs = await this.preferencesService.getProviderConfigs(
      tenant.organizationId,
    );
    return {
      success: true,
      data: configs,
    };
  }

  @Post()
  @RequirePermissions('notifications.providers.manage')
  async configureProvider(
    @Body() dto: ConfigureProviderDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const result = await this.preferencesService.configureProvider(
      tenant.organizationId,
      dto,
      req?.user?.id,
    );
    return {
      success: true,
      data: result,
      message: 'Provider configuration saved',
    };
  }

  @Post('test')
  @RequirePermissions('notifications.providers.manage')
  async testProvider(
    @Body() dto: TestProviderDto,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const adapter = this.routerService.getAdapter(dto.providerKey);
    if (!adapter) {
      return {
        success: false,
        message: `Provider adapter '${dto.providerKey}' is not registered`,
      };
    }
    const health = await adapter.healthCheck();
    return {
      success: health.status === 'HEALTHY',
      data: health,
    };
  }
}
