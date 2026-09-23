import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('catalog/categories')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @RequirePermissions('catalog.categories.view')
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    const filter = {
      isActive:
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search,
    };
    const data = await this.categoriesService.findAll(
      tenant.organizationId,
      filter,
    );
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('catalog.categories.view')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.categoriesService.findOne(
      tenant.organizationId,
      id,
    );
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('catalog.categories.manage')
  async create(
    @Body() dto: CreateCategoryDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.categoriesService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('catalog.categories.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.categoriesService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('catalog.categories.manage')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const result = await this.categoriesService.softDelete(
      tenant.organizationId,
      id,
      tenant.userId,
    );
    return { success: true, message: result.message };
  }
}
