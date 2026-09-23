import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { EventsModule } from '../../events/events.module';
import { MasterDataModule } from '../../master-data/master-data.module';
import { BudgetsService } from './budgets.service';
import { BudgetVsActualService } from './budget-vs-actual.service';
import { BudgetControlService } from './budget-control.service';
import { BudgetAlertsService } from './budget-alerts.service';
import { BudgetReportsService } from './budget-reports.service';
import { BudgetsController } from './budgets.controller';

@Module({
  imports: [PrismaModule, AuthModule, EventsModule, MasterDataModule],
  controllers: [BudgetsController],
  providers: [
    BudgetsService,
    BudgetVsActualService,
    BudgetControlService,
    BudgetAlertsService,
    BudgetReportsService,
  ],
  exports: [
    BudgetsService,
    BudgetVsActualService,
    BudgetControlService,
    BudgetAlertsService,
    BudgetReportsService,
  ],
})
export class BudgetsModule {}
