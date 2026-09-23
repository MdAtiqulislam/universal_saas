import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { VariantsService } from './variants.service';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';

@Controller('catalog')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class VariantsController {
  constructor(private readonly variantsService: VariantsService) {}

  @Get('items/:itemId/variants')
  @RequirePermissions('catalog.variants.view')
  async listByItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.variantsService.findAllByItem(
      tenant.organizationId,
      itemId,
    );
    return { success: true, data };
  }

  @Get('variants/:id')
  @RequirePermissions('catalog.variants.view')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.variantsService.findOne(tenant.organizationId, id);
    return { success: true, data };
  }

  @Post('items/:itemId/variants')
  @RequirePermissions('catalog.variants.manage')
  async create(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: CreateVariantDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.variantsService.create(
      tenant.organizationId,
      itemId,
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }

  @Patch('variants/:id')
  @RequirePermissions('catalog.variants.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVariantDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.variantsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }

  @Delete('variants/:id')
  @RequirePermissions('catalog.variants.manage')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const result = await this.variantsService.softDelete(
      tenant.organizationId,
      id,
      tenant.userId,
    );
    return { success: true, message: result.message };
  }
}
