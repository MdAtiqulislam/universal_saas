import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SalesOrdersService } from './sales-orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { CustomerInvoicesService } from '../../ar/invoices/customer-invoices.service';
import {
  SalesOrderStatus,
  ReservationStatus,
  Prisma,
  TrackingType,
} from '@prisma/client';

describe('SalesOrdersService', () => {
  let service: SalesOrdersService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let invoicesServiceMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockCustomerId = '22222222-2222-2222-2222-222222222222';
  const mockLocationId = '33333333-3333-3333-3333-333333333333';
  const mockCurrencyId = '44444444-4444-4444-4444-444444444444';
  const mockItemId = '55555555-5555-5555-5555-555555555555';
  const mockOrderId = '66666666-6666-6666-6666-666666666666';
  const mockUserId = '88888888-8888-8888-8888-888888888888';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      salesOrder: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      salesOrderLine: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
      },
      inventoryReservation: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      inventoryBalance: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      customer: { findFirst: jest.fn() },
      location: { findFirst: jest.fn() },
      currency: { findFirst: jest.fn() },
      item: { findFirst: jest.fn() },
      itemVariant: { findFirst: jest.fn() },
      quotation: { findFirst: jest.fn() },
      customerInvoice: { findMany: jest.fn().mockResolvedValue([]) },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({
        sequenceKey: 'SALES_ORDER',
        number: 1,
        formatted: 'SO-000001',
      }),
    };

    invoicesServiceMock = {
      createFromSalesOrder: jest.fn().mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-000001',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesOrdersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        { provide: CustomerInvoicesService, useValue: invoicesServiceMock },
      ],
    }).compile();

    service = module.get<SalesOrdersService>(SalesOrdersService);
  });

  it('1. should create draft sales order with precise decimal totals and numbering', async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      id: mockCustomerId,
      name: 'Acme Corp',
      isActive: true,
      paymentTermsDays: 30,
    });
    prismaMock.location.findFirst.mockResolvedValue({ id: mockLocationId });
    prismaMock.currency.findFirst.mockResolvedValue({ id: mockCurrencyId });
    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      sku: 'PROD-1',
      trackingType: TrackingType.NONE,
    });

    prismaMock.salesOrder.create.mockResolvedValue({
      id: mockOrderId,
      orderNumber: 'SO-000001',
      status: SalesOrderStatus.DRAFT,
      grandTotal: new Prisma.Decimal(1050),
    });

    const result = await service.create(
      mockOrgId,
      {
        customerId: mockCustomerId,
        currencyId: mockCurrencyId,
        locationId: mockLocationId,
        shippingTotal: 50,
        lines: [
          {
            itemId: mockItemId,
            quantity: 10,
            unitPrice: 100,
            discountAmount: 0,
            taxRate: 0,
          },
        ],
      },
      mockUserId,
    );

    expect(result.orderNumber).toBe('SO-000001');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'SALES_ORDER_CREATED' }),
    );
  });

  it('2. should find paginated sales orders', async () => {
    prismaMock.salesOrder.count.mockResolvedValue(1);
    prismaMock.salesOrder.findMany.mockResolvedValue([
      { id: mockOrderId, orderNumber: 'SO-000001' },
    ]);

    const res = await service.findAll(mockOrgId, { page: 1, limit: 10 });
    expect(res.total).toBe(1);
    expect(res.orders).toHaveLength(1);
  });

  it('3. should update draft sales order', async () => {
    prismaMock.salesOrder.findFirst.mockResolvedValue({
      id: mockOrderId,
      status: SalesOrderStatus.DRAFT,
      lines: [],
    });
    prismaMock.salesOrder.findUniqueOrThrow.mockResolvedValue({
      id: mockOrderId,
      orderNumber: 'SO-000001',
      status: SalesOrderStatus.DRAFT,
      grandTotal: new Prisma.Decimal(200),
    });

    const updated = await service.update(
      mockOrgId,
      mockOrderId,
      { notes: 'Updated notes' },
      mockUserId,
    );
    expect(updated.id).toBe(mockOrderId);
  });

  it('4. should cancel sales order and release active reservations', async () => {
    prismaMock.salesOrder.findFirst.mockResolvedValue({
      id: mockOrderId,
      status: SalesOrderStatus.APPROVED,
      notes: null,
      lines: [],
    });
    prismaMock.inventoryReservation.findMany.mockResolvedValue([
      {
        id: 'res-1',
        locationId: mockLocationId,
        itemId: mockItemId,
        variantId: null,
        quantity: new Prisma.Decimal(5),
      },
    ]);
    prismaMock.inventoryBalance.findFirst.mockResolvedValue({
      id: 'bal-1',
      quantityReserved: new Prisma.Decimal(5),
    });
    prismaMock.salesOrder.findUniqueOrThrow.mockResolvedValue({
      id: mockOrderId,
      orderNumber: 'SO-000001',
      status: SalesOrderStatus.CANCELLED,
    });

    const cancelled = await service.cancel(
      mockOrgId,
      mockOrderId,
      'Customer requested cancellation',
      mockUserId,
    );

    expect(cancelled.status).toBe(SalesOrderStatus.CANCELLED);
    expect(prismaMock.inventoryReservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ReservationStatus.RELEASED }),
      }),
    );
  });

  it('5. should close fulfilled sales order', async () => {
    prismaMock.salesOrder.findFirst.mockResolvedValue({
      id: mockOrderId,
      status: SalesOrderStatus.DELIVERED,
      lines: [],
    });
    prismaMock.salesOrder.update.mockResolvedValue({
      id: mockOrderId,
      orderNumber: 'SO-000001',
      status: SalesOrderStatus.CLOSED,
    });

    const closed = await service.close(mockOrgId, mockOrderId, mockUserId);
    expect(closed.status).toBe(SalesOrderStatus.CLOSED);
  });

  it('6. should reject closing non-delivered sales order', async () => {
    prismaMock.salesOrder.findFirst.mockResolvedValue({
      id: mockOrderId,
      status: SalesOrderStatus.DRAFT,
      lines: [],
    });

    await expect(
      service.close(mockOrgId, mockOrderId, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });

  it('7. should get financial summary derived from M14/M15 invoice records', async () => {
    prismaMock.salesOrder.findFirst.mockResolvedValue({
      id: mockOrderId,
      orderNumber: 'SO-000001',
      status: SalesOrderStatus.APPROVED,
      currency: { code: 'USD' },
      grandTotal: new Prisma.Decimal(1000),
      lines: [
        {
          quantityDelivered: new Prisma.Decimal(10),
          unitPrice: new Prisma.Decimal(100),
        },
      ],
    });
    prismaMock.customerInvoice.findMany.mockResolvedValue([
      {
        id: 'inv-1',
        grandTotal: new Prisma.Decimal(1000),
        amountPaid: new Prisma.Decimal(600),
      },
    ]);

    const summary = await service.getFinancialSummary(mockOrgId, mockOrderId);
    expect(summary.orderedAmount).toBe('1000');
    expect(summary.deliveredAmount).toBe('1000');
    expect(summary.invoicedAmount).toBe('1000');
    expect(summary.paidAmount).toBe('600');
    expect(summary.outstandingAmount).toBe('400');
  });

  it('8. should delegate invoice creation to M14 CustomerInvoicesService', async () => {
    const inv = await service.invoice(mockOrgId, mockOrderId, mockUserId);
    expect(invoicesServiceMock.createFromSalesOrder).toHaveBeenCalledWith(
      mockOrgId,
      mockOrderId,
      mockUserId,
    );
    expect(inv.invoiceNumber).toBe('INV-000001');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'SALES_ORDER_INVOICED' }),
    );
  });
});
