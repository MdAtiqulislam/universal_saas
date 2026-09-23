import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { QualityHoldsService } from './quality-holds.service';
import {
  CreateQualityHoldDto,
  ReleaseQualityHoldDto,
  QueryQualityHoldsDto,
} from './dto/quality-hold.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/quality/holds')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class QualityHoldsController {
  constructor(private readonly holdsService: QualityHoldsService) {}

  @Get()
  @RequirePermissions('quality.holds.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryQualityHoldsDto,
  ) {
    return this.holdsService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('quality.holds.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.holdsService.findOne(tenant.organizationId, id);
  }

  @Post()
  @RequirePermissions('quality.holds.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateQualityHoldDto,
  ) {
    return this.holdsService.create(tenant.organizationId, dto, tenant.userId);
  }

  @Post(':id/release')
  @RequirePermissions('quality.holds.release')
  async release(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReleaseQualityHoldDto,
  ) {
    return this.holdsService.release(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }
}
