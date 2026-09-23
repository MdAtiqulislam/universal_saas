import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GoodsReceiptsService } from './receipts/goods-receipts.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BalancesService } from '../inventory/balances/balances.service';
import {
  GoodsReceiptStatus,
  PurchaseOrderStatus,
  Prisma,
} from '@prisma/client';

describe('Purchasing Concurrency & Over-Receiving Protection', () => {
  let service: GoodsReceiptsService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let balancesMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockLocationId = '22222222-2222-2222-2222-222222222222';
  const mockOrderId = '33333333-3333-3333-3333-333333333333';
  const mockPoLineId = '44444444-4444-4444-4444-444444444444';
  const mockItemId = '55555555-5555-5555-5555-555555555555';
  const mockUserId = '77777777-7777-7777-7777-777777777777';

  it('1. should prevent over-receiving when concurrent transactions attempt to consume remaining PO quantity', async () => {
    // Total ordered quantity is 10.
    // 5 concurrent requests attempt to receive 3 units each (total 15 requested).
    // Exactly 3 requests must succeed (3 * 3 = 9 received), and the remaining 2 requests must be rejected.

    let inMemoryReceived = new Prisma.Decimal('0.0000');
    const orderedQuantity = new Prisma.Decimal('10.0000');
    let txLock = Promise.resolve();

    prismaMock = {
      $transaction: jest.fn(async (callback) => {
        let releaseLock: () => void;
        const nextLock = new Promise<void>((resolve) => {
          releaseLock = resolve;
        });
        const currentLock = txLock;
        txLock = txLock.then(() => nextLock);
        await currentLock;

        try {
          const txMock: any = {
            purchaseOrderLine: {
              findUniqueOrThrow: jest.fn().mockImplementation(() =>
                Promise.resolve({
                  id: mockPoLineId,
                  purchaseOrderId: mockOrderId,
                  quantity: orderedQuantity,
                  receivedQuantity: inMemoryReceived,
                }),
              ),
              findMany: jest.fn().mockImplementation(() =>
                Promise.resolve([
                  {
                    id: mockPoLineId,
                    purchaseOrderId: mockOrderId,
                    quantity: orderedQuantity,
                    receivedQuantity: inMemoryReceived,
                  },
                ]),
              ),
              update: jest.fn().mockImplementation(({ data }) => {
                const inc = data.receivedQuantity.increment as Prisma.Decimal;
                inMemoryReceived = inMemoryReceived.plus(inc);
                return Promise.resolve({
                  id: mockPoLineId,
                  receivedQuantity: inMemoryReceived,
                });
              }),
            },
            purchaseOrder: {
              update: jest.fn().mockResolvedValue({}),
            },
            goodsReceipt: {
              update: jest.fn().mockResolvedValue({}),
              findUniqueOrThrow: jest.fn().mockImplementation(() =>
                Promise.resolve({
                  id: 'receipt-id',
                  receiptNumber: 'GR-000001',
                  status: GoodsReceiptStatus.POSTED,
                  location: {
                    id: mockLocationId,
                    code: 'WH-MAIN',
                    name: 'Main Warehouse',
                  },
                  purchaseOrder: {
                    id: mockOrderId,
                    poNumber: 'PO-000001',
                    status: PurchaseOrderStatus.PARTIALLY_RECEIVED,
                    supplier: {
                      id: 'sup-1',
                      code: 'SUP-01',
                      name: 'Supplier 1',
                    },
                  },
                  lines: [],
                }),
              ),
            },
          };

          return await callback(txMock);
        } finally {
          releaseLock!();
        }
      }),
      goodsReceipt: {
        findFirst: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve({
            id: where.id,
            organizationId: mockOrgId,
            receiptNumber: `GR-${where.id}`,
            locationId: mockLocationId,
            status: GoodsReceiptStatus.DRAFT,
            purchaseOrder: {
              id: mockOrderId,
              poNumber: 'PO-000001',
              status: PurchaseOrderStatus.APPROVED,
            },
            lines: [
              {
                id: `line-${where.id}`,
                purchaseOrderLineId: mockPoLineId,
                itemId: mockItemId,
                variantId: null,
                quantity: new Prisma.Decimal('3.0000'),
                batchId: null,
                serialId: null,
              },
            ],
          }),
        ),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingMock = {
      nextNumber: jest.fn(),
    };

    balancesMock = {
      applyStockMovement: jest.fn().mockResolvedValue({
        movementId: 'mov-1',
        quantityOnHand: '3',
        quantityAvailable: '3',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoodsReceiptsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        { provide: BalancesService, useValue: balancesMock },
      ],
    }).compile();

    service = module.get<GoodsReceiptsService>(GoodsReceiptsService);

    // Launch 5 concurrent receipt posts of 3 units each against 10 ordered units
    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        service.postReceipt(mockOrgId, `receipt-${i + 1}`, mockUserId),
      ),
    );

    const successful = attempts.filter((a) => a.status === 'fulfilled');
    const failed = attempts.filter((a) => a.status === 'rejected');

    // 3 * 3 = 9 <= 10. The 4th attempt needs 3 more (9 + 3 = 12 > 10) so it must fail.
    expect(successful.length).toBe(3);
    expect(failed.length).toBe(2);
    expect(inMemoryReceived.toString()).toBe('9');

    for (const failure of failed) {
      expect(failure.reason).toBeInstanceOf(BadRequestException);
    }
  });
});
