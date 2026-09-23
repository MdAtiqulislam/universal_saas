import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../organizations/interfaces/tenant-context.interface';
import { AuditQueryService } from './audit-query.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class AuditController {
  constructor(private readonly auditQueryService: AuditQueryService) {}

  @Get()
  @RequirePermissions('audit.view')
  async list(
    @Query() query: AuditQueryDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const result = await this.auditQueryService.list(
      tenant.organizationId,
      query,
    );
    return {
      success: true,
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }
}
