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
import { PricingService } from './pricing.service';
import { CreatePricingTierDto } from './dto/create-pricing-tier.dto';
import { UpdatePricingTierDto } from './dto/update-pricing-tier.dto';
import { CreateItemPriceDto } from './dto/create-item-price.dto';
import { UpdateItemPriceDto } from './dto/update-item-price.dto';

@Controller('catalog')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  // ----------------------------------------------------------------------------
  // Pricing Tiers
  // ----------------------------------------------------------------------------

  @Get('pricing-tiers')
  @RequirePermissions('catalog.pricing.view')
  async listPricingTiers(
    @CurrentTenant() tenant: TenantContext,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    const filter = {
      isActive:
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search,
    };
    const data = await this.pricingService.findAllPricingTiers(
      tenant.organizationId,
      filter,
    );
    return { success: true, data };
  }

  @Get('pricing-tiers/:id')
  @RequirePermissions('catalog.pricing.view')
  async getPricingTier(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.pricingService.findOnePricingTier(
      tenant.organizationId,
      id,
    );
    return { success: true, data };
  }

  @Post('pricing-tiers')
  @RequirePermissions('catalog.pricing.manage')
  async createPricingTier(
    @Body() dto: CreatePricingTierDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.pricingService.createPricingTier(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }

  @Patch('pricing-tiers/:id')
  @RequirePermissions('catalog.pricing.manage')
  async updatePricingTier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePricingTierDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.pricingService.updatePricingTier(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }

  // ----------------------------------------------------------------------------
  // Item Prices
  // ----------------------------------------------------------------------------

  @Get('items/:itemId/prices')
  @RequirePermissions('catalog.pricing.view')
  async listPricesByItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.pricingService.findPricesByItem(
      tenant.organizationId,
      itemId,
    );
    return { success: true, data };
  }

  @Post('items/:itemId/prices')
  @RequirePermissions('catalog.pricing.manage')
  async createPriceForItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: CreateItemPriceDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.pricingService.createPrice(
      tenant.organizationId,
      { itemId },
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }

  // ----------------------------------------------------------------------------
  // Variant Prices
  // ----------------------------------------------------------------------------

  @Get('variants/:variantId/prices')
  @RequirePermissions('catalog.pricing.view')
  async listPricesByVariant(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.pricingService.findPricesByVariant(
      tenant.organizationId,
      variantId,
    );
    return { success: true, data };
  }

  @Post('variants/:variantId/prices')
  @RequirePermissions('catalog.pricing.manage')
  async createPriceForVariant(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: CreateItemPriceDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.pricingService.createPrice(
      tenant.organizationId,
      { variantId },
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }

  // ----------------------------------------------------------------------------
  // Price Mutations
  // ----------------------------------------------------------------------------

  @Patch('prices/:id')
  @RequirePermissions('catalog.pricing.manage')
  async updatePrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateItemPriceDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.pricingService.updatePrice(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }

  @Delete('prices/:id')
  @RequirePermissions('catalog.pricing.manage')
  async deletePrice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const result = await this.pricingService.deletePrice(
      tenant.organizationId,
      id,
      tenant.userId,
    );
    return { success: true, message: result.message };
  }
}
