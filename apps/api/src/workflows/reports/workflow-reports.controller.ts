import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { WorkflowReportsService } from './workflow-reports.service';
import { QueryWorkflowReportsDto } from './dto/query-reports.dto';

interface OrgRequest extends AuthenticatedRequest {
  organizationId?: string;
  user: {
    id: string;
    sessionId: string;
    organizationId?: string;
  };
}

@Controller('workflow-reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WorkflowReportsController {
  constructor(private readonly service: WorkflowReportsService) {}

  private getOrgId(req: OrgRequest): string {
    const orgId =
      req.user.organizationId ||
      req.organizationId ||
      ((req.headers && req.headers['x-organization-id']) as string);
    if (orgId) return orgId;
    throw new Error('Organization context not found in request');
  }

  @Get('overview')
  @RequirePermissions('workflows.reports.view')
  getOverview(@Req() req: OrgRequest, @Query() query: QueryWorkflowReportsDto) {
    return this.service.getOverviewReport(this.getOrgId(req), query);
  }

  @Get('success-failure')
  @RequirePermissions('workflows.reports.view')
  getSuccessFailure(
    @Req() req: OrgRequest,
    @Query() query: QueryWorkflowReportsDto,
  ) {
    return this.service.getSuccessFailureReport(this.getOrgId(req), query);
  }

  @Get('performance')
  @RequirePermissions('workflows.reports.view')
  getPerformance(
    @Req() req: OrgRequest,
    @Query() query: QueryWorkflowReportsDto,
  ) {
    return this.service.getPerformanceReport(this.getOrgId(req), query);
  }

  @Get('failures')
  @RequirePermissions('workflows.reports.view')
  getFailures(@Req() req: OrgRequest, @Query() query: QueryWorkflowReportsDto) {
    return this.service.getFailuresReport(this.getOrgId(req), query);
  }

  @Get('approval-queue')
  @RequirePermissions('workflows.reports.view')
  getApprovalQueue(@Req() req: OrgRequest) {
    return this.service.getApprovalQueueReport(this.getOrgId(req));
  }

  @Get('approval-sla')
  @RequirePermissions('workflows.reports.view')
  getApprovalSla(
    @Req() req: OrgRequest,
    @Query() query: QueryWorkflowReportsDto,
  ) {
    return this.service.getApprovalSlaReport(this.getOrgId(req), query);
  }

  @Get('action-failures')
  @RequirePermissions('workflows.reports.view')
  getActionFailures(
    @Req() req: OrgRequest,
    @Query() query: QueryWorkflowReportsDto,
  ) {
    return this.service.getActionFailuresReport(this.getOrgId(req), query);
  }

  @Get('rule-evaluations')
  @RequirePermissions('workflows.reports.view')
  getRuleEvaluations(@Req() req: OrgRequest) {
    return this.service.getRuleEvaluationsReport(this.getOrgId(req));
  }

  @Get('schedules')
  @RequirePermissions('workflows.reports.view')
  getSchedules(@Req() req: OrgRequest) {
    return this.service.getSchedulesReport(this.getOrgId(req));
  }

  @Get('adoption')
  @RequirePermissions('workflows.reports.view')
  getAdoption(@Req() req: OrgRequest, @Query() query: QueryWorkflowReportsDto) {
    return this.service.getAdoptionReport(this.getOrgId(req), query);
  }
}
