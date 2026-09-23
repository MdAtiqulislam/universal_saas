import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { WarrantyPoliciesService } from './warranty-policies.service';
import { WarrantyEligibilityService } from './warranty-eligibility.service';
import {
  CreateWarrantyPolicyDto,
  UpdateWarrantyPolicyDto,
  CheckWarrantyEligibilityDto,
  AssignAssetWarrantyDto,
} from '../dto/warranty-policy.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/service')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class WarrantyController {
  constructor(
    private readonly warrantyPoliciesService: WarrantyPoliciesService,
    private readonly warrantyEligibilityService: WarrantyEligibilityService,
  ) {}

  @Get('warranty-policies')
  @RequirePermissions('service.warranty.view')
  async findAllPolicies(
    @CurrentTenant() tenant: TenantContext,
    @Query('isActive') isActive?: string,
  ) {
    const filter =
      isActive !== undefined ? { isActive: isActive === 'true' } : undefined;
    return this.warrantyPoliciesService.findAll(tenant.organizationId, filter);
  }

  @Post('warranty-policies')
  @RequirePermissions('service.warranty.manage')
  @HttpCode(HttpStatus.CREATED)
  async createPolicy(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateWarrantyPolicyDto,
  ) {
    return this.warrantyPoliciesService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get('warranty-policies/:id')
  @RequirePermissions('service.warranty.view')
  async findOnePolicy(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.warrantyPoliciesService.findOne(tenant.organizationId, id);
  }

  @Patch('warranty-policies/:id')
  @RequirePermissions('service.warranty.manage')
  async updatePolicy(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarrantyPolicyDto,
  ) {
    return this.warrantyPoliciesService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post('warranty/check')
  @RequirePermissions('service.warranty.validate')
  @HttpCode(HttpStatus.OK)
  async checkEligibility(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CheckWarrantyEligibilityDto,
  ) {
    return this.warrantyEligibilityService.checkEligibility(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Post('customer-assets/:id/warranties')
  @RequirePermissions('service.warranty.manage')
  @HttpCode(HttpStatus.CREATED)
  async assignAssetWarranty(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) assetId: string,
    @Body() dto: AssignAssetWarrantyDto,
  ) {
    return this.warrantyPoliciesService.assignAssetWarranty(
      tenant.organizationId,
      assetId,
      dto,
      tenant.userId,
    );
  }
}
