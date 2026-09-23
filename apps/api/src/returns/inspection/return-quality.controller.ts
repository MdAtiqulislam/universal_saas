import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ReturnQualityIntegrationService } from './return-quality-integration.service';
import { RequestReturnInspectionDto } from './dto/request-inspection.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/returns')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ReturnQualityController {
  constructor(
    private readonly qualityIntegrationService: ReturnQualityIntegrationService,
  ) {}

  @Post(':id/request-inspection')
  @RequirePermissions('returns.inspection.request')
  async requestInspection(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestReturnInspectionDto,
  ) {
    return this.qualityIntegrationService.requestInspection(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/sync-inspection')
  @RequirePermissions('returns.inspection.request')
  async syncInspection(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.qualityIntegrationService.syncInspectionResult(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
