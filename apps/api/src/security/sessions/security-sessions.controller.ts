import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SecuritySessionsService } from './security-sessions.service';
import {
  RevokeSessionDto,
  RevokeUserSessionsDto,
  SessionQueryDto,
} from '../dto/security-sessions.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/security/sessions')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class SecuritySessionsController {
  constructor(private readonly sessionsService: SecuritySessionsService) {}

  @Get()
  @RequirePermissions('security.sessions.view')
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SessionQueryDto,
  ) {
    return this.sessionsService.listSessions(tenant.organizationId, query);
  }

  @Post(':id/revoke')
  @RequirePermissions('security.sessions.revoke')
  async revoke(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: RevokeSessionDto,
  ) {
    return this.sessionsService.revokeSession(
      tenant.organizationId,
      id,
      dto.reason,
      tenant.userId,
    );
  }

  @Post('revoke-user-all')
  @RequirePermissions('security.sessions.revoke')
  async revokeUserAll(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: RevokeUserSessionsDto,
  ) {
    return this.sessionsService.revokeAllUserSessions(
      tenant.organizationId,
      dto.userId,
      dto.reason,
      tenant.userId,
    );
  }
}
