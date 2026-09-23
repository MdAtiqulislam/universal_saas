import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { InventoryModule } from '../inventory/inventory.module';

// Controllers
import { WarehouseZonesController } from './zones/warehouse-zones.controller';
import { WarehouseStockController } from './stock/warehouse-stock.controller';
import { WarehouseTasksController } from './tasks/warehouse-tasks.controller';
import { WarehousePutawayController } from './putaway/warehouse-putaway.controller';
import { WarehousePickingController } from './picking/warehouse-picking.controller';
import { WarehouseWavesController } from './picking/warehouse-waves.controller';
import { WarehouseTransfersController } from './transfers/warehouse-transfers.controller';
import { WarehouseCountsController } from './counts/warehouse-counts.controller';
import { WarehouseReplenishmentController } from './replenishment/warehouse-replenishment.controller';
import { WarehouseConfigController } from './config/warehouse-config.controller';
import { WarehouseReportsController } from './reports/warehouse-reports.controller';

// Services
import { WarehouseZonesService } from './zones/warehouse-zones.service';
import { WarehouseStockService } from './stock/warehouse-stock.service';
import { WarehouseQuarantineService } from './stock/warehouse-quarantine.service';
import { WarehouseTasksService } from './tasks/warehouse-tasks.service';
import { WarehousePutawayService } from './putaway/warehouse-putaway.service';
import { WarehousePickingService } from './picking/warehouse-picking.service';
import { WarehouseWavesService } from './picking/warehouse-waves.service';
import { WarehouseTransfersService } from './transfers/warehouse-transfers.service';
import { WarehouseCountsService } from './counts/warehouse-counts.service';
import { WarehouseReplenishmentService } from './replenishment/warehouse-replenishment.service';
import { WarehouseConfigService } from './config/warehouse-config.service';
import { WarehouseReportsService } from './reports/warehouse-reports.service';

@Module({
  imports: [PrismaModule, EventsModule, MasterDataModule, InventoryModule],
  controllers: [
    WarehouseZonesController,
    WarehouseStockController,
    WarehouseTasksController,
    WarehousePutawayController,
    WarehousePickingController,
    WarehouseWavesController,
    WarehouseTransfersController,
    WarehouseCountsController,
    WarehouseReplenishmentController,
    WarehouseConfigController,
    WarehouseReportsController,
  ],
  providers: [
    WarehouseZonesService,
    WarehouseStockService,
    WarehouseQuarantineService,
    WarehouseTasksService,
    WarehousePutawayService,
    WarehousePickingService,
    WarehouseWavesService,
    WarehouseTransfersService,
    WarehouseCountsService,
    WarehouseReplenishmentService,
    WarehouseConfigService,
    WarehouseReportsService,
  ],
  exports: [
    WarehouseZonesService,
    WarehouseStockService,
    WarehouseQuarantineService,
    WarehouseTasksService,
    WarehousePutawayService,
    WarehousePickingService,
    WarehouseWavesService,
    WarehouseTransfersService,
    WarehouseCountsService,
    WarehouseReplenishmentService,
    WarehouseConfigService,
    WarehouseReportsService,
  ],
})
export class WarehouseModule {}
