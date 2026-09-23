import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseRequisitionsService } from './purchase-requisitions.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BadRequestException } from '@nestjs/common';
import {
  PurchaseRequisitionStatus,
  PlannedOrderStatus,
  PlannedOrderAction,
  PurchaseOrderStatus,
  Prisma,
} from '@prisma/client';

describe('PurchaseRequisitionsService', () => {
  let service: PurchaseRequisitionsService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';

  beforeEach(async () => {
    prisma = {
      supplier: { findFirst: jest.fn() },
      location: { findFirst: jest.fn() },
      purchaseRequisition: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      purchaseRequisitionLine: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      purchaseOrder: {
        count: jest.fn(),
        create: jest.fn(),
      },
      plannedOrder: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      currency: { findFirst: jest.fn() },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    eventBus = { publish: jest.fn() };
    numberingService = { nextNumber: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseRequisitionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
      ],
    }).compile();

    service = module.get<PurchaseRequisitionsService>(
      PurchaseRequisitionsService,
    );
  });

  describe('create', () => {
    it('should create a draft purchase requisition with auto-generated number', async () => {
      numberingService.nextNumber.mockResolvedValue({ formatted: 'PR-000001' });
      prisma.supplier.findFirst.mockResolvedValue({ id: 'supp-1' });
      prisma.location.findFirst.mockResolvedValue({ id: 'loc-1' });

      prisma.purchaseRequisition.create.mockResolvedValue({
        id: 'pr-1',
        requisitionNumber: 'PR-000001',
        status: PurchaseRequisitionStatus.DRAFT,
        lines: [{ id: 'prl-1', estimatedTotal: new Prisma.Decimal(500) }],
      });

      const res = await service.create(
        mockOrgId,
        {
          requiredDate: '2026-09-01',
          supplierId: 'supp-1',
          locationId: 'loc-1',
          lines: [
            {
              itemId: 'item-1',
              quantity: 50,
              estimatedUnitPrice: 10,
              requiredDate: '2026-09-01',
            },
          ],
        },
        mockUserId,
      );

      expect(res.requisitionNumber).toBe('PR-000001');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'PURCHASE_REQUISITION_CREATED' }),
      );
    });

    it('should reject PR creation if lines are empty', async () => {
      await expect(
        service.create(
          mockOrgId,
          {
            requiredDate: '2026-09-01',
            lines: [],
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('lifecycle transitions', () => {
    it('should transition DRAFT -> SUBMITTED -> APPROVED', async () => {
      prisma.purchaseRequisition.findFirst
        .mockResolvedValueOnce({
          id: 'pr-1',
          status: PurchaseRequisitionStatus.DRAFT,
        })
        .mockResolvedValueOnce({
          id: 'pr-1',
          status: PurchaseRequisitionStatus.SUBMITTED,
        });

      prisma.purchaseRequisition.update
        .mockResolvedValueOnce({
          id: 'pr-1',
          status: PurchaseRequisitionStatus.SUBMITTED,
        })
        .mockResolvedValueOnce({
          id: 'pr-1',
          status: PurchaseRequisitionStatus.APPROVED,
        });

      const submitted = await service.submit(mockOrgId, 'pr-1', mockUserId);
      expect(submitted.status).toBe(PurchaseRequisitionStatus.SUBMITTED);

      const approved = await service.approve(mockOrgId, 'pr-1', mockUserId);
      expect(approved.status).toBe(PurchaseRequisitionStatus.APPROVED);
    });

    it('should reject invalid transition directly from DRAFT to APPROVED', async () => {
      prisma.purchaseRequisition.findFirst.mockResolvedValue({
        id: 'pr-1',
        status: PurchaseRequisitionStatus.DRAFT,
      });

      await expect(
        service.approve(mockOrgId, 'pr-1', mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('convertToPO', () => {
    it('should convert APPROVED PR into a Purchase Order and set PR to CONVERTED', async () => {
      numberingService.nextNumber.mockResolvedValue({ formatted: 'PO-000001' });

      prisma.purchaseRequisition.findFirst.mockResolvedValue({
        id: 'pr-1',
        organizationId: mockOrgId,
        requisitionNumber: 'PR-000001',
        status: PurchaseRequisitionStatus.APPROVED,
        supplierId: 'supp-1',
        locationId: 'loc-1',
        currencyId: 'curr-1',
        requiredDate: new Date('2026-09-01'),
        supplier: { id: 'supp-1', currencyId: 'curr-1' },
        lines: [
          {
            itemId: 'item-1',
            quantity: new Prisma.Decimal(100),
            estimatedUnitPrice: new Prisma.Decimal(20),
            requiredDate: new Date('2026-09-01'),
          },
        ],
      });

      prisma.purchaseOrder.create.mockResolvedValue({
        id: 'po-1',
        poNumber: 'PO-000001',
        status: PurchaseOrderStatus.DRAFT,
        subtotal: new Prisma.Decimal(2000),
        grandTotal: new Prisma.Decimal(2000),
      });

      const po = await service.convertToPO(mockOrgId, 'pr-1', mockUserId);
      expect(po.poNumber).toBe('PO-000001');
      expect(prisma.purchaseRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: PurchaseRequisitionStatus.CONVERTED },
        }),
      );
    });
  });

  describe('convertPlannedOrder', () => {
    it('should convert M26 Planned Order to PR and mark PlannedOrder as CONVERTED', async () => {
      numberingService.nextNumber.mockResolvedValue({ formatted: 'PR-000099' });

      prisma.plannedOrder.findFirst.mockResolvedValue({
        id: 'plan-1',
        orderNumber: 'PLN-000001',
        action: PlannedOrderAction.PURCHASE,
        status: PlannedOrderStatus.SUGGESTED,
        itemId: 'item-1',
        quantity: new Prisma.Decimal(75),
        requiredDate: new Date('2026-09-10'),
        locationId: 'loc-1',
        supplierId: 'supp-1',
        planningRunId: 'run-1',
      });

      prisma.purchaseRequisition.create.mockResolvedValue({
        id: 'pr-99',
        requisitionNumber: 'PR-000099',
        status: PurchaseRequisitionStatus.DRAFT,
        sourcePlannedOrderId: 'plan-1',
      });

      const pr = await service.convertPlannedOrder(
        mockOrgId,
        'plan-1',
        mockUserId,
      );
      expect(pr.requisitionNumber).toBe('PR-000099');
      expect(prisma.plannedOrder.update).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: { status: PlannedOrderStatus.CONVERTED },
      });
    });

    it('should reject double conversion of already converted planned order', async () => {
      prisma.plannedOrder.findFirst.mockResolvedValue({
        id: 'plan-1',
        action: PlannedOrderAction.PURCHASE,
        status: PlannedOrderStatus.CONVERTED,
      });

      await expect(
        service.convertPlannedOrder(mockOrgId, 'plan-1', mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
