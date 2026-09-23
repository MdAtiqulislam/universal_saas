import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { AccountingModule } from '../accounting/accounting.module';

// Services & Controllers
import { ApAccountMappingService } from './account-mapping/ap-account-mapping.service';
import { ApAccountMappingController } from './account-mapping/ap-account-mapping.controller';
import { AccountsPayableMatchingService } from './matching/accounts-payable-matching.service';
import { SupplierInvoicesService } from './invoices/supplier-invoices.service';
import { SupplierInvoicesController } from './invoices/supplier-invoices.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EventsModule,
    MasterDataModule,
    AccountingModule,
  ],
  controllers: [ApAccountMappingController, SupplierInvoicesController],
  providers: [
    ApAccountMappingService,
    AccountsPayableMatchingService,
    SupplierInvoicesService,
  ],
  exports: [
    ApAccountMappingService,
    AccountsPayableMatchingService,
    SupplierInvoicesService,
  ],
})
export class AccountsPayableModule {}
