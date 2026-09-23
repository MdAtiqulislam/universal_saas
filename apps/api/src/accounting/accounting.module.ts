import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { AuditModule } from '../audit/audit.module';
import { MasterDataModule } from '../master-data/master-data.module';

// Accounts
import { AccountsService } from './accounts/accounts.service';
import { AccountsController } from './accounts/accounts.controller';

// Fiscal Periods
import { FiscalPeriodsService } from './periods/fiscal-periods.service';
import { FiscalPeriodsController } from './periods/fiscal-periods.controller';
import { PeriodCloseEngineService } from './periods/period-close-engine.service';

// Journals & Posting
import { JournalsService } from './journals/journals.service';
import { JournalsController } from './journals/journals.controller';
import { AccountingPostingService } from './posting/accounting-posting.service';

// Financial Reports (M17 & M33)
import { FinancialReportsService } from './reports/financial-reports.service';
import { FinancialReportsController } from './reports/financial-reports.controller';

// Budgets (M23)
import { BudgetsModule } from './budgets/budgets.module';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    AuditModule,
    MasterDataModule,
    BudgetsModule,
  ],
  controllers: [
    AccountsController,
    FiscalPeriodsController,
    JournalsController,
    FinancialReportsController,
  ],
  providers: [
    AccountsService,
    FiscalPeriodsService,
    PeriodCloseEngineService,
    JournalsService,
    AccountingPostingService,
    FinancialReportsService,
  ],
  exports: [
    AccountsService,
    FiscalPeriodsService,
    PeriodCloseEngineService,
    JournalsService,
    AccountingPostingService,
    FinancialReportsService,
    BudgetsModule,
  ],
})
export class AccountingModule {}
