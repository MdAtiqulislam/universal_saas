import { Injectable } from '@nestjs/common';
import { AssetCategoriesService } from './asset-categories.service';
import { FixedAssetsService } from './fixed-assets.service';
import { AssetDepreciationService } from './asset-depreciation.service';
import { AssetDisposalService } from './asset-disposal.service';
import { AssetReportsService } from './asset-reports.service';
import { CreateAssetCategoryDto } from './dto/create-asset-category.dto';
import { UpdateAssetCategoryDto } from './dto/update-asset-category.dto';
import { CreateFixedAssetDto } from './dto/create-fixed-asset.dto';
import { UpdateFixedAssetDto } from './dto/update-fixed-asset.dto';
import { TransferFixedAssetDto } from './dto/transfer-fixed-asset.dto';
import { DisposeFixedAssetDto } from './dto/dispose-fixed-asset.dto';
import { DepreciationRunDto } from './dto/depreciation-run.dto';
import { AssetReportQueryDto } from './dto/asset-report-query.dto';

@Injectable()
export class AssetsService {
  constructor(
    private readonly categories: AssetCategoriesService,
    private readonly assets: FixedAssetsService,
    private readonly depreciation: AssetDepreciationService,
    private readonly disposal: AssetDisposalService,
    private readonly reports: AssetReportsService,
  ) {}

  // Categories
  async createCategory(
    orgId: string,
    dto: CreateAssetCategoryDto,
    userId?: string,
  ) {
    return this.categories.create(orgId, dto, userId);
  }
  async findAllCategories(orgId: string, isActive?: boolean) {
    return this.categories.findAll(orgId, isActive);
  }
  async findCategory(orgId: string, id: string) {
    return this.categories.findOne(orgId, id);
  }
  async updateCategory(
    orgId: string,
    id: string,
    dto: UpdateAssetCategoryDto,
    userId?: string,
  ) {
    return this.categories.update(orgId, id, dto, userId);
  }
  async deleteCategory(orgId: string, id: string) {
    return this.categories.delete(orgId, id);
  }

  // Fixed Assets
  async createAsset(orgId: string, dto: CreateFixedAssetDto, userId: string) {
    return this.assets.create(orgId, dto, userId);
  }
  async findAllAssets(orgId: string, query: AssetReportQueryDto) {
    return this.assets.findAll(orgId, query);
  }
  async findAsset(orgId: string, id: string) {
    return this.assets.findOne(orgId, id);
  }
  async updateAsset(orgId: string, id: string, dto: UpdateFixedAssetDto) {
    return this.assets.update(orgId, id, dto);
  }
  async capitalizeAsset(orgId: string, id: string, userId: string) {
    return this.assets.capitalize(orgId, id, userId);
  }
  async activateAsset(
    orgId: string,
    id: string,
    inServiceDate: string | undefined,
    userId: string,
  ) {
    return this.assets.activate(orgId, id, inServiceDate, userId);
  }
  async transferAsset(
    orgId: string,
    id: string,
    dto: TransferFixedAssetDto,
    userId: string,
  ) {
    return this.assets.transfer(orgId, id, dto, userId);
  }
  async voidAsset(orgId: string, id: string, userId: string) {
    return this.assets.void(orgId, id, userId);
  }

  // Depreciation
  async getDepreciationSchedule(orgId: string, assetId: string) {
    return this.depreciation.getSchedule(orgId, assetId);
  }
  async postDepreciationEntry(orgId: string, entryId: string, userId: string) {
    return this.depreciation.postEntry(orgId, entryId, userId);
  }
  async runDepreciation(
    orgId: string,
    dto: DepreciationRunDto,
    userId: string,
  ) {
    return this.depreciation.runDepreciation(orgId, dto, userId);
  }

  // Disposal
  async disposeAsset(
    orgId: string,
    id: string,
    dto: DisposeFixedAssetDto,
    userId: string,
  ) {
    return this.disposal.dispose(orgId, id, dto, userId);
  }

  // Reports
  async getRegisterReport(orgId: string, query: AssetReportQueryDto) {
    return this.reports.getRegister(orgId, query);
  }
  async getDepreciationReport(orgId: string, query: AssetReportQueryDto) {
    return this.reports.getDepreciationReport(orgId, query);
  }
  async getMovementsReport(orgId: string, query: AssetReportQueryDto) {
    return this.reports.getMovementsReport(orgId, query);
  }
  async getReconciliationReport(orgId: string) {
    return this.reports.getReconciliation(orgId);
  }
}
