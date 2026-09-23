import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { MasterDataModule } from '../master-data/master-data.module';

// Reasons
import { ReturnReasonsService } from './reasons/return-reasons.service';
import { ReturnReasonsController } from './reasons/return-reasons.controller';

// Policies
import { ReturnPoliciesService } from './policies/return-policies.service';
import { ReturnPoliciesController } from './policies/return-policies.controller';

// Customer & Supplier Validation
import { CustomerReturnsService } from './customer/customer-returns.service';
import { SupplierReturnsService } from './supplier/supplier-returns.service';

// Requests
import { ReturnRequestsService } from './requests/return-requests.service';
import { ReturnRequestsController } from './requests/return-requests.controller';

// Receiving
import { ReturnReceivingService } from './receiving/return-receiving.service';
import { ReturnReceivingController } from './receiving/return-receiving.controller';

// Inspection
import { ReturnQualityIntegrationService } from './inspection/return-quality-integration.service';
import { ReturnQualityController } from './inspection/return-quality.controller';

// Disposition
import { ReturnDispositionService } from './disposition/return-disposition.service';
import { ReturnDispositionController } from './disposition/return-disposition.controller';

// Financial & Replacement Resolutions
import { ReturnFinancialResolutionService } from './resolutions/return-financial-resolution.service';
import { ReturnResolutionsController } from './resolutions/return-resolutions.controller';

// Reports
import { ReturnsReportsService } from './reports/returns-reports.service';
import { ReturnsReportsController } from './reports/returns-reports.controller';

@Module({
  imports: [PrismaModule, EventsModule, MasterDataModule],
  controllers: [
    ReturnReasonsController,
    ReturnPoliciesController,
    ReturnRequestsController,
    ReturnReceivingController,
    ReturnQualityController,
    ReturnDispositionController,
    ReturnResolutionsController,
    ReturnsReportsController,
  ],
  providers: [
    ReturnReasonsService,
    ReturnPoliciesService,
    CustomerReturnsService,
    SupplierReturnsService,
    ReturnRequestsService,
    ReturnReceivingService,
    ReturnQualityIntegrationService,
    ReturnDispositionService,
    ReturnFinancialResolutionService,
    ReturnsReportsService,
  ],
  exports: [
    ReturnReasonsService,
    ReturnPoliciesService,
    CustomerReturnsService,
    SupplierReturnsService,
    ReturnRequestsService,
    ReturnReceivingService,
    ReturnQualityIntegrationService,
    ReturnDispositionService,
    ReturnFinancialResolutionService,
    ReturnsReportsService,
  ],
})
export class ReturnsModule {}
