import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { AuditModule } from '../audit/audit.module';
import { OperationsModule } from '../operations/operations.module';

// Repositories
import { BillingPlanRepository } from './repositories/billing-plan.repository';
import { BillingSubscriptionRepository } from './repositories/billing-subscription.repository';
import { BillingUsageRepository } from './repositories/billing-usage.repository';
import { BillingInvoiceRepository } from './repositories/billing-invoice.repository';

// Adapters
import { SandboxBillingProviderAdapter } from './adapters/sandbox-billing-provider.adapter';

// Services
import { BillingPlansService } from './services/billing-plans.service';
import { ProrationService } from './services/proration.service';
import { TrialsService } from './services/trials.service';
import { SubscriptionsService } from './services/subscriptions.service';
import { EntitlementsService } from './services/entitlements.service';
import { UsageMeteringService } from './services/usage-metering.service';
import { InvoicesService } from './services/invoices.service';
import { CreditsDiscountsService } from './services/credits-discounts.service';
import { PaymentProviderService } from './services/payment-provider.service';
import { BillingWebhooksService } from './services/billing-webhooks.service';
import { BillingReportsService } from './services/billing-reports.service';
import { BillingDashboardService } from './services/billing-dashboard.service';

// Controllers
import { BillingPlansController } from './controllers/billing-plans.controller';
import { BillingSubscriptionController } from './controllers/billing-subscription.controller';
import { BillingEntitlementsController } from './controllers/billing-entitlements.controller';
import { BillingUsageController } from './controllers/billing-usage.controller';
import { BillingInvoicesController } from './controllers/billing-invoices.controller';
import { BillingPaymentsController } from './controllers/billing-payments.controller';
import { BillingCreditsController } from './controllers/billing-credits.controller';
import { BillingWebhooksController } from './controllers/billing-webhooks.controller';
import { BillingReportsController } from './controllers/billing-reports.controller';
import { BillingDashboardController } from './controllers/billing-dashboard.controller';

@Module({
  imports: [PrismaModule, EventsModule, AuditModule, OperationsModule],
  controllers: [
    BillingPlansController,
    BillingSubscriptionController,
    BillingEntitlementsController,
    BillingUsageController,
    BillingInvoicesController,
    BillingPaymentsController,
    BillingCreditsController,
    BillingWebhooksController,
    BillingReportsController,
    BillingDashboardController,
  ],
  providers: [
    BillingPlanRepository,
    BillingSubscriptionRepository,
    BillingUsageRepository,
    BillingInvoiceRepository,
    SandboxBillingProviderAdapter,
    BillingPlansService,
    ProrationService,
    TrialsService,
    SubscriptionsService,
    EntitlementsService,
    UsageMeteringService,
    InvoicesService,
    CreditsDiscountsService,
    PaymentProviderService,
    BillingWebhooksService,
    BillingReportsService,
    BillingDashboardService,
  ],
  exports: [
    BillingPlansService,
    ProrationService,
    TrialsService,
    SubscriptionsService,
    EntitlementsService,
    UsageMeteringService,
    InvoicesService,
    CreditsDiscountsService,
    PaymentProviderService,
    BillingWebhooksService,
    BillingReportsService,
    BillingDashboardService,
    BillingPlanRepository,
    BillingSubscriptionRepository,
    BillingUsageRepository,
    BillingInvoiceRepository,
  ],
})
export class BillingModule {}
