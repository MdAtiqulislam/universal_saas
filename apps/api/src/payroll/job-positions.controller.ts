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
import { JobPositionsService } from './job-positions.service';
import {
  CreateJobPositionDto,
  UpdateJobPositionDto,
} from './dto/create-job-position.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../organizations/interfaces/tenant-context.interface';

@Controller('hr/job-positions')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class JobPositionsController {
  constructor(private readonly jobPositionsService: JobPositionsService) {}

  @Get()
  @RequirePermissions('hr.positions.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.jobPositionsService.findAll(
      tenant.organizationId,
      departmentId,
    );
  }

  @Post()
  @RequirePermissions('hr.positions.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateJobPositionDto,
  ) {
    return this.jobPositionsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get(':id')
  @RequirePermissions('hr.positions.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.jobPositionsService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('hr.positions.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateJobPositionDto,
  ) {
    return this.jobPositionsService.update(tenant.organizationId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('hr.positions.manage')
  async delete(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.jobPositionsService.delete(tenant.organizationId, id);
  }
}
