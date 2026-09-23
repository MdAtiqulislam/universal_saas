import { Test, TestingModule } from '@nestjs/testing';
import { ProcurementReportsService } from './procurement-reports.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  PurchaseOrderStatus,
  PurchaseRequisitionStatus,
  Prisma,
} from '@prisma/client';

describe('ProcurementReportsService', () => {
  let service: ProcurementReportsService;
  let prisma: any;

  const mockOrgId = 'org-123';

  beforeEach(async () => {
    prisma = {
      purchaseOrder: {
        findMany: jest.fn(),
      },
      purchaseRequisition: {
        findMany: jest.fn(),
      },
      goodsReceipt: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcurementReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProcurementReportsService>(ProcurementReportsService);
  });

  describe('getPurchaseOrderSummary', () => {
    it('should aggregate purchase order status counts and spend', async () => {
      prisma.purchaseOrder.findMany.mockResolvedValue([
        {
          status: PurchaseOrderStatus.DRAFT,
          grandTotal: new Prisma.Decimal(100),
        },
        {
          status: PurchaseOrderStatus.APPROVED,
          grandTotal: new Prisma.Decimal(250),
        },
        {
          status: PurchaseOrderStatus.RECEIVED,
          grandTotal: new Prisma.Decimal(500),
        },
      ]);

      const summary = await service.getPurchaseOrderSummary(mockOrgId);

      expect(summary.totalCount).toBe(3);
      expect(summary.draftCount).toBe(1);
      expect(summary.approvedCount).toBe(1);
      expect(summary.receivedCount).toBe(1);
      expect(summary.totalSpend.toNumber()).toBe(850);
      expect(summary.openSpend.toNumber()).toBe(250);
      expect(summary.receivedSpend.toNumber()).toBe(500);
    });
  });

  describe('getRequisitionReport', () => {
    it('should break down requisitions by status', async () => {
      prisma.purchaseRequisition.findMany.mockResolvedValue([
        {
          id: 'pr-1',
          requisitionNumber: 'PR-000001',
          status: PurchaseRequisitionStatus.DRAFT,
          requiredDate: new Date('2026-09-01'),
          department: { name: 'Engineering' },
          supplier: null,
          location: { name: 'Main Warehouse' },
          _count: { lines: 2 },
          createdAt: new Date(),
        },
        {
          id: 'pr-2',
          requisitionNumber: 'PR-000002',
          status: PurchaseRequisitionStatus.APPROVED,
          requiredDate: new Date('2026-09-05'),
          department: { name: 'Operations' },
          supplier: { name: 'Acme Corp' },
          location: { name: 'Main Warehouse' },
          _count: { lines: 1 },
          createdAt: new Date(),
        },
      ]);

      const report = await service.getRequisitionReport(mockOrgId, {});
      expect(report.summary.total).toBe(2);
      expect(report.summary.draft).toBe(1);
      expect(report.summary.approved).toBe(1);
      expect(report.requisitions).toHaveLength(2);
    });
  });
});
