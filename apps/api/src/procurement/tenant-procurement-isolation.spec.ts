import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseRequisitionsService } from './purchase-requisitions.service';
import { ProcurementPurchaseOrdersService } from './purchase-orders.service';
import { ProcurementGoodsReceiptsService } from './goods-receipts.service';
import { PurchaseReturnsService } from './purchase-returns.service';
import { ProcurementReportsService } from './procurement-reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BudgetControlService } from '../accounting/budgets/budget-control.service';
import { TaxCalculationService } from '../tax/tax-calculation.service';
import { CostingService } from '../inventory/costing/costing.service';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('Tenant Procurement Isolation Test Suite (10 Scenarios)', () => {
  let requisitionsService: PurchaseRequisitionsService;
  let ordersService: ProcurementPurchaseOrdersService;
  let receiptsService: ProcurementGoodsReceiptsService;
  let returnsService: PurchaseReturnsService;
  let reportsService: ProcurementReportsService;
  let prisma: any;

  const tenantA = 'tenant-aaa-111';
  const tenantB = 'tenant-bbb-222';
  const userA = 'user-aaa-111';

  beforeEach(async () => {
    prisma = {
      purchaseRequisition: {
        findFirst: jest.fn(({ where }) => {
          if (where.organizationId === tenantA && where.id === 'pr-a') {
            return Promise.resolve({ id: 'pr-a', organizationId: tenantA });
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn(({ where }) => {
          if (where.organizationId === tenantA)
            return Promise.resolve([{ id: 'pr-a' }]);
          return Promise.resolve([]);
        }),
      },
      purchaseOrder: {
        findFirst: jest.fn(({ where }) => {
          if (where.organizationId === tenantA && where.id === 'po-a') {
            return Promise.resolve({
              id: 'po-a',
              organizationId: tenantA,
              status: 'APPROVED',
              grandTotal: new Prisma.Decimal(100),
            });
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn(({ where }) => {
          if (where.organizationId === tenantA) {
            return Promise.resolve([
              {
                id: 'po-a',
                status: 'APPROVED',
                grandTotal: new Prisma.Decimal(100),
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      },
      goodsReceipt: {
        findFirst: jest.fn(({ where }) => {
          if (where.organizationId === tenantA && where.id === 'gr-a') {
            return Promise.resolve({ id: 'gr-a', organizationId: tenantA });
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn(({ where }) => {
          if (where.organizationId === tenantA)
            return Promise.resolve([{ id: 'gr-a' }]);
          return Promise.resolve([]);
        }),
      },
      purchaseReturn: {
        findFirst: jest.fn(({ where }) => {
          if (where.organizationId === tenantA && where.id === 'ret-a') {
            return Promise.resolve({ id: 'ret-a', organizationId: tenantA });
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn(({ where }) => {
          if (where.organizationId === tenantA)
            return Promise.resolve([{ id: 'ret-a' }]);
          return Promise.resolve([]);
        }),
      },
      plannedOrder: {
        findFirst: jest.fn(({ where }) => {
          if (where.organizationId === tenantA && where.id === 'plan-a') {
            return Promise.resolve({ id: 'plan-a', organizationId: tenantA });
          }
          return Promise.resolve(null);
        }),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseRequisitionsService,
        ProcurementPurchaseOrdersService,
        ProcurementGoodsReceiptsService,
        PurchaseReturnsService,
        ProcurementReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
        { provide: NumberingService, useValue: { nextNumber: jest.fn() } },
        {
          provide: BudgetControlService,
          useValue: { checkBudgetAvailability: jest.fn() },
        },
        {
          provide: TaxCalculationService,
          useValue: { calculateTax: jest.fn() },
        },
        { provide: CostingService, useValue: { recordReceipt: jest.fn() } },
      ],
    }).compile();

    requisitionsService = module.get<PurchaseRequisitionsService>(
      PurchaseRequisitionsService,
    );
    ordersService = module.get<ProcurementPurchaseOrdersService>(
      ProcurementPurchaseOrdersService,
    );
    receiptsService = module.get<ProcurementGoodsReceiptsService>(
      ProcurementGoodsReceiptsService,
    );
    returnsService = module.get<PurchaseReturnsService>(PurchaseReturnsService);
    reportsService = module.get<ProcurementReportsService>(
      ProcurementReportsService,
    );
  });

  it('1. Tenant B cannot find Tenant A purchase requisition by ID', async () => {
    await expect(requisitionsService.findOne(tenantB, 'pr-a')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('2. Tenant B cannot update Tenant A purchase requisition', async () => {
    await expect(
      requisitionsService.update(tenantB, 'pr-a', { notes: 'Hack' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('3. Tenant B cannot submit Tenant A purchase requisition', async () => {
    await expect(
      requisitionsService.submit(tenantB, 'pr-a', userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('4. Tenant B cannot approve Tenant A purchase requisition', async () => {
    await expect(
      requisitionsService.approve(tenantB, 'pr-a', userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('5. Tenant B cannot convert Tenant A planned order', async () => {
    await expect(
      requisitionsService.convertPlannedOrder(tenantB, 'plan-a', userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('6. Tenant B cannot find Tenant A purchase order by ID', async () => {
    await expect(ordersService.findOne(tenantB, 'po-a')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('7. Tenant B cannot approve Tenant A purchase order', async () => {
    await expect(ordersService.approve(tenantB, 'po-a', userA)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('8. Tenant B cannot find Tenant A goods receipt by ID', async () => {
    await expect(receiptsService.findOne(tenantB, 'gr-a')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('9. Tenant B cannot find Tenant A purchase return by ID', async () => {
    await expect(returnsService.findOne(tenantB, 'ret-a')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('10. Procurement reports strictly scope data to requesting tenant', async () => {
    const summaryA = await reportsService.getPurchaseOrderSummary(tenantA);
    expect(prisma.purchaseOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: tenantA } }),
    );
    expect(summaryA.totalCount).toBe(1);

    const summaryB = await reportsService.getPurchaseOrderSummary(tenantB);
    expect(prisma.purchaseOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: tenantB } }),
    );
    expect(summaryB.totalCount).toBe(0);
  });
});
