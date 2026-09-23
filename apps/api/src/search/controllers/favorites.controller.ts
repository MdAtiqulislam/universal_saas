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
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { FavoritesService } from '../services/favorites.service';
import { CreateFavoriteItemDto } from '../dto/search-preference.dto';
import { SearchScope } from '@prisma/client';

@Controller('search/favorites')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @RequirePermissions('search.favorites.manage')
  async addFavorite(
    @Body() dto: CreateFavoriteItemDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException('Tenant and user context required');
    }

    const item = await this.favoritesService.addFavorite(
      tenant.organizationId,
      req.user.id,
      dto,
    );

    return {
      success: true,
      data: item,
      message: 'Item added to favorites',
    };
  }

  @Get()
  @RequirePermissions('search.favorites.read')
  async getFavorites(
    @Query('resourceType') resourceType?: string,
    @Query('scope') scope?: SearchScope,
    @Query('limit') limit?: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException('Tenant and user context required');
    }

    const items = await this.favoritesService.getFavorites({
      organizationId: tenant.organizationId,
      userId: req.user.id,
      requestingUserId: req.user.id,
      resourceType,
      scope,
      limit: limit ? parseInt(limit, 10) : 50,
    });

    return {
      success: true,
      data: items,
    };
  }

  @Delete(':id')
  @RequirePermissions('search.favorites.manage')
  async removeFavorite(
    @Param('id') id: string,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId || !req?.user?.id) {
      throw new ForbiddenException('Tenant and user context required');
    }

    await this.favoritesService.removeFavoriteById(
      id,
      tenant.organizationId,
      req.user.id,
      req.user.id,
    );

    return {
      success: true,
      message: 'Favorite removed',
    };
  }
}
