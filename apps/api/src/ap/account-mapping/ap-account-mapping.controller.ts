import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import {
  ApAccountMappingService,
  AccountingAccountMappingWithAccount,
} from './ap-account-mapping.service';
import { UpsertAccountMappingDto } from './dto/upsert-mapping.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('ap/account-mappings')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ApAccountMappingController {
  constructor(private readonly mappingService: ApAccountMappingService) {}

  @Get()
  @RequirePermissions('ap.account-mapping.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<AccountingAccountMappingWithAccount[]> {
    return this.mappingService.findAll(tenant.organizationId);
  }

  @Put(':key')
  @RequirePermissions('ap.account-mapping.manage')
  async upsert(
    @CurrentTenant() tenant: TenantContext,
    @Param('key') key: string,
    @Body() dto: UpsertAccountMappingDto,
  ): Promise<AccountingAccountMappingWithAccount> {
    return this.mappingService.upsertMapping(
      tenant.organizationId,
      key,
      dto.accountId,
      tenant.userId,
    );
  }
}
