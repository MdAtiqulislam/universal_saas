import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { AccountingModule } from '../accounting/accounting.module';
import { BudgetsModule } from '../accounting/budgets/budgets.module';
import { TaxModule } from '../tax/tax.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CostingModule } from '../inventory/costing/costing.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

import { PurchaseRequisitionsService } from './purchase-requisitions.service';
import { ProcurementPurchaseOrdersService } from './purchase-orders.service';
import { ProcurementGoodsReceiptsService } from './goods-receipts.service';
import { PurchaseReturnsService } from './purchase-returns.service';
import { ProcurementReportsService } from './procurement-reports.service';
import { ProcurementController } from './procurement.controller';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    MasterDataModule,
    AccountingModule,
    BudgetsModule,
    TaxModule,
    InventoryModule,
    CostingModule,
    AuthModule,
    AuditModule,
  ],
  controllers: [ProcurementController],
  providers: [
    PurchaseRequisitionsService,
    ProcurementPurchaseOrdersService,
    ProcurementGoodsReceiptsService,
    PurchaseReturnsService,
    ProcurementReportsService,
  ],
  exports: [
    PurchaseRequisitionsService,
    ProcurementPurchaseOrdersService,
    ProcurementGoodsReceiptsService,
    PurchaseReturnsService,
    ProcurementReportsService,
  ],
})
export class ProcurementModule {}
