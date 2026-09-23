import {
  Controller,
  Get,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { EntitlementsService } from '../services/entitlements.service';

@Controller('billing/entitlements')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingEntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get()
  @RequirePermissions('billing.entitlements.read')
  async getSummary(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const summary = await this.entitlementsService.getEntitlementsSummary(
      tenant.organizationId,
    );
    return {
      success: true,
      data: summary,
      message: 'Tenant entitlements summary retrieved',
    };
  }

  @Get('check/:featureKey')
  @RequirePermissions('billing.entitlements.read')
  async checkFeature(
    @Param('featureKey') featureKey: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const entitled = await this.entitlementsService.hasFeature(
      tenant.organizationId,
      featureKey,
    );
    return {
      success: true,
      data: { featureKey, entitled },
      message: `Feature entitlement evaluated`,
    };
  }

  @Get('limit/:featureKey')
  @RequirePermissions('billing.entitlements.read')
  async getLimit(
    @Param('featureKey') featureKey: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const limit = await this.entitlementsService.getLimit(
      tenant.organizationId,
      featureKey,
    );
    return {
      success: true,
      data: { featureKey, ...limit },
      message: 'Feature limit retrieved',
    };
  }

  @Get('catalog')
  @RequirePermissions('billing.entitlements.read')
  async listCatalogFeatures() {
    const features = await this.entitlementsService.listCatalogFeatures();
    return {
      success: true,
      data: features,
      message: 'Catalog features retrieved',
    };
  }
}
