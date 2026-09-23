import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { AccountsPayableModule } from '../ap/ap.module';
import { AccountingModule } from '../accounting/accounting.module';
import { AssetCategoriesService } from './asset-categories.service';
import { FixedAssetsService } from './fixed-assets.service';
import { AssetDepreciationService } from './asset-depreciation.service';
import { AssetDisposalService } from './asset-disposal.service';
import { AssetReportsService } from './asset-reports.service';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EventsModule,
    MasterDataModule,
    AccountsPayableModule,
    AccountingModule,
  ],
  controllers: [AssetsController],
  providers: [
    AssetCategoriesService,
    FixedAssetsService,
    AssetDepreciationService,
    AssetDisposalService,
    AssetReportsService,
    AssetsService,
  ],
  exports: [
    AssetCategoriesService,
    FixedAssetsService,
    AssetDepreciationService,
    AssetDisposalService,
    AssetReportsService,
    AssetsService,
  ],
})
export class AssetsModule {}
