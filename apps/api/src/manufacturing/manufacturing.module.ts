import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CostingModule } from '../inventory/costing/costing.module';
import { AccountingModule } from '../accounting/accounting.module';

import { BomsService } from './boms.service';
import { ProductionOrdersService } from './production-orders.service';
import { ProductionExecutionService } from './production-execution.service';
import { ManufacturingConfigService } from './manufacturing-config.service';
import { ManufacturingReportsService } from './manufacturing-reports.service';
import { ManufacturingController } from './manufacturing.controller';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    MasterDataModule,
    AuthModule,
    OrganizationsModule,
    InventoryModule,
    CostingModule,
    AccountingModule,
  ],
  controllers: [ManufacturingController],
  providers: [
    BomsService,
    ProductionOrdersService,
    ProductionExecutionService,
    ManufacturingConfigService,
    ManufacturingReportsService,
  ],
  exports: [
    BomsService,
    ProductionOrdersService,
    ProductionExecutionService,
    ManufacturingConfigService,
    ManufacturingReportsService,
  ],
})
export class ManufacturingModule {}
