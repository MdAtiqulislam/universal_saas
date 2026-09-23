import { Test, TestingModule } from '@nestjs/testing';
import { SalesFulfillmentReportsService } from './sales-fulfillment-reports.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, SalesOrderStatus } from '@prisma/client';

describe('SalesFulfillmentReportsService', () => {
  let service: SalesFulfillmentReportsService;
  let prismaMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockCustomerId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    prismaMock = {
      salesOrder: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      salesOrderLine: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      deliveryOrder: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesFulfillmentReportsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<SalesFulfillmentReportsService>(
      SalesFulfillmentReportsService,
    );
  });

  describe('1. Sales Order Summary Report', () => {
    it('should calculate accurate metrics for orders, quantities, and fulfillment rates', async () => {
      prismaMock.salesOrder.findMany.mockResolvedValue([
        {
          id: 'so-1',
          grandTotal: new Prisma.Decimal(1000),
          lines: [
            {
              quantity: new Prisma.Decimal(100),
              quantityDelivered: new Prisma.Decimal(75),
            },
          ],
          customerInvoices: [
            {
              grandTotal: new Prisma.Decimal(750),
            },
          ],
        },
      ]);

      const summary = await service.getSalesOrderSummary(mockOrgId, {});
      expect(summary.totalOrders).toBe(1);
      expect(summary.totalOrderedQuantity).toBe('100');
      expect(summary.totalDeliveredQuantity).toBe('75');
      expect(summary.totalRemainingQuantity).toBe('25');
      expect(summary.totalOrderedAmount).toBe('1000');
      expect(summary.totalInvoicedAmount).toBe('750');
      expect(summary.overallFulfillmentRate).toBe(75);
    });
  });

  describe('2. Open Sales Orders Report', () => {
    it('should return open orders with calculated remaining quantities and fulfillment percentage', async () => {
      prismaMock.salesOrder.count.mockResolvedValue(1);
      prismaMock.salesOrder.findMany.mockResolvedValue([
        {
          id: 'so-1',
          orderNumber: 'SO-000001',
          customer: { id: mockCustomerId, code: 'CUST-1', name: 'Acme' },
          location: { id: 'loc-1', code: 'MAIN', name: 'Main HQ' },
          currency: { id: 'curr-1', code: 'USD', symbol: '$' },
          status: SalesOrderStatus.PARTIALLY_FULFILLED,
          orderDate: new Date('2026-08-01'),
          expectedDeliveryDate: new Date('2026-08-15'),
          grandTotal: new Prisma.Decimal(1000),
          lines: [
            {
              quantity: new Prisma.Decimal(100),
              quantityDelivered: new Prisma.Decimal(60),
              quantityReserved: new Prisma.Decimal(20),
            },
          ],
        },
      ]);

      const res = await service.getOpenSalesOrders(mockOrgId, {
        page: 1,
        limit: 10,
      });
      expect(res.total).toBe(1);
      expect(res.data[0].orderNumber).toBe('SO-000001');
      expect(res.data[0].orderedQuantity).toBe('100');
      expect(res.data[0].deliveredQuantity).toBe('60');
      expect(res.data[0].remainingQuantity).toBe('40');
      expect(res.data[0].fulfillmentPercentage).toBe(60);
    });
  });

  describe('3. Fulfillment Report', () => {
    it('should aggregate per-line fulfillment details', async () => {
      prismaMock.salesOrderLine.count.mockResolvedValue(1);
      prismaMock.salesOrderLine.findMany.mockResolvedValue([
        {
          id: 'line-1',
          salesOrderId: 'so-1',
          quantity: new Prisma.Decimal(200),
          quantityReserved: new Prisma.Decimal(50),
          quantityDelivered: new Prisma.Decimal(100),
          unitPrice: new Prisma.Decimal(10),
          lineTotal: new Prisma.Decimal(2000),
          item: { id: 'item-1', sku: 'SKU-1', name: 'Product 1' },
          variant: null,
          salesOrder: {
            id: 'so-1',
            orderNumber: 'SO-000001',
            status: SalesOrderStatus.PARTIALLY_FULFILLED,
            customer: { id: mockCustomerId, code: 'CUST-1', name: 'Acme' },
            orderDate: new Date('2026-08-01'),
            expectedDeliveryDate: null,
          },
        },
      ]);

      const res = await service.getFulfillmentReport(mockOrgId, {
        page: 1,
        limit: 10,
      });
      expect(res.total).toBe(1);
      expect(res.data[0].orderedQuantity).toBe('200');
      expect(res.data[0].deliveredQuantity).toBe('100');
      expect(res.data[0].remainingQuantity).toBe('100');
      expect(res.data[0].fulfillmentPercentage).toBe(50);
    });
  });

  describe('4. Customer Order History Report', () => {
    it('should return chronological order history for a customer', async () => {
      prismaMock.salesOrder.count.mockResolvedValue(1);
      prismaMock.salesOrder.findMany.mockResolvedValue([
        {
          id: 'so-1',
          orderNumber: 'SO-000001',
          orderDate: new Date('2026-08-01'),
          grandTotal: new Prisma.Decimal(500),
          deliveryOrders: [],
          customerInvoices: [],
          lines: [],
        },
      ]);

      const res = await service.getCustomerOrderHistory(
        mockOrgId,
        mockCustomerId,
        {
          page: 1,
          limit: 10,
        },
      );
      expect(res.total).toBe(1);
      expect(res.data[0].orderNumber).toBe('SO-000001');
    });
  });

  describe('5. Delivery Performance Report', () => {
    it('should compute on-time delivery rate and delayed shipments', async () => {
      prismaMock.deliveryOrder.findMany.mockResolvedValue([
        {
          id: 'do-1',
          deliveryNumber: 'DO-000001',
          scheduledDate: new Date('2026-08-10'),
          deliveredAt: new Date('2026-08-09'), // On time
          customer: { id: mockCustomerId, code: 'CUST-1', name: 'Acme' },
          salesOrder: {
            id: 'so-1',
            orderNumber: 'SO-000001',
            orderDate: new Date('2026-08-01'),
            expectedDeliveryDate: new Date('2026-08-10'),
          },
        },
        {
          id: 'do-2',
          deliveryNumber: 'DO-000002',
          scheduledDate: new Date('2026-08-10'),
          deliveredAt: new Date('2026-08-12'), // 2 days delayed
          customer: { id: mockCustomerId, code: 'CUST-1', name: 'Acme' },
          salesOrder: {
            id: 'so-2',
            orderNumber: 'SO-000002',
            orderDate: new Date('2026-08-01'),
            expectedDeliveryDate: new Date('2026-08-10'),
          },
        },
      ]);

      const perf = await service.getDeliveryPerformance(mockOrgId, {});
      expect(perf.totalDeliveries).toBe(2);
      expect(perf.onTimeCount).toBe(1);
      expect(perf.delayedCount).toBe(1);
      expect(perf.onTimeRate).toBe(50);
      expect(perf.deliveries[1].delayDays).toBe(2);
    });
  });
});
