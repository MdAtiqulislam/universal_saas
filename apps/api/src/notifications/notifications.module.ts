import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { OperationsModule } from '../operations/operations.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { BillingModule } from '../billing/billing.module';

// Repositories
import { NotificationRepository } from './repositories/notification.repository';
import { TemplateRepository } from './repositories/template.repository';
import { DeliveryRepository } from './repositories/delivery.repository';
import { PreferenceRepository } from './repositories/preference.repository';

// Adapters
import { InAppProviderAdapter } from './adapters/in-app-provider.adapter';
import { SandboxEmailProviderAdapter } from './adapters/sandbox-email-provider.adapter';
import { SandboxPushProviderAdapter } from './adapters/sandbox-push-provider.adapter';
import { SandboxSmsProviderAdapter } from './adapters/sandbox-sms-provider.adapter';

// Services
import { TemplateEngineService } from './services/template-engine.service';
import { TemplateManagementService } from './services/template-management.service';
import { NotificationPreferencesService } from './services/notification-preferences.service';
import { ChannelRouterService } from './services/channel-router.service';
import { NotificationDeliveryService } from './services/notification-delivery.service';
import { NotificationsService } from './services/notifications.service';
import { NotificationSchedulingService } from './services/notification-scheduling.service';
import { BulkNotificationsService } from './services/bulk-notifications.service';
import { PushDeviceService } from './services/push-device.service';
import { NotificationWebhooksService } from './services/notification-webhooks.service';
import { NotificationReportsService } from './services/notification-reports.service';
import { NotificationDashboardService } from './services/notification-dashboard.service';

// Controllers
import { NotificationsController } from './controllers/notifications.controller';
import { TemplatesController } from './controllers/templates.controller';
import { PreferencesController } from './controllers/preferences.controller';
import { ProvidersController } from './controllers/providers.controller';
import { DeliveriesController } from './controllers/deliveries.controller';
import { SchedulesController } from './controllers/schedules.controller';
import { DevicesController } from './controllers/devices.controller';
import { NotificationReportsController } from './controllers/reports.controller';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    OperationsModule,
    IntegrationsModule,
    BillingModule,
  ],
  controllers: [
    NotificationsController,
    TemplatesController,
    PreferencesController,
    ProvidersController,
    DeliveriesController,
    SchedulesController,
    DevicesController,
    NotificationReportsController,
  ],
  providers: [
    NotificationRepository,
    TemplateRepository,
    DeliveryRepository,
    PreferenceRepository,
    InAppProviderAdapter,
    SandboxEmailProviderAdapter,
    SandboxPushProviderAdapter,
    SandboxSmsProviderAdapter,
    TemplateEngineService,
    TemplateManagementService,
    NotificationPreferencesService,
    ChannelRouterService,
    NotificationDeliveryService,
    NotificationsService,
    NotificationSchedulingService,
    BulkNotificationsService,
    PushDeviceService,
    NotificationWebhooksService,
    NotificationReportsService,
    NotificationDashboardService,
  ],
  exports: [
    NotificationsService,
    TemplateEngineService,
    TemplateManagementService,
    NotificationPreferencesService,
    ChannelRouterService,
    NotificationDeliveryService,
    NotificationSchedulingService,
    BulkNotificationsService,
    PushDeviceService,
    NotificationReportsService,
    NotificationDashboardService,
    NotificationRepository,
    TemplateRepository,
    DeliveryRepository,
    PreferenceRepository,
  ],
})
export class NotificationsModule {}
