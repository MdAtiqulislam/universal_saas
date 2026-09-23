import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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
import { SavedViewsService } from '../services/saved-views.service';
import {
  CreateSavedViewDto,
  UpdateSavedViewDto,
  QuerySavedViewsDto,
} from '../dto/saved-view.dto';
import { CreateSavedViewShareDto } from '../dto/saved-view-share.dto';

@Controller('saved-views')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SavedViewsController {
  constructor(private readonly savedViewsService: SavedViewsService) {}

  @Post()
  @RequirePermissions('search.views.manage')
  async createSavedView(
    @Body() dto: CreateSavedViewDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException('Tenant and user context required');
    }

    const view = await this.savedViewsService.createSavedView(
      tenant.organizationId,
      req.user.id,
      dto,
      req.user.id,
    );

    return {
      success: true,
      data: view,
      message: 'Saved view created successfully',
    };
  }

  @Get()
  @RequirePermissions('search.views.read')
  async listSavedViews(
    @Query() query: QuerySavedViewsDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException('Tenant and user context required');
    }

    const views = await this.savedViewsService.listAccessibleSavedViews(
      tenant.organizationId,
      req.user.id,
      query,
    );

    return {
      success: true,
      data: views,
    };
  }

  @Get(':id')
  @RequirePermissions('search.views.read')
  async getSavedView(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException('Tenant and user context required');
    }

    const view = await this.savedViewsService.getSavedView(
      id,
      tenant.organizationId,
      req.user.id,
    );

    return {
      success: true,
      data: view,
    };
  }

  @Patch(':id')
  @RequirePermissions('search.views.manage')
  async updateSavedView(
    @Param('id') id: string,
    @Body() dto: UpdateSavedViewDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException('Tenant and user context required');
    }

    const view = await this.savedViewsService.updateSavedView(
      id,
      tenant.organizationId,
      req.user.id,
      dto,
      req.user.id,
    );

    return {
      success: true,
      data: view,
      message: 'Saved view updated successfully',
    };
  }

  @Delete(':id')
  @RequirePermissions('search.views.manage')
  async deleteSavedView(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException('Tenant and user context required');
    }

    await this.savedViewsService.deleteSavedView(
      id,
      tenant.organizationId,
      req.user.id,
      req.user.id,
    );

    return {
      success: true,
      message: 'Saved view deleted successfully',
    };
  }

  @Post(':id/share')
  @RequirePermissions('search.views.share')
  async shareSavedView(
    @Param('id') id: string,
    @Body() dto: CreateSavedViewShareDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException('Tenant and user context required');
    }

    const share = await this.savedViewsService.shareSavedView(
      id,
      tenant.organizationId,
      req.user.id,
      dto,
      req.user.id,
    );

    return {
      success: true,
      data: share,
      message: 'Saved view shared successfully',
    };
  }

  @Delete(':id/share/:shareId')
  @RequirePermissions('search.views.share')
  async revokeShare(
    @Param('id') id: string,
    @Param('shareId') shareId: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException('Tenant and user context required');
    }

    await this.savedViewsService.revokeShare(
      id,
      shareId,
      tenant.organizationId,
      req.user.id,
      req.user.id,
    );

    return {
      success: true,
      message: 'Share revoked successfully',
    };
  }
}
