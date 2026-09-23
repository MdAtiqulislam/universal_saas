import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
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
import { DataOperationRegistryService } from '../registry/data-operation.registry';
import { DataExportService } from '../services/data-export.service';
import { DataImportService } from '../services/data-import.service';
import { DataOperationJobsService } from '../services/data-operation-jobs.service';
import { ExportRequestDto } from '../dto/export-request.dto';
import { ImportPreviewRequestDto } from '../dto/import-preview-request.dto';
import { ImportCommitRequestDto } from '../dto/import-commit-request.dto';
import { JobQueryDto } from '../dto/job-query.dto';
import { CreateTemplateDto } from '../dto/create-template.dto';

@Controller('data-operations')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DataOperationsController {
  constructor(
    private readonly registry: DataOperationRegistryService,
    private readonly exportService: DataExportService,
    private readonly importService: DataImportService,
    private readonly jobsService: DataOperationJobsService,
  ) {}

  @Get('definitions')
  @RequirePermissions('data_operations.operations.view')
  listDefinitions() {
    return this.registry.list();
  }

  @Get('definitions/:key')
  @RequirePermissions('data_operations.operations.view')
  getDefinition(@Param('key') key: string) {
    return this.registry.get(key);
  }

  @Post('exports')
  @RequirePermissions('data_operations.export.execute')
  async exportData(
    @Body() dto: ExportRequestDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }

    const userObj = req?.user as unknown as
      { permissions?: string[] } | undefined;
    const permissions: string[] = Array.isArray(userObj?.permissions)
      ? userObj.permissions
      : [];

    return this.exportService.export({
      organizationId: tenant.organizationId,
      operationKey: dto.operationKey,
      fields: dto.fields,
      filters: dto.filters,
      format: dto.format,
      limit: dto.limit,
      actorUserId: req?.user?.id,
      userPermissions: permissions,
      idempotencyKey: dto.idempotencyKey,
      async: dto.async,
    });
  }

  @Post('imports/preview')
  @RequirePermissions('data_operations.import.preview')
  async previewImport(
    @Body() dto: ImportPreviewRequestDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }

    const userObj = req?.user as unknown as
      { permissions?: string[] } | undefined;
    const permissions: string[] = Array.isArray(userObj?.permissions)
      ? userObj.permissions
      : [];

    return this.importService.preview({
      organizationId: tenant.organizationId,
      operationKey: dto.operationKey,
      fileContent: dto.fileContent,
      format: dto.format,
      mode: dto.mode,
      duplicateStrategy: dto.duplicateStrategy,
      actorUserId: req?.user?.id,
      userPermissions: permissions,
      dryRun: dto.dryRun ?? true,
    });
  }

  @Post('imports')
  @RequirePermissions('data_operations.import.execute')
  async commitImport(
    @Body() dto: ImportCommitRequestDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }

    const userObj = req?.user as unknown as
      { permissions?: string[] } | undefined;
    const permissions: string[] = Array.isArray(userObj?.permissions)
      ? userObj.permissions
      : [];

    return this.importService.commit({
      organizationId: tenant.organizationId,
      operationKey: dto.operationKey,
      fileContent: dto.fileContent,
      jobId: dto.jobId,
      format: dto.format,
      mode: dto.mode,
      duplicateStrategy: dto.duplicateStrategy,
      actorUserId: req?.user?.id,
      userPermissions: permissions,
      idempotencyKey: dto.idempotencyKey,
      batchSize: dto.batchSize,
    });
  }

  @Get('jobs')
  @RequirePermissions('data_operations.jobs.view')
  async listJobs(
    @Query() query: JobQueryDto,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.jobsService.listJobs(tenant.organizationId, query);
  }

  @Get('jobs/:id')
  @RequirePermissions('data_operations.jobs.view')
  async getJob(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.jobsService.getJob(tenant.organizationId, id);
  }

  @Post('jobs/:id/cancel')
  @RequirePermissions('data_operations.jobs.cancel')
  async cancelJob(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.jobsService.cancelJob(tenant.organizationId, id, req?.user?.id);
  }

  @Get('jobs/:id/result')
  @RequirePermissions('data_operations.export.execute')
  async getJobResult(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
    @Res() res?: Response,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const result = await this.jobsService.getJobResult(
      tenant.organizationId,
      id,
    );

    if (res) {
      const mime = result.format === 'JSON' ? 'application/json' : 'text/csv';
      res.setHeader('Content-Type', mime);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.fileName}"`,
      );
      return res.send(result.fileContent);
    }
    return result;
  }

  @Get('jobs/:id/errors')
  @RequirePermissions('data_operations.audit.view')
  async getJobErrors(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
    @Res() res?: Response,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const result = await this.jobsService.getJobErrors(
      tenant.organizationId,
      id,
    );

    if (res) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="errors_${id.slice(0, 8)}.csv"`,
      );
      return res.send(result.csvContent);
    }
    return result;
  }

  @Get('templates')
  @RequirePermissions('data_operations.templates.manage')
  async listTemplates(
    @Query('operationKey') operationKey?: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.jobsService.listTemplates(tenant.organizationId, operationKey);
  }

  @Post('templates')
  @RequirePermissions('data_operations.templates.manage')
  async createTemplate(
    @Body() dto: CreateTemplateDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.jobsService.createTemplate(
      tenant.organizationId,
      dto,
      req?.user?.id,
    );
  }
}
