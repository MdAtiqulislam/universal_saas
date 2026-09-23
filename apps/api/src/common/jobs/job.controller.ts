import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JobService } from './job.service';
import { CreateJobDto, JobQueryDto } from './job.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/jobs')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  @RequirePermissions('system.jobs.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateJobDto,
  ) {
    return this.jobService.createJob(tenant.organizationId, dto, tenant.userId);
  }

  @Get()
  @RequirePermissions('system.jobs.view')
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: JobQueryDto,
  ) {
    return this.jobService.listJobs(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('system.jobs.view')
  async get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.jobService.getJob(tenant.organizationId, id);
  }

  @Post(':id/cancel')
  @RequirePermissions('system.jobs.manage')
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.jobService.cancelJob(tenant.organizationId, id);
  }
}
