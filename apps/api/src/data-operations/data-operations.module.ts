import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommonModule } from '../common/common.module';
import { DataOperationRegistryService } from './registry/data-operation.registry';
import { DataExportService } from './services/data-export.service';
import { DataImportService } from './services/data-import.service';
import { DataOperationJobsService } from './services/data-operation-jobs.service';
import { DataOperationQuotaService } from './services/data-operation-quota.service';
import { DataOperationNotificationService } from './services/data-operation-notification.service';
import { DataOperationsController } from './controllers/data-operations.controller';
import { GovernanceCatalogService } from './services/governance-catalog.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    BillingModule,
    NotificationsModule,
    CommonModule,
  ],
  controllers: [DataOperationsController],
  providers: [
    DataOperationRegistryService,
    DataExportService,
    DataImportService,
    DataOperationJobsService,
    DataOperationQuotaService,
    DataOperationNotificationService,
    GovernanceCatalogService,
  ],
  exports: [
    DataOperationRegistryService,
    DataExportService,
    DataImportService,
    DataOperationJobsService,
    DataOperationQuotaService,
    DataOperationNotificationService,
    GovernanceCatalogService,
  ],
})
export class DataOperationsModule {}
