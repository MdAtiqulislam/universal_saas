import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CrmCustomer360Service } from './crm-customer-360.service';
import { Customer360QueryDto } from '../dto/customer-360-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/crm/customer-360')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CrmCustomer360Controller {
  constructor(private readonly customer360Service: CrmCustomer360Service) {}

  @Get(':customerId')
  @RequirePermissions('crm.customer-360.view')
  async getCustomer360(
    @CurrentTenant() tenant: TenantContext,
    @Param('customerId') customerId: string,
    @Query() query: Customer360QueryDto,
  ) {
    return this.customer360Service.getCustomer360(
      tenant.organizationId,
      customerId,
      query,
    );
  }
}
