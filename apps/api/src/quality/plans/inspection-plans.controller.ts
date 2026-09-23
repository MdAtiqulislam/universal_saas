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
import { InspectionPlansService } from './inspection-plans.service';
import {
  CreateInspectionPlanDto,
  UpdateInspectionPlanDto,
  QueryInspectionPlansDto,
} from './dto/inspection-plan.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/quality/inspection-plans')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class InspectionPlansController {
  constructor(private readonly plansService: InspectionPlansService) {}

  @Get()
  @RequirePermissions('quality.inspection-plans.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryInspectionPlansDto,
  ) {
    return this.plansService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('quality.inspection-plans.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.plansService.findOne(tenant.organizationId, id);
  }

  @Post()
  @RequirePermissions('quality.inspection-plans.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateInspectionPlanDto,
  ) {
    return this.plansService.create(tenant.organizationId, dto, tenant.userId);
  }

  @Patch(':id')
  @RequirePermissions('quality.inspection-plans.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInspectionPlanDto,
  ) {
    return this.plansService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/activate')
  @RequirePermissions('quality.inspection-plans.approve')
  async activate(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.plansService.activate(tenant.organizationId, id, tenant.userId);
  }

  @Post(':id/deactivate')
  @RequirePermissions('quality.inspection-plans.manage')
  async deactivate(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.plansService.deactivate(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
