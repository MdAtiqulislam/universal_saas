import {
  Controller,
  Get,
  Post,
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
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { RecentItemsService } from '../services/recent-items.service';
import { CreateRecentItemDto } from '../dto/search-preference.dto';

@Controller('search/recent')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RecentItemsController {
  constructor(private readonly recentService: RecentItemsService) {}

  @Post()
  async recordRecent(
    @Body() dto: CreateRecentItemDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException('Tenant and user context required');
    }

    const item = await this.recentService.recordRecentItem(
      tenant.organizationId,
      req.user.id,
      dto,
    );

    return {
      success: true,
      data: item,
    };
  }

  @Get()
  async getMyRecent(
    @Query('limit') limit?: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException('Tenant and user context required');
    }

    const items = await this.recentService.getRecentItems(
      tenant.organizationId,
      req.user.id,
      req.user.id,
      limit ? parseInt(limit, 10) : 20,
    );

    return {
      success: true,
      data: items,
    };
  }

  @Delete(':id')
  async deleteRecent(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException('Tenant and user context required');
    }

    await this.recentService.deleteRecentItem(
      id,
      tenant.organizationId,
      req.user.id,
      req.user.id,
    );

    return {
      success: true,
      message: 'Recent item removed',
    };
  }

  @Delete()
  async clearRecent(
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException('Tenant and user context required');
    }

    await this.recentService.clearRecentItems(
      tenant.organizationId,
      req.user.id,
      req.user.id,
    );

    return {
      success: true,
      message: 'Recent items cleared',
    };
  }
}
