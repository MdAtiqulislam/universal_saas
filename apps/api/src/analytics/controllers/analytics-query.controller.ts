import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { AnalyticsDefinitionRegistry } from '../registry/analytics-definition.registry';
import { AnalyticsQueryEngineService } from '../services/analytics-query-engine.service';
import { ReportExportService } from '../services/report-export.service';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import { ExportQueryDto } from '../dto/export-query.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AnalyticsQueryController {
  constructor(
    private readonly queryEngine: AnalyticsQueryEngineService,
    private readonly exportService: ReportExportService,
  ) {}

  @Get('definitions')
  @RequirePermissions('analytics.definitions.view')
  listDefinitions() {
    return AnalyticsDefinitionRegistry.getAll();
  }

  @Get('definitions/:key')
  @RequirePermissions('analytics.definitions.view')
  getDefinition(@Param('key') key: string) {
    const def = AnalyticsDefinitionRegistry.get(key);
    if (!def) {
      throw new ForbiddenException(`Dataset definition "${key}" not found`);
    }
    return def;
  }

  @Post('query')
  @RequirePermissions('analytics.query.execute')
  async executeQuery(
    @Body() queryDto: AnalyticsQueryDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-501)');
    }

    const userObj = req?.user as unknown as
      { permissions?: string[] } | undefined;
    const permissions: string[] = Array.isArray(userObj?.permissions)
      ? userObj.permissions
      : [];

    return this.queryEngine.execute({
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      userPermissions: permissions,
      query: queryDto,
    });
  }

  @Post('export')
  @RequirePermissions('analytics.reports.export')
  async exportQuery(
    @Body() exportDto: ExportQueryDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
    @Res() res?: Response,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-511)');
    }

    const userObj = req?.user as unknown as
      { permissions?: string[] } | undefined;
    const permissions: string[] = Array.isArray(userObj?.permissions)
      ? userObj.permissions
      : [];

    const result = await this.exportService.exportData({
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      userPermissions: permissions,
      exportDto,
    });

    if (res) {
      res.setHeader('Content-Type', result.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.filename}"`,
      );
      return res.status(200).send(result.data);
    }

    return result;
  }
}
