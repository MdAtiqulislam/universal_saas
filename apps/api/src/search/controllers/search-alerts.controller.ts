import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { SearchAlertsService } from '../services/search-alerts.service';
import {
  CreateSearchAlertDto,
  UpdateSearchAlertDto,
} from '../dto/search-alert.dto';

@Controller('search/alerts')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SearchAlertsController {
  constructor(private readonly alertsService: SearchAlertsService) {}

  @Post()
  @RequirePermissions('search.alerts.manage')
  async createAlert(
    @Body() dto: CreateSearchAlertDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException('Tenant and user context required');
    }

    const alert = await this.alertsService.createAlert(
      tenant.organizationId,
      req.user.id,
      dto,
      req.user.id,
    );

    return {
      success: true,
      data: alert,
      message: 'Search alert configured successfully',
    };
  }

  @Get()
  @RequirePermissions('search.alerts.read')
  async listAlerts(
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }

    const alerts = await this.alertsService.listAlerts(
      tenant.organizationId,
      req?.user?.id,
    );

    return {
      success: true,
      data: alerts,
    };
  }

  @Get(':id')
  @RequirePermissions('search.alerts.read')
  async getAlert(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }

    const alert = await this.alertsService.getAlert(id, tenant.organizationId);

    return {
      success: true,
      data: alert,
    };
  }

  @Patch(':id')
  @RequirePermissions('search.alerts.manage')
  async updateAlert(
    @Param('id') id: string,
    @Body() dto: UpdateSearchAlertDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }

    const alert = await this.alertsService.updateAlert(
      id,
      tenant.organizationId,
      dto,
      req?.user?.id,
    );

    return {
      success: true,
      data: alert,
      message: 'Search alert updated',
    };
  }

  @Delete(':id')
  @RequirePermissions('search.alerts.manage')
  async deleteAlert(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }

    await this.alertsService.deleteAlert(
      id,
      tenant.organizationId,
      req?.user?.id,
    );

    return {
      success: true,
      message: 'Search alert deleted',
    };
  }

  @Post(':id/evaluate')
  @RequirePermissions('search.alerts.manage')
  async triggerEvaluation(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }

    const result = await this.alertsService.evaluateAlert(id);

    return {
      success: true,
      data: result,
      message: 'Search alert evaluation completed',
    };
  }
}
