import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { AccountingModule } from '../accounting/accounting.module';
import { AccountsPayableModule } from '../ap/ap.module';

// Services & Controllers
import { PaymentAccountsService } from './accounts/payment-accounts.service';
import { PaymentAccountsController } from './accounts/payment-accounts.controller';
import { PaymentsService } from './transactions/payments.service';
import { PaymentsController } from './transactions/payments.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EventsModule,
    MasterDataModule,
    AccountingModule,
    AccountsPayableModule,
  ],
  controllers: [PaymentAccountsController, PaymentsController],
  providers: [PaymentAccountsService, PaymentsService],
  exports: [PaymentAccountsService, PaymentsService],
})
export class PaymentsModule {}
