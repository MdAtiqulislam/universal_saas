import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { EventsModule } from './events/events.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { RolesModule } from './roles/roles.module';
import { MasterDataModule } from './master-data/master-data.module';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { PurchasingModule } from './purchasing/purchasing.module';
import { SalesModule } from './sales/sales.module';
import { AccountingModule } from './accounting/accounting.module';
import { AccountsPayableModule } from './ap/ap.module';
import { AccountsReceivableModule } from './ar/ar.module';
import { PaymentsModule } from './payments/payments.module';
import { BankingModule } from './banking/banking.module';
import { TaxModule } from './tax/tax.module';
import { ExpensesModule } from './expenses/expenses.module';
import { AssetsModule } from './assets/assets.module';
import { PayrollModule } from './payroll/payroll.module';
import { ManufacturingModule } from './manufacturing/manufacturing.module';
import { PlanningModule } from './planning/planning.module';
import { ProcurementModule } from './procurement/procurement.module';
import { ShippingModule } from './shipping/shipping.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { QualityModule } from './quality/quality.module';
import { ReturnsModule } from './returns/returns.module';
import { ServiceModule } from './service/service.module';
import { CrmModule } from './crm/crm.module';
import { CommonModule } from './common/common.module';
import { SecurityModule } from './security/security.module';
import { OperationsModule } from './operations/operations.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { DeveloperModule } from './developer/developer.module';
import { BillingModule } from './billing/billing.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { DataOperationsModule } from './data-operations/data-operations.module';

@Module({
  imports: [
    CommonModule,
    SecurityModule,
    OperationsModule,
    IntegrationsModule,
    WorkflowsModule,
    DeveloperModule,
    BillingModule,
    NotificationsModule,
    SearchModule,
    AnalyticsModule,
    DataOperationsModule,
    PrismaModule,
    EventsModule,
    AuditModule,
    AuthModule,
    OrganizationsModule,
    RolesModule,
    MasterDataModule,
    CatalogModule,
    InventoryModule,
    PurchasingModule,
    SalesModule,
    AccountingModule,
    AccountsPayableModule,
    AccountsReceivableModule,
    PaymentsModule,
    BankingModule,
    TaxModule,
    ExpensesModule,
    AssetsModule,
    PayrollModule,
    ManufacturingModule,
    PlanningModule,
    ProcurementModule,
    ShippingModule,
    WarehouseModule,
    QualityModule,
    ReturnsModule,
    ServiceModule,
    CrmModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
