import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { AuditModule } from '../audit/audit.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AccountsPayableModule } from '../ap/ap.module';
import { AccountsReceivableModule } from '../ar/ar.module';

// Groups
import { CustomerGroupsService } from './groups/customer-groups.service';
import { CustomerGroupsController } from './groups/customer-groups.controller';

// Customers
import { CustomersService } from './customers/customers.service';
import { CustomersController } from './customers/customers.controller';

// Contacts
import { CustomerContactsService } from './contacts/customer-contacts.service';
import { CustomerContactsController } from './contacts/customer-contacts.controller';

// Addresses
import { CustomerAddressesService } from './addresses/customer-addresses.service';
import { CustomerAddressesController } from './addresses/customer-addresses.controller';

// Pricing
import { CustomerPricingService } from './pricing/customer-pricing.service';
import { CustomerPricingController } from './pricing/customer-pricing.controller';

// Quotations
import { QuotationsService } from './quotations/quotations.service';
import { QuotationsController } from './quotations/quotations.controller';

// Sales Orders
import { SalesOrdersService } from './orders/sales-orders.service';
import { SalesOrdersController } from './orders/sales-orders.controller';

// Reservations
import { ReservationsService } from './reservations/reservations.service';
import { ReservationsController } from './reservations/reservations.controller';

// Deliveries
import { DeliveryOrdersService } from './deliveries/delivery-orders.service';
import { DeliveryOrdersController } from './deliveries/delivery-orders.controller';

// Fulfillment Reports (M28)
import { SalesFulfillmentReportsService } from './fulfillment/sales-fulfillment-reports.service';
import { SalesFulfillmentReportsController } from './fulfillment/sales-fulfillment-reports.controller';

// Credit Notes & Refunds (M18)
import { CustomerCreditNotesService } from './credit-notes/customer-credit-notes.service';
import { CustomerCreditNotesController } from './credit-notes/customer-credit-notes.controller';
import { CustomerRefundsService } from './refunds/customer-refunds.service';
import { CustomerRefundsController } from './refunds/customer-refunds.controller';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    AuditModule,
    MasterDataModule,
    InventoryModule,
    AccountsPayableModule,
    forwardRef(() => AccountsReceivableModule),
  ],
  controllers: [
    CustomerGroupsController,
    CustomersController,
    CustomerContactsController,
    CustomerAddressesController,
    CustomerPricingController,
    QuotationsController,
    SalesOrdersController,
    ReservationsController,
    DeliveryOrdersController,
    SalesFulfillmentReportsController,
    CustomerCreditNotesController,
    CustomerRefundsController,
  ],
  providers: [
    CustomerGroupsService,
    CustomersService,
    CustomerContactsService,
    CustomerAddressesService,
    CustomerPricingService,
    QuotationsService,
    SalesOrdersService,
    ReservationsService,
    DeliveryOrdersService,
    SalesFulfillmentReportsService,
    CustomerCreditNotesService,
    CustomerRefundsService,
  ],
  exports: [
    CustomerGroupsService,
    CustomersService,
    CustomerContactsService,
    CustomerAddressesService,
    CustomerPricingService,
    QuotationsService,
    SalesOrdersService,
    ReservationsService,
    DeliveryOrdersService,
    SalesFulfillmentReportsService,
    CustomerCreditNotesService,
    CustomerRefundsService,
  ],
})
export class SalesModule {}
