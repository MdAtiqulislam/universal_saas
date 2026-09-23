import {
  Body,
  Controller,
  Delete,
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
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

interface OrgRequest extends AuthenticatedRequest {
  organizationId?: string;
  user: {
    id: string;
    sessionId: string;
    organizationId?: string;
  };
}

@Controller('integrations/api-keys')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  private getOrgId(req: OrgRequest): string {
    const orgId =
      req.user.organizationId ||
      req.organizationId ||
      (req.headers && (req.headers['x-organization-id'] as string));
    if (orgId) return orgId;
    throw new Error('Organization context not found in request');
  }

  @Get()
  @RequirePermissions('integrations.apikeys.view')
  listKeys(@Req() req: OrgRequest) {
    return this.service.listKeys(this.getOrgId(req));
  }

  @Post()
  @RequirePermissions('integrations.apikeys.manage')
  createKey(@Req() req: OrgRequest, @Body() dto: CreateApiKeyDto) {
    return this.service.createKey(this.getOrgId(req), dto, req.user.id);
  }

  @Delete(':id')
  @RequirePermissions('integrations.apikeys.manage')
  revokeKey(@Req() req: OrgRequest, @Param('id') id: string) {
    return this.service.revokeKey(this.getOrgId(req), id, req.user.id);
  }
}
