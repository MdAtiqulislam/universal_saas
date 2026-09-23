import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SecurityEventsService } from './security-events.service';
import { SecurityEventQueryDto } from '../dto/security-events.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/security/events')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class SecurityEventsController {
  constructor(private readonly eventsService: SecurityEventsService) {}

  @Get()
  @RequirePermissions('security.events.view')
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SecurityEventQueryDto,
  ) {
    return this.eventsService.listEvents(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('security.events.view')
  async get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.eventsService.getEvent(tenant.organizationId, id);
  }
}
