import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { InventoryModule } from '../inventory/inventory.module';

// Suppliers
import { SuppliersService } from './suppliers/suppliers.service';
import { SuppliersController } from './suppliers/suppliers.controller';

// Contacts
import { SupplierContactsService } from './contacts/supplier-contacts.service';
import { SupplierContactsController } from './contacts/supplier-contacts.controller';

// Addresses
import { SupplierAddressesService } from './addresses/supplier-addresses.service';
import { SupplierAddressesController } from './addresses/supplier-addresses.controller';

// Purchase Orders
import { PurchaseOrdersService } from './orders/purchase-orders.service';
import { PurchaseOrdersController } from './orders/purchase-orders.controller';

// Goods Receipts
import { GoodsReceiptsService } from './receipts/goods-receipts.service';
import { GoodsReceiptsController } from './receipts/goods-receipts.controller';

// Purchase Costs
import { PurchaseCostsService } from './costs/purchase-costs.service';
import { PurchaseCostsController } from './costs/purchase-costs.controller';

// Debit Notes (M18)
import { SupplierDebitNotesService } from './debit-notes/supplier-debit-notes.service';
import { SupplierDebitNotesController } from './debit-notes/supplier-debit-notes.controller';
import { AccountsPayableModule } from '../ap/ap.module';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    AuthModule,
    OrganizationsModule,
    MasterDataModule,
    InventoryModule,
    AccountsPayableModule,
  ],
  controllers: [
    SuppliersController,
    SupplierContactsController,
    SupplierAddressesController,
    PurchaseOrdersController,
    GoodsReceiptsController,
    PurchaseCostsController,
    SupplierDebitNotesController,
  ],
  providers: [
    SuppliersService,
    SupplierContactsService,
    SupplierAddressesService,
    PurchaseOrdersService,
    GoodsReceiptsService,
    PurchaseCostsService,
    SupplierDebitNotesService,
  ],
  exports: [
    SuppliersService,
    SupplierContactsService,
    SupplierAddressesService,
    PurchaseOrdersService,
    GoodsReceiptsService,
    PurchaseCostsService,
    SupplierDebitNotesService,
  ],
})
export class PurchasingModule {}
