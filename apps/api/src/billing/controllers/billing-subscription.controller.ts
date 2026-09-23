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
import { SubscriptionsService } from '../services/subscriptions.service';
import {
  CreateSubscriptionDto,
  UpgradeSubscriptionDto,
  CancelSubscriptionDto,
} from '../dto/billing-subscription.dto';

@Controller('billing/subscription')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingSubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionsService) {}

  @Get()
  @RequirePermissions('billing.subscription.read')
  async getCurrentSubscription(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const sub = await this.subscriptionService.getActiveSubscription(
      tenant.organizationId,
    );
    return {
      success: true,
      data: sub,
      message: 'Active subscription retrieved',
    };
  }

  @Post()
  @RequirePermissions('billing.subscription.manage')
  async createSubscription(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateSubscriptionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const sub = await this.subscriptionService.createSubscription(
      tenant.organizationId,
      dto,
      req.user?.id,
    );
    return {
      success: true,
      data: sub,
      message: 'Subscription created',
    };
  }

  @Post('upgrade')
  @RequirePermissions('billing.subscription.manage')
  async upgradeSubscription(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpgradeSubscriptionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const result = await this.subscriptionService.upgradeSubscription(
      tenant.organizationId,
      dto,
      req.user?.id,
    );
    return {
      success: true,
      data: result,
      message: 'Subscription upgraded successfully',
    };
  }

  @Post('cancel')
  @RequirePermissions('billing.subscription.manage')
  async cancelSubscription(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CancelSubscriptionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const sub = await this.subscriptionService.cancelSubscription(
      tenant.organizationId,
      dto,
      req.user?.id,
    );
    return {
      success: true,
      data: sub,
      message: 'Subscription cancelled',
    };
  }

  @Post('pause')
  @RequirePermissions('billing.subscription.manage')
  async pauseSubscription(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const sub = await this.subscriptionService.pauseSubscription(
      tenant.organizationId,
      req.user?.id,
    );
    return {
      success: true,
      data: sub,
      message: 'Subscription paused',
    };
  }

  @Post('resume')
  @RequirePermissions('billing.subscription.manage')
  async resumeSubscription(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const sub = await this.subscriptionService.resumeSubscription(
      tenant.organizationId,
      req.user?.id,
    );
    return {
      success: true,
      data: sub,
      message: 'Subscription resumed',
    };
  }
}
