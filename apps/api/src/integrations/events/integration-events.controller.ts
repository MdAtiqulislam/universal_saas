import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { IntegrationEventsService } from './integration-events.service';

interface OrgRequest extends AuthenticatedRequest {
  organizationId?: string;
  user: {
    id: string;
    sessionId: string;
    organizationId?: string;
  };
}

@Controller('integrations/events')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class IntegrationEventsController {
  constructor(private readonly service: IntegrationEventsService) {}

  @Get()
  @RequirePermissions('integrations.events.view')
  listEvents(@Req() req: OrgRequest) {
    const orgId =
      req.user.organizationId ||
      req.organizationId ||
      (req.headers && (req.headers['x-organization-id'] as string));
    if (!orgId) throw new Error('Organization context not found');
    return this.service.listEvents(orgId);
  }
}
