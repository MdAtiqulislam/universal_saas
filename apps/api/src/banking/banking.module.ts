import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { AccountingModule } from '../accounting/accounting.module';
import { PaymentsModule } from '../payments/payments.module';

// Services & Controllers
import { BankAccountsService } from './accounts/bank-accounts.service';
import { BankAccountsController } from './accounts/bank-accounts.controller';
import { BankStatementsService } from './statements/bank-statements.service';
import { BankStatementsController } from './statements/bank-statements.controller';
import { BankMatchingService } from './matching/bank-matching.service';
import { BankMatchingController } from './matching/bank-matching.controller';
import { BankReconciliationService } from './reconciliation/bank-reconciliation.service';
import { BankReconciliationController } from './reconciliation/bank-reconciliation.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EventsModule,
    MasterDataModule,
    AccountingModule,
    PaymentsModule,
  ],
  controllers: [
    BankAccountsController,
    BankStatementsController,
    BankMatchingController,
    BankReconciliationController,
  ],
  providers: [
    BankAccountsService,
    BankStatementsService,
    BankMatchingService,
    BankReconciliationService,
  ],
  exports: [
    BankAccountsService,
    BankStatementsService,
    BankMatchingService,
    BankReconciliationService,
  ],
})
export class BankingModule {}
