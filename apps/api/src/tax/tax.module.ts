import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { AccountsPayableModule } from '../ap/ap.module';
import { AccountingModule } from '../accounting/accounting.module';
import { TaxJurisdictionsService } from './tax-jurisdictions.service';
import { TaxCodesService } from './tax-codes.service';
import { TaxRatesService } from './tax-rates.service';
import { TaxRulesService } from './tax-rules.service';
import { TaxCalculationService } from './tax-calculation.service';
import { TaxTransactionsService } from './tax-transactions.service';
import { TaxPeriodsService } from './tax-periods.service';
import { TaxReportingService } from './tax-reporting.service';
import { TaxService } from './tax.service';
import { TaxController } from './tax.controller';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    MasterDataModule,
    AccountsPayableModule,
    AccountingModule,
  ],
  controllers: [TaxController],
  providers: [
    TaxJurisdictionsService,
    TaxCodesService,
    TaxRatesService,
    TaxRulesService,
    TaxCalculationService,
    TaxTransactionsService,
    TaxPeriodsService,
    TaxReportingService,
    TaxService,
  ],
  exports: [
    TaxJurisdictionsService,
    TaxCodesService,
    TaxRatesService,
    TaxRulesService,
    TaxCalculationService,
    TaxTransactionsService,
    TaxPeriodsService,
    TaxReportingService,
    TaxService,
  ],
})
export class TaxModule {}
