import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { AccountingModule } from '../accounting/accounting.module';
import { AccountsPayableModule } from '../ap/ap.module';

// Services & Controllers
import { CustomerInvoicesService } from './invoices/customer-invoices.service';
import { CustomerInvoicesController } from './invoices/customer-invoices.controller';
import { ReceivablesService } from './receivables/receivables.service';
import { ReceivablesController } from './receivables/receivables.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EventsModule,
    MasterDataModule,
    AccountingModule,
    AccountsPayableModule,
  ],
  controllers: [CustomerInvoicesController, ReceivablesController],
  providers: [CustomerInvoicesService, ReceivablesService],
  exports: [CustomerInvoicesService, ReceivablesService],
})
export class AccountsReceivableModule {}
