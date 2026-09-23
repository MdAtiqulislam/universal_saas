import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SecurityPoliciesService } from './security-policies.service';
import { UpdateSecurityPolicyDto } from '../dto/security-policies.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/security/policies')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class SecurityPoliciesController {
  constructor(private readonly policiesService: SecurityPoliciesService) {}

  @Get()
  @RequirePermissions('security.policies.view')
  async get(@CurrentTenant() tenant: TenantContext) {
    return this.policiesService.getPolicy(tenant.organizationId);
  }

  @Put()
  @RequirePermissions('security.policies.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateSecurityPolicyDto,
  ) {
    return this.policiesService.updatePolicy(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }
}
