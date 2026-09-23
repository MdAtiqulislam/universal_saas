import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { IntegrationHealthService } from './integration-health.service';

interface OrgRequest extends AuthenticatedRequest {
  organizationId?: string;
  user: {
    id: string;
    sessionId: string;
    organizationId?: string;
  };
}

@Controller('integrations/health')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class IntegrationHealthController {
  constructor(private readonly service: IntegrationHealthService) {}

  private getOrgId(req: OrgRequest): string {
    const orgId =
      req.user.organizationId ||
      req.organizationId ||
      (req.headers && (req.headers['x-organization-id'] as string));
    if (orgId) return orgId;
    throw new Error('Organization context not found in request');
  }

  @Get()
  @RequirePermissions('integrations.health.view')
  getHealth(@Req() req: OrgRequest) {
    return this.service.getIntegrationHealth(this.getOrgId(req));
  }

  @Post('connections/:connectionId/check')
  @RequirePermissions('integrations.health.view')
  triggerCheck(
    @Req() req: OrgRequest,
    @Param('connectionId') connectionId: string,
  ) {
    return this.service.triggerHealthCheck(this.getOrgId(req), connectionId);
  }
}
