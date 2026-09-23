import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

import { BalancesService } from './balances/balances.service';
import { BalancesController } from './balances/balances.controller';
import { AdjustmentsService } from './adjustments/adjustments.service';
import { AdjustmentsController } from './adjustments/adjustments.controller';
import { BatchesService } from './batches/batches.service';
import { BatchesController } from './batches/batches.controller';
import { SerialsService } from './serials/serials.service';
import { SerialsController } from './serials/serials.controller';
import { MovementsService } from './movements/movements.service';
import { MovementsController } from './movements/movements.controller';
import { TransfersService } from './transfers/transfers.service';
import { TransfersController } from './transfers/transfers.controller';
import { CostingModule } from './costing/costing.module';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    MasterDataModule,
    AuditModule,
    AuthModule,
    CostingModule,
  ],
  providers: [
    BalancesService,
    AdjustmentsService,
    BatchesService,
    SerialsService,
    MovementsService,
    TransfersService,
  ],
  controllers: [
    BalancesController,
    AdjustmentsController,
    BatchesController,
    SerialsController,
    MovementsController,
    TransfersController,
  ],
  exports: [
    BalancesService,
    AdjustmentsService,
    BatchesService,
    SerialsService,
    MovementsService,
    TransfersService,
    CostingModule,
  ],
})
export class InventoryModule {}
