import {
  Controller,
  Get,
  Delete,
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
import { SearchHistoryService } from '../services/search-history.service';

@Controller('search/history')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SearchHistoryController {
  constructor(private readonly historyService: SearchHistoryService) {}

  @Get()
  @RequirePermissions('search.history.read')
  async getMyHistory(
    @Query('limit') limit?: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException('Tenant and user context required');
    }

    const items = await this.historyService.getUserHistory(
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
  @RequirePermissions('search.history.manage')
  async deleteItem(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException('Tenant and user context required');
    }

    await this.historyService.deleteHistoryItem(
      id,
      tenant.organizationId,
      req.user.id,
      req.user.id,
    );

    return {
      success: true,
      message: 'History item deleted',
    };
  }

  @Delete()
  @RequirePermissions('search.history.manage')
  async clearHistory(
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException('Tenant and user context required');
    }

    await this.historyService.clearHistory(
      tenant.organizationId,
      req.user.id,
      req.user.id,
    );

    return {
      success: true,
      message: 'Search history cleared successfully',
    };
  }
}
