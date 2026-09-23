import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CrmPipelineService } from './crm-pipeline.service';
import { PipelineForecastQueryDto } from '../dto/pipeline-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/crm/pipeline')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CrmPipelineController {
  constructor(private readonly pipelineService: CrmPipelineService) {}

  @Get('summary')
  @RequirePermissions('crm.pipeline.view')
  async getSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query() filter: PipelineForecastQueryDto,
  ) {
    return this.pipelineService.getPipelineSummary(
      tenant.organizationId,
      filter,
    );
  }

  @Get('stages')
  @RequirePermissions('crm.pipeline.view')
  async getStages(
    @CurrentTenant() tenant: TenantContext,
    @Query('ownerEmployeeId') ownerEmployeeId?: string,
  ) {
    return this.pipelineService.getStageBreakdown(
      tenant.organizationId,
      ownerEmployeeId,
    );
  }
}
