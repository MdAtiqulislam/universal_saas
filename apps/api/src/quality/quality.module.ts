import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { MasterDataModule } from '../master-data/master-data.module';

import { QualityConfigService } from './configuration/quality-config.service';
import { QualityConfigController } from './configuration/quality-config.controller';

import { SamplingPlansService } from './sampling/sampling-plans.service';
import { SamplingPlansController } from './sampling/sampling-plans.controller';

import { InspectionPlansService } from './plans/inspection-plans.service';
import { InspectionPlansController } from './plans/inspection-plans.controller';

import { InspectionDecisionService } from './inspections/inspection-decision.service';
import { InspectionLotsService } from './inspections/inspection-lots.service';
import { InspectionLotsController } from './inspections/inspection-lots.controller';

import { QualityHoldsService } from './holds/quality-holds.service';
import { QualityHoldsController } from './holds/quality-holds.controller';

import { NonConformanceService } from './ncr/non-conformance.service';
import { NonConformanceController } from './ncr/non-conformance.controller';

import { CapaService } from './capa/capa.service';
import { CapaController } from './capa/capa.controller';

import { SupplierQualityService } from './analytics/supplier-quality.service';
import { SupplierQualityController } from './analytics/supplier-quality.controller';

import { CustomerQualityService } from './analytics/customer-quality.service';
import { CustomerQualityController } from './analytics/customer-quality.controller';

import { QualityReportsService } from './reports/quality-reports.service';
import { QualityReportsController } from './reports/quality-reports.controller';

@Module({
  imports: [PrismaModule, EventsModule, MasterDataModule],
  controllers: [
    QualityConfigController,
    SamplingPlansController,
    InspectionPlansController,
    InspectionLotsController,
    QualityHoldsController,
    NonConformanceController,
    CapaController,
    SupplierQualityController,
    CustomerQualityController,
    QualityReportsController,
  ],
  providers: [
    QualityConfigService,
    SamplingPlansService,
    InspectionPlansService,
    InspectionDecisionService,
    InspectionLotsService,
    QualityHoldsService,
    NonConformanceService,
    CapaService,
    SupplierQualityService,
    CustomerQualityService,
    QualityReportsService,
  ],
  exports: [
    QualityConfigService,
    SamplingPlansService,
    InspectionPlansService,
    InspectionDecisionService,
    InspectionLotsService,
    QualityHoldsService,
    NonConformanceService,
    CapaService,
    SupplierQualityService,
    CustomerQualityService,
    QualityReportsService,
  ],
})
export class QualityModule {}
