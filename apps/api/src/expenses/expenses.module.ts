import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { AccountsPayableModule } from '../ap/ap.module';
import { AccountingModule } from '../accounting/accounting.module';
import { TaxModule } from '../tax/tax.module';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseClaimantsService } from './expense-claimants.service';
import { ExpenseClaimsService } from './expense-claims.service';
import { ExpenseReimbursementsService } from './expense-reimbursements.service';
import { ExpenseReportsService } from './expense-reports.service';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EventsModule,
    MasterDataModule,
    AccountsPayableModule,
    AccountingModule,
    TaxModule,
  ],
  controllers: [ExpensesController],
  providers: [
    ExpenseCategoriesService,
    ExpenseClaimantsService,
    ExpenseClaimsService,
    ExpenseReimbursementsService,
    ExpenseReportsService,
    ExpensesService,
  ],
  exports: [
    ExpenseCategoriesService,
    ExpenseClaimantsService,
    ExpenseClaimsService,
    ExpenseReimbursementsService,
    ExpenseReportsService,
    ExpensesService,
  ],
})
export class ExpensesModule {}
