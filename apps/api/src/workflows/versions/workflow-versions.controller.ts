import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { WorkflowVersionsService } from './workflow-versions.service';
import { CreateWorkflowVersionDto } from './dto/create-workflow-version.dto';

interface OrgRequest extends AuthenticatedRequest {
  organizationId?: string;
  user: {
    id: string;
    sessionId: string;
    organizationId?: string;
  };
}

@Controller('workflows/:workflowDefinitionId/versions')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WorkflowVersionsController {
  constructor(private readonly service: WorkflowVersionsService) {}

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
  listVersions(
    @Req() req: OrgRequest,
    @Param('workflowDefinitionId') workflowDefinitionId: string,
  ) {
    return this.service.listVersions(this.getOrgId(req), workflowDefinitionId);
  }

  @Post()
  @RequirePermissions('workflows.create')
  createVersion(
    @Req() req: OrgRequest,
    @Param('workflowDefinitionId') workflowDefinitionId: string,
    @Body() dto: CreateWorkflowVersionDto,
  ) {
    return this.service.createVersion(
      this.getOrgId(req),
      workflowDefinitionId,
      dto,
      req.user.id,
    );
  }

  @Get(':versionId')
  @RequirePermissions('workflows.view')
  getVersion(
    @Req() req: OrgRequest,
    @Param('workflowDefinitionId') workflowDefinitionId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.service.getVersion(
      this.getOrgId(req),
      workflowDefinitionId,
      versionId,
    );
  }

  @Post(':versionId/validate')
  @RequirePermissions('workflows.view')
  validateVersion(
    @Req() req: OrgRequest,
    @Param('workflowDefinitionId') workflowDefinitionId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.service.validateVersion(
      this.getOrgId(req),
      workflowDefinitionId,
      versionId,
    );
  }

  @Post(':versionId/publish')
  @RequirePermissions('workflows.publish')
  publishVersion(
    @Req() req: OrgRequest,
    @Param('workflowDefinitionId') workflowDefinitionId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.service.publishVersion(
      this.getOrgId(req),
      workflowDefinitionId,
      versionId,
      req.user.id,
    );
  }

  @Post(':versionId/retire')
  @RequirePermissions('workflows.retire')
  retireVersion(
    @Req() req: OrgRequest,
    @Param('workflowDefinitionId') workflowDefinitionId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.service.retireVersion(
      this.getOrgId(req),
      workflowDefinitionId,
      versionId,
      req.user.id,
    );
  }
}
