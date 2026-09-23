import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { SalesModule } from '../sales/sales.module';

import { CrmLeadsService } from './leads/crm-leads.service';
import { CrmLeadsController } from './leads/crm-leads.controller';
import { CrmContactsService } from './contacts/crm-contacts.service';
import { CrmContactsController } from './contacts/crm-contacts.controller';
import { CrmOpportunitiesService } from './opportunities/crm-opportunities.service';
import { CrmOpportunitiesController } from './opportunities/crm-opportunities.controller';
import { CrmActivitiesService } from './activities/crm-activities.service';
import { CrmActivitiesController } from './activities/crm-activities.controller';
import { CrmQuotationsService } from './quotations/crm-quotations.service';
import { CrmQuotationsController } from './quotations/crm-quotations.controller';
import { CrmPipelineService } from './pipeline/crm-pipeline.service';
import { CrmPipelineController } from './pipeline/crm-pipeline.controller';
import { CrmCustomer360Service } from './customer-360/crm-customer-360.service';
import { CrmCustomer360Controller } from './customer-360/crm-customer-360.controller';
import { CrmReportsService } from './reports/crm-reports.service';
import { CrmReportsController } from './reports/crm-reports.controller';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    MasterDataModule,
    forwardRef(() => SalesModule),
  ],
  controllers: [
    CrmLeadsController,
    CrmContactsController,
    CrmOpportunitiesController,
    CrmActivitiesController,
    CrmQuotationsController,
    CrmPipelineController,
    CrmCustomer360Controller,
    CrmReportsController,
  ],
  providers: [
    CrmLeadsService,
    CrmContactsService,
    CrmOpportunitiesService,
    CrmActivitiesService,
    CrmQuotationsService,
    CrmPipelineService,
    CrmCustomer360Service,
    CrmReportsService,
  ],
  exports: [
    CrmLeadsService,
    CrmContactsService,
    CrmOpportunitiesService,
    CrmActivitiesService,
    CrmQuotationsService,
    CrmPipelineService,
    CrmCustomer360Service,
    CrmReportsService,
  ],
})
export class CrmModule {}
