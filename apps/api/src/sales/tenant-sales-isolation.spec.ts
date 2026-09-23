import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers/customers.service';
import { QuotationsService } from './quotations/quotations.service';
import { SalesOrdersService } from './orders/sales-orders.service';
import { DeliveryOrdersService } from './deliveries/delivery-orders.service';
import { ReservationsService } from './reservations/reservations.service';
import { SalesFulfillmentReportsService } from './fulfillment/sales-fulfillment-reports.service';
import { CustomerInvoicesService } from '../ar/invoices/customer-invoices.service';
import { CogsService } from '../inventory/costing/cogs.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BalancesService } from '../inventory/balances/balances.service';

describe('Tenant Sales & Fulfillment Isolation', () => {
  let customersService: CustomersService;
  let ordersService: SalesOrdersService;
  let deliveryService: DeliveryOrdersService;
  let reportsService: SalesFulfillmentReportsService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let balancesMock: any;
  let cogsMock: any;
  let invoicesMock: any;

  const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const customerB = '22222222-2222-2222-2222-222222222222';
  const itemB = '44444444-4444-4444-4444-444444444444';
  const orderB = '55555555-5555-5555-5555-555555555555';
  const deliveryB = '66666666-6666-6666-6666-666666666666';
  const userA = '88888888-8888-8888-8888-888888888888';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      customer: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      quotation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      salesOrder: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      salesOrderLine: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      deliveryOrder: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      inventoryReservation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      location: { findFirst: jest.fn() },
      item: { findFirst: jest.fn() },
      currency: { findFirst: jest.fn() },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({
        sequenceKey: 'TEST',
        number: 1,
        formatted: 'TEST-000001',
      }),
    };

    balancesMock = {
      applyStockMovement: jest.fn().mockResolvedValue({}),
    };

    cogsMock = {
      recordAndPostCogs: jest.fn().mockResolvedValue({}),
    };

    invoicesMock = {
      createFromSalesOrder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        QuotationsService,
        SalesOrdersService,
        DeliveryOrdersService,
        ReservationsService,
        SalesFulfillmentReportsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        { provide: BalancesService, useValue: balancesMock },
        { provide: CogsService, useValue: cogsMock },
        { provide: CustomerInvoicesService, useValue: invoicesMock },
      ],
    }).compile();

    customersService = module.get<CustomersService>(CustomersService);
    ordersService = module.get<SalesOrdersService>(SalesOrdersService);
    deliveryService = module.get<DeliveryOrdersService>(DeliveryOrdersService);
    reportsService = module.get<SalesFulfillmentReportsService>(
      SalesFulfillmentReportsService,
    );
  });

  it('1. Tenant A cannot find or read Tenant B customer', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null);
    await expect(customersService.findOne(tenantA, customerB)).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: tenantA }),
      }),
    );
  });

  it('2. Tenant A cannot find or read Tenant B sales order', async () => {
    prismaMock.salesOrder.findFirst.mockResolvedValue(null);
    await expect(ordersService.findOne(tenantA, orderB)).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.salesOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: tenantA }),
      }),
    );
  });

  it('3. Tenant A cannot update Tenant B sales order', async () => {
    prismaMock.salesOrder.findFirst.mockResolvedValue(null);
    await expect(
      ordersService.update(tenantA, orderB, { notes: 'Hack' }, userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('4. Tenant A cannot submit Tenant B sales order', async () => {
    prismaMock.salesOrder.findFirst.mockResolvedValue(null);
    await expect(ordersService.submit(tenantA, orderB, userA)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('5. Tenant A cannot approve Tenant B sales order', async () => {
    prismaMock.salesOrder.findFirst.mockResolvedValue(null);
    await expect(ordersService.approve(tenantA, orderB, userA)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('6. Tenant A cannot allocate Tenant B sales order inventory', async () => {
    prismaMock.salesOrder.findFirst.mockResolvedValue(null);
    await expect(
      ordersService.allocate(tenantA, orderB, userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('7. Tenant A cannot find or read Tenant B delivery order', async () => {
    prismaMock.deliveryOrder.findFirst.mockResolvedValue(null);
    await expect(deliveryService.findOne(tenantA, deliveryB)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('8. Tenant A cannot execute Tenant B delivery order', async () => {
    prismaMock.deliveryOrder.findFirst.mockResolvedValue(null);
    await expect(
      deliveryService.executeDelivery(tenantA, deliveryB, userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('9. Tenant A cannot create sales order using Tenant B customer', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null); // Not found in Tenant A
    await expect(
      ordersService.create(
        tenantA,
        {
          customerId: customerB,
          currencyId: 'curr-1',
          locationId: 'loc-1',
          lines: [{ itemId: itemB, quantity: 1, unitPrice: 10 }],
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('10. Tenant A fulfillment reports only query Tenant A records', async () => {
    prismaMock.salesOrder.findMany.mockResolvedValue([]);
    await reportsService.getSalesOrderSummary(tenantA, {});
    expect(prismaMock.salesOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: tenantA }),
      }),
    );
  });
});
