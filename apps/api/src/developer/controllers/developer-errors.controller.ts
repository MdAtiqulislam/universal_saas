import {
  Controller,
  Get,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { ApiContractService } from '../services/api-contract.service';
import { ApiUsageService } from '../services/api-usage.service';

@Controller('developer/errors')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DeveloperErrorsController {
  constructor(
    private readonly contractService: ApiContractService,
    private readonly usageService: ApiUsageService,
  ) {}

  @Get()
  @RequirePermissions('developer.api.errors.view')
  async getErrors(
    @CurrentTenant() tenant: TenantContext | undefined,
    @Query('limit') limit?: string,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }

    const maxRecords = limit ? parseInt(limit, 10) : 20;
    const taxonomy = this.contractService.getErrorTaxonomy();
    const recentErrors = await this.usageService.getRecentErrors(
      tenant.organizationId,
      maxRecords,
    );

    return {
      success: true,
      data: {
        taxonomy,
        recentErrors: recentErrors.map((e) => ({
          id: e.id,
          method: e.method,
          route: e.route,
          statusCode: e.statusCode,
          requestId: e.requestId,
          durationMs: e.durationMs,
          keyPrefix: e.apiKey?.keyPrefix ?? null,
          createdAt: e.createdAt,
        })),
      },
    };
  }
}
