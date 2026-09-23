import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SamplingPlansService } from './sampling-plans.service';
import {
  CreateSamplingPlanDto,
  UpdateSamplingPlanDto,
  QuerySamplingPlansDto,
} from './dto/sampling-plan.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/quality/sampling-plans')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class SamplingPlansController {
  constructor(private readonly samplingService: SamplingPlansService) {}

  @Get()
  @RequirePermissions('quality.sampling.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QuerySamplingPlansDto,
  ) {
    return this.samplingService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('quality.sampling.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.samplingService.findOne(tenant.organizationId, id);
  }

  @Post()
  @RequirePermissions('quality.sampling.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateSamplingPlanDto,
  ) {
    return this.samplingService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Patch(':id')
  @RequirePermissions('quality.sampling.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSamplingPlanDto,
  ) {
    return this.samplingService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }
}
