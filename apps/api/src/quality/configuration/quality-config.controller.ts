import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { QualityConfigService } from './quality-config.service';
import { UpdateQualityConfigDto } from './dto/quality-config.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/quality/configuration')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class QualityConfigController {
  constructor(private readonly configService: QualityConfigService) {}

  @Get()
  @RequirePermissions('quality.configuration.view')
  async getConfig(@CurrentTenant() tenant: TenantContext) {
    return this.configService.getConfig(tenant.organizationId);
  }

  @Patch()
  @RequirePermissions('quality.configuration.manage')
  async updateConfig(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateQualityConfigDto,
  ) {
    return this.configService.updateConfig(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }
}
