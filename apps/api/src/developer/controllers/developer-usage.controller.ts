import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { ApiUsageService } from '../services/api-usage.service';
import { DeveloperExportService } from '../services/developer-export.service';
import { UsageQueryDto } from '../dto/usage-query.dto';
import { UsageExportDto } from '../dto/usage-export.dto';

@Controller('developer/usage')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DeveloperUsageController {
  constructor(
    private readonly usageService: ApiUsageService,
    private readonly exportService: DeveloperExportService,
  ) {}

  @Get()
  @RequirePermissions('developer.api.usage.view')
  async getUsage(
    @CurrentTenant() tenant: TenantContext | undefined,
    @Query() query: UsageQueryDto,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }

    const data = await this.usageService.getUsageRecords(
      tenant.organizationId,
      query,
    );
    return {
      success: true,
      data: data.records,
      meta: {
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages,
      },
    };
  }

  @Get('summary')
  @RequirePermissions('developer.api.usage.view')
  async getUsageSummary(
    @CurrentTenant() tenant: TenantContext | undefined,
    @Query('days') days?: string,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }

    const numDays = days ? parseInt(days, 10) : 30;
    const data = await this.usageService.getSummary(
      tenant.organizationId,
      numDays,
    );
    return {
      success: true,
      data,
    };
  }

  @Post('export')
  @RequirePermissions('developer.usage.export')
  async exportUsage(
    @CurrentTenant() tenant: TenantContext | undefined,
    @Body() dto: UsageExportDto,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }

    const result = await this.exportService.exportUsageCsv(
      tenant.organizationId,
      tenant.userId || 'developer-user',
      dto,
    );

    return {
      success: true,
      data: result,
      message: `Exported ${result.recordCount} usage records successfully`,
    };
  }
}
