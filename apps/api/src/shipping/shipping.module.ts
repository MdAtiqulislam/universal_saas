import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { SalesModule } from '../sales/sales.module';

import { ShipmentCarriersService } from './carriers/shipment-carriers.service';
import { ShipmentCarriersController } from './carriers/shipment-carriers.controller';

import { ShipmentsService } from './shipments/shipments.service';
import { ShipmentsController } from './shipments/shipments.controller';

import { ShipmentTrackingService } from './tracking/shipment-tracking.service';
import { ShipmentTrackingController } from './tracking/shipment-tracking.controller';

import { ShipmentReportsService } from './reports/shipment-reports.service';
import { ShipmentReportsController } from './reports/shipment-reports.controller';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    MasterDataModule,
    forwardRef(() => SalesModule),
  ],
  controllers: [
    ShipmentCarriersController,
    ShipmentsController,
    ShipmentTrackingController,
    ShipmentReportsController,
  ],
  providers: [
    ShipmentCarriersService,
    ShipmentsService,
    ShipmentTrackingService,
    ShipmentReportsService,
  ],
  exports: [
    ShipmentCarriersService,
    ShipmentsService,
    ShipmentTrackingService,
    ShipmentReportsService,
  ],
})
export class ShippingModule {}
