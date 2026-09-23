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
import { WorkflowExecutionService } from './workflow-execution.service';
import {
  ExecuteWorkflowDto,
  RetryExecutionDto,
  QueryExecutionsDto,
} from './dto/execute-workflow.dto';

interface OrgRequest extends AuthenticatedRequest {
  organizationId?: string;
  user: {
    id: string;
    sessionId: string;
    organizationId?: string;
  };
}

@Controller('workflow-executions')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WorkflowExecutionsController {
  constructor(private readonly service: WorkflowExecutionService) {}

  private getOrgId(req: OrgRequest): string {
    const orgId =
      req.user.organizationId ||
      req.organizationId ||
      ((req.headers && req.headers['x-organization-id']) as string);
    if (orgId) return orgId;
    throw new Error('Organization context not found in request');
  }

  @Get()
  @RequirePermissions('workflows.view')
  listExecutions(@Req() req: OrgRequest, @Query() query: QueryExecutionsDto) {
    return this.service.listExecutions(this.getOrgId(req), query);
  }

  @Get(':id')
  @RequirePermissions('workflows.view')
  getExecution(@Req() req: OrgRequest, @Param('id') id: string) {
    return this.service.getExecution(this.getOrgId(req), id);
  }

  @Post(':id/cancel')
  @RequirePermissions('workflows.execute')
  cancelExecution(@Req() req: OrgRequest, @Param('id') id: string) {
    return this.service.cancelExecution(this.getOrgId(req), id, req.user.id);
  }

  @Post(':id/retry')
  @RequirePermissions('workflows.execute')
  retryExecution(
    @Req() req: OrgRequest,
    @Param('id') id: string,
    @Body() dto: RetryExecutionDto,
  ) {
    return this.service.retryExecution(
      this.getOrgId(req),
      id,
      dto,
      req.user.id,
    );
  }

  @Post(':workflowDefinitionId/start')
  @RequirePermissions('workflows.execute')
  startExecution(
    @Req() req: OrgRequest,
    @Param('workflowDefinitionId') workflowDefinitionId: string,
    @Body() dto: ExecuteWorkflowDto,
  ) {
    return this.service.startExecution(
      this.getOrgId(req),
      workflowDefinitionId,
      dto,
      req.user.id,
    );
  }
}
