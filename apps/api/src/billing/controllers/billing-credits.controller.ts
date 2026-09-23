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
import { CreditsDiscountsService } from '../services/credits-discounts.service';
import {
  GrantCreditDto,
  CreateDiscountDto,
} from '../dto/billing-credit-discount.dto';

@Controller('billing/credits')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingCreditsController {
  constructor(private readonly creditsService: CreditsDiscountsService) {}

  @Get()
  @RequirePermissions('billing.read')
  async getCreditBalance(@CurrentTenant() tenant: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const [balance, history] = await Promise.all([
      this.creditsService.getAvailableCredit(tenant.organizationId),
      this.creditsService.listCredits(tenant.organizationId),
    ]);
    return {
      success: true,
      data: { availableCredit: balance, history },
      message: 'Credit ledger retrieved',
    };
  }

  @Post('grant')
  @RequirePermissions('billing.credits.manage')
  async grantCredit(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: GrantCreditDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const credit = await this.creditsService.grantCredit(
      tenant.organizationId,
      dto,
      req.user?.id,
    );
    return {
      success: true,
      data: credit,
      message: 'Credit granted successfully',
    };
  }

  @Post('discounts')
  @RequirePermissions('billing.discounts.manage')
  async createDiscount(
    @Body() dto: CreateDiscountDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const discount = await this.creditsService.createDiscount(
      dto,
      req.user?.id,
    );
    return {
      success: true,
      data: discount,
      message: 'Discount created successfully',
    };
  }

  @Get('discounts')
  @RequirePermissions('billing.discounts.manage')
  async listDiscounts() {
    const discounts = await this.creditsService.listDiscounts();
    return {
      success: true,
      data: discounts,
      message: 'Discounts retrieved',
    };
  }

  @Post('discounts/validate')
  @RequirePermissions('billing.read')
  async validateDiscount(
    @Body('code') code: string,
    @Body('subtotal') subtotal?: number,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    const result = await this.creditsService.validateDiscount(
      code,
      tenant?.organizationId,
      subtotal ? Number(subtotal) : 0,
    );
    return {
      success: true,
      data: result,
      message: 'Discount validated',
    };
  }
}
