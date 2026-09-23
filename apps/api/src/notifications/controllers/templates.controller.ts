import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { TemplateManagementService } from '../services/template-management.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  CreateTemplateVersionDto,
} from '../dto/template.dto';

@Controller('notifications/templates')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TemplatesController {
  constructor(private readonly templateService: TemplateManagementService) {}

  @Get()
  @RequirePermissions('notifications.templates.read')
  async listTemplates(@CurrentTenant() tenant?: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const templates = await this.templateService.listTemplates(
      tenant.organizationId,
    );
    return {
      success: true,
      data: templates,
    };
  }

  @Post()
  @RequirePermissions('notifications.templates.manage')
  async createTemplate(
    @Body() dto: CreateTemplateDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const template = await this.templateService.createTemplate(
      tenant.organizationId,
      dto,
      req?.user?.id,
    );
    return {
      success: true,
      data: template,
      message: 'Notification template created',
    };
  }

  @Get(':id')
  @RequirePermissions('notifications.templates.read')
  async getTemplate(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const template = await this.templateService.getTemplate(
      id,
      tenant.organizationId,
    );
    return {
      success: true,
      data: template,
    };
  }

  @Patch(':id')
  @RequirePermissions('notifications.templates.manage')
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const updated = await this.templateService.updateTemplate(
      id,
      tenant.organizationId,
      dto,
      req?.user?.id,
    );
    return {
      success: true,
      data: updated,
      message: 'Template updated successfully',
    };
  }

  @Post(':id/versions')
  @RequirePermissions('notifications.templates.manage')
  async createVersion(
    @Param('id') id: string,
    @Body() dto: CreateTemplateVersionDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const version = await this.templateService.createVersion(
      id,
      tenant.organizationId,
      dto,
      req?.user?.id,
    );
    return {
      success: true,
      data: version,
      message: 'Template version created',
    };
  }

  @Post('versions/:versionId/publish')
  @RequirePermissions('notifications.templates.manage')
  async publishVersion(
    @Param('versionId') versionId: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const published = await this.templateService.publishVersion(
      versionId,
      tenant.organizationId,
      req?.user?.id,
    );
    return {
      success: true,
      data: published,
      message: 'Template version published successfully',
    };
  }
}
