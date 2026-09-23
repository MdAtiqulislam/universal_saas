import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { WorkflowDefinitionsService } from './workflow-definitions.service';
import { WorkflowExecutionService } from '../executions/workflow-execution.service';
import {
  CreateWorkflowDefinitionDto,
  UpdateWorkflowDefinitionDto,
  QueryWorkflowDefinitionDto,
} from './dto/create-workflow-definition.dto';

interface OrgRequest extends AuthenticatedRequest {
  organizationId?: string;
  user: {
    id: string;
    sessionId: string;
    organizationId?: string;
  };
}

@Controller('workflows')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WorkflowDefinitionsController {
  constructor(
    private readonly service: WorkflowDefinitionsService,
    private readonly executionService: WorkflowExecutionService,
  ) {}

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
  listDefinitions(
    @Req() req: OrgRequest,
    @Query() query: QueryWorkflowDefinitionDto,
  ) {
    return this.service.listDefinitions(this.getOrgId(req), query);
  }

  @Post()
  @RequirePermissions('workflows.create')
  createDefinition(
    @Req() req: OrgRequest,
    @Body() dto: CreateWorkflowDefinitionDto,
  ) {
    return this.service.createDefinition(this.getOrgId(req), dto, req.user.id);
  }

  @Get(':id')
  @RequirePermissions('workflows.view')
  getDefinition(@Req() req: OrgRequest, @Param('id') id: string) {
    return this.service.getDefinition(this.getOrgId(req), id);
  }

  @Patch(':id')
  @RequirePermissions('workflows.update')
  updateDefinition(
    @Req() req: OrgRequest,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDefinitionDto,
  ) {
    return this.service.updateDefinition(
      this.getOrgId(req),
      id,
      dto,
      req.user.id,
    );
  }

  @Delete(':id')
  @RequirePermissions('workflows.manage')
  deleteDefinition(@Req() req: OrgRequest, @Param('id') id: string) {
    return this.service.deleteDefinition(this.getOrgId(req), id, req.user.id);
  }

  @Post(':id/execute')
  @RequirePermissions('workflows.execute')
  executeDefinition(
    @Req() req: OrgRequest,
    @Param('id') id: string,
    @Body()
    dto: {
      inputContext?: Record<string, unknown>;
      clientIdempotencyKey?: string;
    },
  ) {
    return this.executionService.startExecution(
      this.getOrgId(req),
      id,
      dto,
      req.user.id,
    );
  }
}
