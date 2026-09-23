import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CrmActivitiesService } from './crm-activities.service';
import {
  CreateCrmActivityDto,
  UpdateCrmActivityDto,
  CompleteCrmActivityDto,
  ActivityQueryDto,
} from '../dto/activity.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/crm/activities')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CrmActivitiesController {
  constructor(private readonly activitiesService: CrmActivitiesService) {}

  @Post()
  @RequirePermissions('crm.activities.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCrmActivityDto,
  ) {
    return this.activitiesService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('crm.activities.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ActivityQueryDto,
  ) {
    return this.activitiesService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('crm.activities.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.activitiesService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('crm.activities.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCrmActivityDto,
  ) {
    return this.activitiesService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/complete')
  @RequirePermissions('crm.activities.complete')
  async complete(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: CompleteCrmActivityDto,
  ) {
    return this.activitiesService.complete(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Delete(':id')
  @RequirePermissions('crm.activities.manage')
  async delete(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.activitiesService.delete(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
