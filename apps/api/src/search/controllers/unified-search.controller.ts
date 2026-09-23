import {
  Controller,
  Get,
  Post,
  Body,
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
import { UnifiedSearchService } from '../services/unified-search.service';
import { SearchQueryDto, SearchSuggestionsDto } from '../dto/search-query.dto';

@Controller('search')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UnifiedSearchController {
  constructor(private readonly searchService: UnifiedSearchService) {}

  @Post()
  @RequirePermissions('search.execute')
  async executeSearch(
    @Body() queryDto: SearchQueryDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-478)');
    }

    const userObj = req?.user as unknown as
      { permissions?: string[] } | undefined;
    const permissions: string[] = Array.isArray(userObj?.permissions)
      ? userObj.permissions
      : [];
    const result = await this.searchService.search({
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      userPermissions: permissions,
      queryDto,
    });

    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get()
  @RequirePermissions('search.read')
  async searchGet(
    @Query() queryDto: SearchQueryDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-478)');
    }

    const userObj = req?.user as unknown as
      { permissions?: string[] } | undefined;
    const permissions: string[] = Array.isArray(userObj?.permissions)
      ? userObj.permissions
      : [];
    const result = await this.searchService.search({
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      userPermissions: permissions,
      queryDto,
    });

    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('suggestions')
  @RequirePermissions('search.read')
  async getSuggestions(
    @Query() dto: SearchSuggestionsDto,
    @CurrentTenant() tenant?: TenantContext,
    @Req() req?: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required (INV-478)');
    }

    const userObj = req?.user as unknown as
      { permissions?: string[] } | undefined;
    const permissions: string[] = Array.isArray(userObj?.permissions)
      ? userObj.permissions
      : [];
    const data = await this.searchService.getSuggestions({
      organizationId: tenant.organizationId,
      userId: req?.user?.id,
      userPermissions: permissions,
      dto,
    });

    return {
      success: true,
      data,
    };
  }
}
