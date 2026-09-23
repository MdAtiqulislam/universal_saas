import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EventsModule } from '../../events/events.module';
import { MasterDataModule } from '../../master-data/master-data.module';
import { AccountsPayableModule } from '../../ap/ap.module';
import { AccountingModule } from '../../accounting/accounting.module';
import { InventoryCostLayersService } from './inventory-cost-layers.service';
import { InventoryValuationService } from './inventory-valuation.service';
import { CogsService } from './cogs.service';
import { CostingService } from './costing.service';
import { CostingController } from './costing.controller';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    MasterDataModule,
    AccountsPayableModule,
    AccountingModule,
  ],
  controllers: [CostingController],
  providers: [
    InventoryCostLayersService,
    InventoryValuationService,
    CogsService,
    CostingService,
  ],
  exports: [
    InventoryCostLayersService,
    InventoryValuationService,
    CogsService,
    CostingService,
  ],
})
export class CostingModule {}
