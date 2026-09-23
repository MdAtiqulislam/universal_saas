import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { CurrenciesService } from './currencies/currencies.service';
import { CurrenciesController } from './currencies/currencies.controller';
import { LocationsService } from './locations/locations.service';
import { LocationsController } from './locations/locations.controller';
import { TaxesService } from './taxes/taxes.service';
import { TaxesController } from './taxes/taxes.controller';
import { NumberingService } from './numbering/numbering.service';
import { NumberingController } from './numbering/numbering.controller';

@Module({
  imports: [PrismaModule, AuthModule, OrganizationsModule],
  controllers: [
    CurrenciesController,
    LocationsController,
    TaxesController,
    NumberingController,
  ],
  providers: [
    CurrenciesService,
    LocationsService,
    TaxesService,
    NumberingService,
  ],
  exports: [
    CurrenciesService,
    LocationsService,
    TaxesService,
    NumberingService,
  ],
})
export class MasterDataModule {}
