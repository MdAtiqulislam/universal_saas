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
} from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetCategoryDto } from './dto/create-asset-category.dto';
import { UpdateAssetCategoryDto } from './dto/update-asset-category.dto';
import { CreateFixedAssetDto } from './dto/create-fixed-asset.dto';
import { UpdateFixedAssetDto } from './dto/update-fixed-asset.dto';
import { TransferFixedAssetDto } from './dto/transfer-fixed-asset.dto';
import { DisposeFixedAssetDto } from './dto/dispose-fixed-asset.dto';
import { DepreciationRunDto } from './dto/depreciation-run.dto';
import { AssetReportQueryDto } from './dto/asset-report-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../organizations/interfaces/tenant-context.interface';

@Controller('assets')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  // --------------------------------------------------------------------------
  // CATEGORIES
  // --------------------------------------------------------------------------

  @Get('categories')
  @RequirePermissions('assets.categories.view')
  async findCategories(
    @CurrentTenant() tenant: TenantContext,
    @Query('isActive') isActive?: string,
  ) {
    const activeFilter =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.assetsService.findAllCategories(
      tenant.organizationId,
      activeFilter,
    );
  }

  @Post('categories')
  @RequirePermissions('assets.categories.manage')
  async createCategory(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateAssetCategoryDto,
  ) {
    return this.assetsService.createCategory(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get('categories/:id')
  @RequirePermissions('assets.categories.view')
  async findCategory(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.assetsService.findCategory(tenant.organizationId, id);
  }

  @Patch('categories/:id')
  @RequirePermissions('assets.categories.manage')
  async updateCategory(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateAssetCategoryDto,
  ) {
    return this.assetsService.updateCategory(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Delete('categories/:id')
  @RequirePermissions('assets.categories.manage')
  async deleteCategory(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.assetsService.deleteCategory(tenant.organizationId, id);
  }

  // --------------------------------------------------------------------------
  // DEPRECIATION RUNS & POSTING
  // --------------------------------------------------------------------------

  @Post('depreciation-runs')
  @RequirePermissions('assets.depreciation.manage')
  async runDepreciation(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: DepreciationRunDto,
  ) {
    return this.assetsService.runDepreciation(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Post('depreciation/:entryId/post')
  @RequirePermissions('assets.depreciation.manage')
  async postDepreciationEntry(
    @CurrentTenant() tenant: TenantContext,
    @Param('entryId') entryId: string,
  ) {
    return this.assetsService.postDepreciationEntry(
      tenant.organizationId,
      entryId,
      tenant.userId,
    );
  }

  // --------------------------------------------------------------------------
  // REPORTS
  // --------------------------------------------------------------------------

  @Get('reports/register')
  @RequirePermissions('assets.reports.view')
  async getRegisterReport(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AssetReportQueryDto,
  ) {
    return this.assetsService.getRegisterReport(tenant.organizationId, query);
  }

  @Get('reports/depreciation')
  @RequirePermissions('assets.reports.view')
  async getDepreciationReport(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AssetReportQueryDto,
  ) {
    return this.assetsService.getDepreciationReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('reports/movements')
  @RequirePermissions('assets.reports.view')
  async getMovementsReport(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AssetReportQueryDto,
  ) {
    return this.assetsService.getMovementsReport(tenant.organizationId, query);
  }

  @Get('reports/reconciliation')
  @RequirePermissions('assets.reports.view')
  async getReconciliationReport(@CurrentTenant() tenant: TenantContext) {
    return this.assetsService.getReconciliationReport(tenant.organizationId);
  }

  // --------------------------------------------------------------------------
  // FIXED ASSETS
  // --------------------------------------------------------------------------

  @Get()
  @RequirePermissions('assets.view')
  async findAllAssets(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AssetReportQueryDto,
  ) {
    return this.assetsService.findAllAssets(tenant.organizationId, query);
  }

  @Post()
  @RequirePermissions('assets.manage')
  async createAsset(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateFixedAssetDto,
  ) {
    return this.assetsService.createAsset(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get(':id')
  @RequirePermissions('assets.view')
  async findAsset(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.assetsService.findAsset(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('assets.manage')
  async updateAsset(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateFixedAssetDto,
  ) {
    return this.assetsService.updateAsset(tenant.organizationId, id, dto);
  }

  @Post(':id/capitalize')
  @RequirePermissions('assets.capitalize')
  async capitalizeAsset(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.assetsService.capitalizeAsset(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/activate')
  @RequirePermissions('assets.manage')
  async activateAsset(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body('placedInServiceDate') placedInServiceDate?: string,
  ) {
    return this.assetsService.activateAsset(
      tenant.organizationId,
      id,
      placedInServiceDate,
      tenant.userId,
    );
  }

  @Post(':id/transfer')
  @RequirePermissions('assets.transfer')
  async transferAsset(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: TransferFixedAssetDto,
  ) {
    return this.assetsService.transferAsset(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/dispose')
  @RequirePermissions('assets.dispose')
  async disposeAsset(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: DisposeFixedAssetDto,
  ) {
    return this.assetsService.disposeAsset(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/void')
  @RequirePermissions('assets.void')
  async voidAsset(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.assetsService.voidAsset(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Get(':id/depreciation-schedule')
  @RequirePermissions('assets.depreciation.view')
  async getDepreciationSchedule(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.assetsService.getDepreciationSchedule(
      tenant.organizationId,
      id,
    );
  }
}
