import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SupplierQualityService } from './supplier-quality.service';
import { QuerySupplierQualityDto } from './dto/quality-analytics.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/quality/supplier-quality')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class SupplierQualityController {
  constructor(
    private readonly supplierQualityService: SupplierQualityService,
  ) {}

  @Get('summary')
  @RequirePermissions('quality.supplier-quality.view')
  async getSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QuerySupplierQualityDto,
  ) {
    return this.supplierQualityService.getSupplierQualitySummary(
      tenant.organizationId,
      query,
    );
  }

  @Get(':id/scorecard')
  @RequirePermissions('quality.supplier-quality.view')
  async getScorecard(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.supplierQualityService.getSupplierScorecard(
      tenant.organizationId,
      id,
    );
  }
}
