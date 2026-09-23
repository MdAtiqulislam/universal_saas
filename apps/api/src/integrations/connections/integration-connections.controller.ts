import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { IntegrationConnectionsService } from './integration-connections.service';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';

interface OrgRequest extends AuthenticatedRequest {
  organizationId?: string;
  user: {
    id: string;
    sessionId: string;
    organizationId?: string;
  };
}

@Controller('integrations/connections')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class IntegrationConnectionsController {
  constructor(private readonly service: IntegrationConnectionsService) {}

  private getOrgId(req: OrgRequest): string {
    const orgId =
      req.user.organizationId ||
      req.organizationId ||
      (req.headers && (req.headers['x-organization-id'] as string));
    if (orgId) return orgId;
    throw new Error('Organization context not found in request');
  }

  @Get()
  @RequirePermissions('integrations.connections.view')
  listConnections(@Req() req: OrgRequest) {
    return this.service.listConnections(this.getOrgId(req));
  }

  @Get(':id')
  @RequirePermissions('integrations.connections.view')
  getConnection(@Req() req: OrgRequest, @Param('id') id: string) {
    return this.service.getConnection(this.getOrgId(req), id);
  }

  @Post()
  @RequirePermissions('integrations.connections.manage')
  createConnection(@Req() req: OrgRequest, @Body() dto: CreateConnectionDto) {
    return this.service.createConnection(this.getOrgId(req), dto, req.user.id);
  }

  @Put(':id')
  @RequirePermissions('integrations.connections.manage')
  updateConnection(
    @Req() req: OrgRequest,
    @Param('id') id: string,
    @Body() dto: UpdateConnectionDto,
  ) {
    return this.service.updateConnection(
      this.getOrgId(req),
      id,
      dto,
      req.user.id,
    );
  }

  @Delete(':id')
  @RequirePermissions('integrations.connections.manage')
  deleteConnection(@Req() req: OrgRequest, @Param('id') id: string) {
    return this.service.deleteConnection(this.getOrgId(req), id, req.user.id);
  }
}
