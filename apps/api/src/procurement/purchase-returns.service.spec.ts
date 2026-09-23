import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseReturnsService } from './purchase-returns.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BadRequestException } from '@nestjs/common';
import { PurchaseReturnStatus, Prisma } from '@prisma/client';

describe('PurchaseReturnsService', () => {
  let service: PurchaseReturnsService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';

  beforeEach(async () => {
    prisma = {
      goodsReceipt: { findFirst: jest.fn() },
      purchaseReturn: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      purchaseReturnLine: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      stockMovement: {
        create: jest.fn(),
      },
      inventoryBalance: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    eventBus = { publish: jest.fn() };
    numberingService = { nextNumber: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseReturnsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
      ],
    }).compile();

    service = module.get<PurchaseReturnsService>(PurchaseReturnsService);
  });

  describe('create and post', () => {
    it('should create draft return and post with stock reversal', async () => {
      numberingService.nextNumber.mockResolvedValue({
        formatted: 'PRN-000001',
      });

      prisma.goodsReceipt.findFirst.mockResolvedValue({
        id: 'gr-1',
        receiptNumber: 'GR-000001',
        purchaseOrderId: 'po-1',
        supplierId: 'supp-1',
        locationId: 'loc-1',
        purchaseOrder: { supplierId: 'supp-1' },
        lines: [
          {
            id: 'grl-1',
            itemId: 'item-1',
            quantity: new Prisma.Decimal(50),
            unitCost: new Prisma.Decimal(10),
          },
        ],
      });

      prisma.purchaseReturnLine.findMany.mockResolvedValue([]);

      prisma.purchaseReturn.create.mockResolvedValue({
        id: 'ret-1',
        returnNumber: 'PRN-000001',
        status: PurchaseReturnStatus.DRAFT,
        lines: [{ id: 'retl-1' }],
      });

      const draftReturn = await service.create(
        mockOrgId,
        {
          purchaseOrderId: 'po-1',
          goodsReceiptId: 'gr-1',
          lines: [{ goodsReceiptLineId: 'grl-1', quantity: 20 }],
        },
        mockUserId,
      );

      expect(draftReturn.returnNumber).toBe('PRN-000001');

      // Now post return
      prisma.purchaseReturn.findFirst.mockResolvedValue({
        id: 'ret-1',
        returnNumber: 'PRN-000001',
        status: PurchaseReturnStatus.DRAFT,
        locationId: 'loc-1',
        goodsReceipt: { receiptNumber: 'GR-000001' },
        lines: [
          {
            id: 'retl-1',
            itemId: 'item-1',
            quantity: new Prisma.Decimal(20),
            unitCost: new Prisma.Decimal(10),
          },
        ],
      });

      prisma.stockMovement.create.mockResolvedValue({ id: 'mov-ret-1' });
      prisma.inventoryBalance.findFirst.mockResolvedValue({
        id: 'bal-1',
        quantityOnHand: new Prisma.Decimal(50),
      });

      prisma.purchaseReturn.update.mockResolvedValue({
        id: 'ret-1',
        returnNumber: 'PRN-000001',
        status: PurchaseReturnStatus.POSTED,
      });

      const posted = await service.post(mockOrgId, 'ret-1', mockUserId);
      expect(posted.status).toBe(PurchaseReturnStatus.POSTED);
      expect(prisma.stockMovement.create).toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'PURCHASE_RETURN_POSTED' }),
      );
    });

    it('should reject return exceeding received quantity', async () => {
      prisma.goodsReceipt.findFirst.mockResolvedValue({
        id: 'gr-1',
        receiptNumber: 'GR-000001',
        purchaseOrderId: 'po-1',
        purchaseOrder: { supplierId: 'supp-1' },
        lines: [
          {
            id: 'grl-1',
            itemId: 'item-1',
            quantity: new Prisma.Decimal(10),
            unitCost: new Prisma.Decimal(10),
          },
        ],
      });

      prisma.purchaseReturnLine.findMany.mockResolvedValue([]);

      await expect(
        service.create(
          mockOrgId,
          {
            purchaseOrderId: 'po-1',
            goodsReceiptId: 'gr-1',
            lines: [{ goodsReceiptLineId: 'grl-1', quantity: 20 }],
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
