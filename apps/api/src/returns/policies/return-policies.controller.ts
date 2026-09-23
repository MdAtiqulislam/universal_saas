import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ReturnPoliciesService } from './return-policies.service';
import { UpdateReturnPolicyDto } from './dto/return-policy.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/returns/policy')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ReturnPoliciesController {
  constructor(private readonly policiesService: ReturnPoliciesService) {}

  @Get()
  @RequirePermissions('returns.view')
  async getPolicy(@CurrentTenant() tenant: TenantContext) {
    return this.policiesService.getPolicy(tenant.organizationId);
  }

  @Patch()
  @RequirePermissions('returns.manage')
  async updatePolicy(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateReturnPolicyDto,
  ) {
    return this.policiesService.updatePolicy(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }
}
