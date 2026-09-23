import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { WorkflowApprovalsService } from './workflow-approvals.service';
import {
  ApprovalDecisionDto,
  DelegateApprovalDto,
  QueryApprovalsDto,
} from './dto/approval-action.dto';

interface OrgRequest extends AuthenticatedRequest {
  organizationId?: string;
  user: {
    id: string;
    sessionId: string;
    organizationId?: string;
  };
}

@Controller('workflow-approvals')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WorkflowApprovalsController {
  constructor(private readonly service: WorkflowApprovalsService) {}

  private getOrgId(req: OrgRequest): string {
    const orgId =
      req.user.organizationId ||
      req.organizationId ||
      ((req.headers && req.headers['x-organization-id']) as string);
    if (orgId) return orgId;
    throw new Error('Organization context not found in request');
  }

  @Get()
  @RequirePermissions('workflows.approvals.view')
  listApprovals(@Req() req: OrgRequest, @Query() query: QueryApprovalsDto) {
    return this.service.listApprovals(this.getOrgId(req), query);
  }

  @Get(':id')
  @RequirePermissions('workflows.approvals.view')
  getApproval(@Req() req: OrgRequest, @Param('id') id: string) {
    return this.service.getApproval(this.getOrgId(req), id);
  }

  @Post(':id/approve')
  @RequirePermissions('workflows.approvals.approve')
  approve(
    @Req() req: OrgRequest,
    @Param('id') id: string,
    @Body() dto: Omit<ApprovalDecisionDto, 'decision'>,
  ) {
    return this.service.recordDecision(
      this.getOrgId(req),
      id,
      { ...dto, decision: 'APPROVED' },
      req.user.id,
    );
  }

  @Post(':id/reject')
  @RequirePermissions('workflows.approvals.reject')
  reject(
    @Req() req: OrgRequest,
    @Param('id') id: string,
    @Body() dto: Omit<ApprovalDecisionDto, 'decision'>,
  ) {
    return this.service.recordDecision(
      this.getOrgId(req),
      id,
      { ...dto, decision: 'REJECTED' },
      req.user.id,
    );
  }

  @Post(':id/delegate')
  @RequirePermissions('workflows.approvals.delegate')
  delegate(
    @Req() req: OrgRequest,
    @Param('id') id: string,
    @Body() dto: DelegateApprovalDto,
  ) {
    return this.service.delegateApproval(
      this.getOrgId(req),
      id,
      dto,
      req.user.id,
    );
  }
}
