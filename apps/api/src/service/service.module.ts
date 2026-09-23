import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { MasterDataModule } from '../master-data/master-data.module';

// Customer Assets
import { CustomerAssetsService } from './customer-assets/customer-assets.service';
import { CustomerAssetsController } from './customer-assets/customer-assets.controller';

// Warranty
import { WarrantyPoliciesService } from './warranty/warranty-policies.service';
import { WarrantyEligibilityService } from './warranty/warranty-eligibility.service';
import { WarrantyController } from './warranty/warranty.controller';

// Requests
import { ServiceRequestsService } from './requests/service-requests.service';
import { ServiceRequestsController } from './requests/service-requests.controller';

// Tickets
import { ServiceTicketsService } from './tickets/service-tickets.service';
import { ServiceTicketsController } from './tickets/service-tickets.controller';

// Diagnosis
import { ServiceDiagnosisService } from './diagnosis/service-diagnosis.service';
import { ServiceDiagnosisController } from './diagnosis/service-diagnosis.controller';

// Estimates
import { ServiceEstimatesService } from './estimates/service-estimates.service';
import { ServiceEstimatesController } from './estimates/service-estimates.controller';

// Orders
import { ServiceOrdersService } from './orders/service-orders.service';
import { ServiceOrdersController } from './orders/service-orders.controller';

// Parts
import { ServicePartsService } from './parts/service-parts.service';
import { ServicePartsController } from './parts/service-parts.controller';

// Labor
import { ServiceLaborService } from './labor/service-labor.service';
import { ServiceLaborController } from './labor/service-labor.controller';

// Costing
import { ServiceCostingService } from './costing/service-costing.service';

// Integrations
import { ServiceQualityIntegrationService } from './quality/service-quality-integration.service';
import { ServiceRmaIntegrationService } from './rma/service-rma-integration.service';
import { ServiceBillingIntegrationService } from './billing/service-billing-integration.service';
import { ServiceHandoverService } from './handover/service-handover.service';

// Reports
import { ServiceReportsService } from './reports/service-reports.service';
import { ServiceReportsController } from './reports/service-reports.controller';

@Module({
  imports: [PrismaModule, EventsModule, MasterDataModule],
  controllers: [
    CustomerAssetsController,
    WarrantyController,
    ServiceRequestsController,
    ServiceTicketsController,
    ServiceDiagnosisController,
    ServiceEstimatesController,
    ServiceOrdersController,
    ServicePartsController,
    ServiceLaborController,
    ServiceReportsController,
  ],
  providers: [
    CustomerAssetsService,
    WarrantyPoliciesService,
    WarrantyEligibilityService,
    ServiceRequestsService,
    ServiceTicketsService,
    ServiceDiagnosisService,
    ServiceEstimatesService,
    ServiceOrdersService,
    ServicePartsService,
    ServiceLaborService,
    ServiceCostingService,
    ServiceQualityIntegrationService,
    ServiceRmaIntegrationService,
    ServiceBillingIntegrationService,
    ServiceHandoverService,
    ServiceReportsService,
  ],
  exports: [
    CustomerAssetsService,
    WarrantyPoliciesService,
    WarrantyEligibilityService,
    ServiceRequestsService,
    ServiceTicketsService,
    ServiceDiagnosisService,
    ServiceEstimatesService,
    ServiceOrdersService,
    ServicePartsService,
    ServiceLaborService,
    ServiceCostingService,
    ServiceQualityIntegrationService,
    ServiceRmaIntegrationService,
    ServiceBillingIntegrationService,
    ServiceHandoverService,
    ServiceReportsService,
  ],
})
export class ServiceModule {}
