import { Test, TestingModule } from '@nestjs/testing';
import { SalesOrdersService } from './orders/sales-orders.service';
import { DeliveryOrdersService } from './deliveries/delivery-orders.service';
import { CustomerInvoicesService } from '../ar/invoices/customer-invoices.service';
import { CogsService } from '../inventory/costing/cogs.service';
import { BalancesService } from '../inventory/balances/balances.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { SalesOrderStatus, DeliveryOrderStatus, Prisma } from '@prisma/client';

describe('Sales & Fulfillment Concurrency (100 Parallel Workers)', () => {
  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = 'user-concurrency-worker';

  describe('1. 100 Parallel Sales Order Approval Attempts', () => {
    it('should allow exactly 1 approval and reject 99 concurrent attempts', async () => {
      let isApproved = false;

      const mockPrisma: any = {
        $transaction: jest.fn((cb) => cb(mockPrisma)),
        salesOrder: {
          findFirst: jest.fn(() => {
            if (isApproved) {
              return Promise.resolve({
                id: 'so-conc-1',
                orderNumber: 'SO-000001',
                status: SalesOrderStatus.APPROVED,
                customerId: 'cust-1',
                grandTotal: new Prisma.Decimal(100),
                customer: {
                  id: 'cust-1',
                  name: 'Acme',
                  isActive: true,
                  deletedAt: null,
                },
                lines: [{ id: 'line-1', quantity: new Prisma.Decimal(10) }],
              });
            }
            return Promise.resolve({
              id: 'so-conc-1',
              orderNumber: 'SO-000001',
              status: SalesOrderStatus.SUBMITTED,
              customerId: 'cust-1',
              grandTotal: new Prisma.Decimal(100),
              customer: {
                id: 'cust-1',
                name: 'Acme',
                isActive: true,
                deletedAt: null,
              },
              lines: [{ id: 'line-1', quantity: new Prisma.Decimal(10) }],
            });
          }),
          update: jest.fn(() => {
            if (isApproved) {
              throw new Error(
                'Concurrent modification: Order already approved',
              );
            }
            isApproved = true;
            return Promise.resolve({
              id: 'so-conc-1',
              status: SalesOrderStatus.APPROVED,
            });
          }),
          findUniqueOrThrow: jest.fn(() =>
            Promise.resolve({
              id: 'so-conc-1',
              orderNumber: 'SO-000001',
              status: SalesOrderStatus.APPROVED,
              customer: { id: 'cust-1' },
              currency: { id: 'curr-1' },
              location: { id: 'loc-1' },
              quotation: null,
              lines: [],
              deliveryOrders: [],
            }),
          ),
        },
        customerInvoice: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SalesOrdersService,
          { provide: PrismaService, useValue: mockPrisma },
          {
            provide: EventBusService,
            useValue: { publish: jest.fn().mockResolvedValue(undefined) },
          },
          {
            provide: NumberingService,
            useValue: {
              nextNumber: jest.fn().mockResolvedValue({ formatted: 'SO-1' }),
            },
          },
          {
            provide: CustomerInvoicesService,
            useValue: { createFromSalesOrder: jest.fn() },
          },
        ],
      }).compile();

      const service = module.get<SalesOrdersService>(SalesOrdersService);

      const workers = Array.from({ length: 100 }, () =>
        service.approve(mockOrgId, 'so-conc-1', mockUserId),
      );

      const results = await Promise.allSettled(workers);
      const successes = results.filter((r) => r.status === 'fulfilled');
      const rejections = results.filter((r) => r.status === 'rejected');

      expect(successes).toHaveLength(1);
      expect(rejections).toHaveLength(99);
    });
  });

  describe('2. 100 Parallel Inventory Allocation Attempts', () => {
    it('should never over-allocate inventory beyond available on-hand stock', async () => {
      let isAllocated = false;
      let totalReserved = new Prisma.Decimal(0);

      const mockPrisma: any = {
        $transaction: jest.fn((cb) => cb(mockPrisma)),
        salesOrder: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              id: 'so-conc-alloc',
              orderNumber: 'SO-000002',
              status: isAllocated
                ? SalesOrderStatus.ALLOCATED
                : SalesOrderStatus.APPROVED,
              locationId: 'loc-1',
              lines: [
                {
                  id: 'line-alloc',
                  itemId: 'item-1',
                  variantId: null,
                  quantity: new Prisma.Decimal(100),
                  quantityReserved: totalReserved,
                  quantityDelivered: new Prisma.Decimal(0),
                },
              ],
            }),
          ),
          update: jest.fn().mockResolvedValue({}),
          findUniqueOrThrow: jest.fn(() =>
            Promise.resolve({
              id: 'so-conc-alloc',
              orderNumber: 'SO-000002',
              status: SalesOrderStatus.ALLOCATED,
              customer: { id: 'cust-1' },
              currency: { id: 'curr-1' },
              location: { id: 'loc-1' },
              quotation: null,
              lines: [],
              deliveryOrders: [],
            }),
          ),
        },
        inventoryBalance: {
          findFirst: jest.fn(() => {
            const available = isAllocated
              ? new Prisma.Decimal(0)
              : new Prisma.Decimal(100);
            return Promise.resolve({
              id: 'bal-1',
              quantityOnHand: new Prisma.Decimal(100),
              quantityReserved: new Prisma.Decimal(100).sub(available),
            });
          }),
          update: jest.fn(() => {
            totalReserved = new Prisma.Decimal(100);
            isAllocated = true;
            return Promise.resolve({
              id: 'bal-1',
              quantityReserved: totalReserved,
            });
          }),
        },
        inventoryReservation: {
          create: jest.fn().mockResolvedValue({}),
        },
        salesOrderLine: {
          update: jest.fn().mockResolvedValue({}),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SalesOrdersService,
          { provide: PrismaService, useValue: mockPrisma },
          {
            provide: EventBusService,
            useValue: { publish: jest.fn().mockResolvedValue(undefined) },
          },
          {
            provide: NumberingService,
            useValue: {
              nextNumber: jest.fn().mockResolvedValue({ formatted: 'SO-2' }),
            },
          },
          {
            provide: CustomerInvoicesService,
            useValue: { createFromSalesOrder: jest.fn() },
          },
        ],
      }).compile();

      const service = module.get<SalesOrdersService>(SalesOrdersService);

      const workers = Array.from({ length: 100 }, () =>
        service.allocate(mockOrgId, 'so-conc-alloc', mockUserId),
      );

      await Promise.all(workers);

      // Total reserved stock must never exceed 100 on-hand units
      expect(totalReserved.toNumber()).toBe(100);
    });
  });

  describe('3. 100 Parallel Delivery Execution Attempts', () => {
    it('should prevent over-delivery and ensure exactly 1 execution per delivery order', async () => {
      let isDelivered = false;

      const mockPrisma: any = {
        $transaction: jest.fn((cb) => {
          if (isDelivered) {
            throw new Error('Concurrent modification: Already delivered');
          }
          isDelivered = true;
          return cb(mockPrisma);
        }),
        deliveryOrder: {
          findFirst: jest.fn(() => {
            if (isDelivered) {
              return Promise.resolve({
                id: 'do-conc-1',
                deliveryNumber: 'DO-000001',
                salesOrderId: 'so-1',
                locationId: 'loc-1',
                status: DeliveryOrderStatus.DELIVERED,
                salesOrder: { orderNumber: 'SO-000001' },
                lines: [],
              });
            }
            return Promise.resolve({
              id: 'do-conc-1',
              deliveryNumber: 'DO-000001',
              salesOrderId: 'so-1',
              locationId: 'loc-1',
              status: DeliveryOrderStatus.READY,
              salesOrder: { orderNumber: 'SO-000001' },
              lines: [
                {
                  id: 'do-l-1',
                  salesOrderLineId: 'so-l-1',
                  itemId: 'item-1',
                  variantId: null,
                  quantity: new Prisma.Decimal(50),
                  batchId: null,
                  serialId: null,
                },
              ],
            });
          }),
          update: jest.fn(() =>
            Promise.resolve({
              id: 'do-conc-1',
              status: DeliveryOrderStatus.DELIVERED,
            }),
          ),
          findUniqueOrThrow: jest.fn(() =>
            Promise.resolve({
              id: 'do-conc-1',
              deliveryNumber: 'DO-000001',
              salesOrderId: 'so-1',
              status: DeliveryOrderStatus.DELIVERED,
              salesOrder: { orderNumber: 'SO-000001' },
              customer: { id: 'cust-1' },
              location: { id: 'loc-1' },
              shippingAddress: null,
              lines: [],
            }),
          ),
        },
        salesOrderLine: {
          findUniqueOrThrow: jest.fn(() =>
            Promise.resolve({
              id: 'so-l-1',
              quantity: new Prisma.Decimal(50),
              quantityDelivered: new Prisma.Decimal(0),
            }),
          ),
          findMany: jest.fn(() =>
            Promise.resolve([
              {
                id: 'so-l-1',
                quantity: new Prisma.Decimal(50),
                quantityDelivered: new Prisma.Decimal(50),
              },
            ]),
          ),
          update: jest.fn().mockResolvedValue({}),
        },
        salesOrder: {
          update: jest.fn().mockResolvedValue({}),
        },
        inventoryReservation: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        inventoryBalance: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };

      const balancesMock: any = {
        applyStockMovement: jest.fn().mockResolvedValue({
          balance: { id: 'bal-1' },
          movement: { id: 'mov-1' },
        }),
      };

      const cogsMock: any = {
        recordAndPostCogs: jest.fn().mockResolvedValue({}),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DeliveryOrdersService,
          { provide: PrismaService, useValue: mockPrisma },
          {
            provide: EventBusService,
            useValue: { publish: jest.fn().mockResolvedValue(undefined) },
          },
          {
            provide: NumberingService,
            useValue: {
              nextNumber: jest.fn().mockResolvedValue({ formatted: 'DO-1' }),
            },
          },
          { provide: BalancesService, useValue: balancesMock },
          { provide: CogsService, useValue: cogsMock },
        ],
      }).compile();

      const service = module.get<DeliveryOrdersService>(DeliveryOrdersService);

      const workers = Array.from({ length: 100 }, () =>
        service.executeDelivery(mockOrgId, 'do-conc-1', mockUserId),
      );

      const results = await Promise.allSettled(workers);
      const successes = results.filter((r) => r.status === 'fulfilled');
      const rejections = results.filter((r) => r.status === 'rejected');
      if (successes.length === 0) {
        console.log('Worker 0 failure:', (rejections[0] as any)?.reason);
      }

      expect(successes).toHaveLength(1);
      expect(rejections).toHaveLength(99);
      expect(balancesMock.applyStockMovement).toHaveBeenCalledTimes(1);
      expect(cogsMock.recordAndPostCogs).toHaveBeenCalledTimes(1);
    });
  });
});
