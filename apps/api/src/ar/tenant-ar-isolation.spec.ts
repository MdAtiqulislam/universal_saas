import { Test, TestingModule } from '@nestjs/testing';
import { CustomerInvoicesService } from './invoices/customer-invoices.service';
import { ReceivablesService } from './receivables/receivables.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { NotFoundException } from '@nestjs/common';

describe('Tenant Accounts Receivable Isolation', () => {
  let invoiceService: CustomerInvoicesService;
  let receivablesService: ReceivablesService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let mappingMock: any;

  const orgA = '11111111-1111-1111-1111-111111111111';
  const userA = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
      customer: { findFirst: jest.fn() },
      currency: { findFirst: jest.fn() },
      item: { findFirst: jest.fn() },
      itemVariant: { findFirst: jest.fn() },
      salesOrder: { findFirst: jest.fn() },
      deliveryOrder: { findFirst: jest.fn() },
      customerInvoice: {
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      customerInvoiceLine: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      fiscalPeriod: { findFirst: jest.fn() },
      journalEntry: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      journalLine: { createMany: jest.fn() },
    };

    eventBusMock = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'CI-000001' }),
    };
    mappingMock = { resolveAccount: jest.fn().mockResolvedValue('acc-id') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerInvoicesService,
        ReceivablesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        { provide: ApAccountMappingService, useValue: mappingMock },
      ],
    }).compile();

    invoiceService = module.get<CustomerInvoicesService>(
      CustomerInvoicesService,
    );
    receivablesService = module.get<ReceivablesService>(ReceivablesService);
  });

  it('1. Org A cannot find Org B customer invoice by ID', async () => {
    prismaMock.customerInvoice.findFirst.mockResolvedValue(null);

    await expect(invoiceService.findOne(orgA, 'inv-org-b')).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.customerInvoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-org-b', organizationId: orgA },
      }),
    );
  });

  it('2. Org A cannot update Org B customer invoice', async () => {
    prismaMock.customerInvoice.findFirst.mockResolvedValue(null);

    await expect(
      invoiceService.update(orgA, 'inv-org-b', { notes: 'hacked' }, userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('3. Org A cannot delete Org B customer invoice', async () => {
    prismaMock.customerInvoice.findFirst.mockResolvedValue(null);

    await expect(invoiceService.remove(orgA, 'inv-org-b')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('4. Org A cannot issue Org B customer invoice', async () => {
    prismaMock.customerInvoice.findFirst.mockResolvedValue(null);

    await expect(
      invoiceService.issue(orgA, 'inv-org-b', userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('5. Org A cannot void Org B customer invoice', async () => {
    prismaMock.customerInvoice.findFirst.mockResolvedValue(null);

    await expect(invoiceService.void(orgA, 'inv-org-b', userA)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('6. Org A cannot cancel Org B customer invoice', async () => {
    prismaMock.customerInvoice.findFirst.mockResolvedValue(null);

    await expect(
      invoiceService.cancel(orgA, 'inv-org-b', userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('7. Org A cannot create customer invoice referencing Org B customer', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null);

    await expect(
      invoiceService.create(
        orgA,
        {
          customerId: 'cust-org-b',
          invoiceDate: '2026-08-01',
          lines: [{ itemId: 'item-1', quantity: 1, unitPrice: 100 }],
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(prismaMock.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cust-org-b', organizationId: orgA, deletedAt: null },
      }),
    );
  });

  it('8. Org A cannot create invoice from Org B sales order', async () => {
    prismaMock.salesOrder.findFirst.mockResolvedValue(null);

    await expect(
      invoiceService.createFromSalesOrder(orgA, 'so-org-b', userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('9. Org A cannot get AR balance for Org B customer', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null);

    await expect(
      receivablesService.getCustomerBalance(orgA, 'cust-org-b'),
    ).rejects.toThrow(NotFoundException);
  });

  it("10. Org A's aging report queries with organizationId = orgA", async () => {
    prismaMock.customerInvoice.findMany.mockResolvedValue([]);

    await receivablesService.getAgingReport(orgA);

    expect(prismaMock.customerInvoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: orgA,
        }),
      }),
    );
  });
});
