import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';

import { CategoriesService } from './categories/categories.service';
import { CategoriesController } from './categories/categories.controller';

import { UnitsService } from './units/units.service';
import { UnitsController } from './units/units.controller';

import { ItemsService } from './items/items.service';
import { ItemsController } from './items/items.controller';

import { VariantsService } from './variants/variants.service';
import { VariantsController } from './variants/variants.controller';

import { PricingService } from './pricing/pricing.service';
import { PricingController } from './pricing/pricing.controller';

@Module({
  imports: [PrismaModule, EventsModule, AuthModule, OrganizationsModule],
  controllers: [
    CategoriesController,
    UnitsController,
    ItemsController,
    VariantsController,
    PricingController,
  ],
  providers: [
    CategoriesService,
    UnitsService,
    ItemsService,
    VariantsService,
    PricingService,
  ],
  exports: [
    CategoriesService,
    UnitsService,
    ItemsService,
    VariantsService,
    PricingService,
  ],
})
export class CatalogModule {}
