import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PurchasingModule } from '../purchasing/purchasing.module';
import { SalesModule } from '../sales/sales.module';
import { ManufacturingModule } from '../manufacturing/manufacturing.module';

import { PlanningConfigService } from './planning-config.service';
import { BomExplosionService } from './bom-explosion.service';
import { MrpEngineService } from './mrp-engine.service';
import { PlannedOrdersService } from './planned-orders.service';
import { PlanningRunsService } from './planning-runs.service';
import { PlanningReportsService } from './planning-reports.service';
import { PlanningController } from './planning.controller';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    MasterDataModule,
    AuthModule,
    OrganizationsModule,
    InventoryModule,
    PurchasingModule,
    SalesModule,
    ManufacturingModule,
  ],
  controllers: [PlanningController],
  providers: [
    PlanningConfigService,
    BomExplosionService,
    MrpEngineService,
    PlannedOrdersService,
    PlanningRunsService,
    PlanningReportsService,
  ],
  exports: [
    PlanningConfigService,
    BomExplosionService,
    MrpEngineService,
    PlannedOrdersService,
    PlanningRunsService,
    PlanningReportsService,
  ],
})
export class PlanningModule {}
