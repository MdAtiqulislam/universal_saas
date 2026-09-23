import { Test, TestingModule } from '@nestjs/testing';
import { CustomerInvoicesService } from './customer-invoices.service';
import { ApAccountMappingService } from '../../ap/account-mapping/ap-account-mapping.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BadRequestException } from '@nestjs/common';
import {
  CustomerInvoiceStatus,
  FiscalPeriodStatus,
  JournalEntryStatus,
  SalesOrderStatus,
  DeliveryOrderStatus,
  Prisma,
} from '@prisma/client';

describe('CustomerInvoicesService', () => {
  let service: CustomerInvoicesService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let accountMappingMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockCustomerId = '22222222-2222-2222-2222-222222222222';
  const mockCurrencyId = '33333333-3333-3333-3333-333333333333';
  const mockItemId = '44444444-4444-4444-4444-444444444444';
  const mockInvoiceId = '55555555-5555-5555-5555-555555555555';
  const mockUserId = '66666666-6666-6666-6666-666666666666';

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
        count: jest.fn(),
      },
      journalLine: {
        createMany: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({
        sequenceKey: 'CUSTOMER_INVOICE',
        number: 1,
        formatted: 'CI-000001',
      }),
    };

    accountMappingMock = {
      resolveAccount: jest.fn().mockImplementation((_, key) => {
        if (key === 'ACCOUNTS_RECEIVABLE') return Promise.resolve('acc-ar');
        if (key === 'SALES_REVENUE') return Promise.resolve('acc-rev');
        if (key === 'OUTPUT_TAX') return Promise.resolve('acc-outtax');
        return Promise.resolve('acc-def');
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerInvoicesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        { provide: ApAccountMappingService, useValue: accountMappingMock },
      ],
    }).compile();

    service = module.get<CustomerInvoicesService>(CustomerInvoicesService);
  });

  it('1. should create a draft customer invoice with exact calculations and payment terms due date', async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      id: mockCustomerId,
      name: 'Acme Client',
      currencyId: mockCurrencyId,
      paymentTermsDays: 15,
      isActive: true,
    });

    prismaMock.currency.findFirst.mockResolvedValue({
      id: mockCurrencyId,
      code: 'USD',
      isActive: true,
    });

    prismaMock.item.findFirst.mockResolvedValue({
      id: mockItemId,
      sku: 'ITEM-1',
      name: 'Product 1',
    });

    prismaMock.customerInvoice.create.mockResolvedValue({
      id: mockInvoiceId,
    });

    prismaMock.customerInvoice.findUniqueOrThrow.mockResolvedValue({
      id: mockInvoiceId,
      invoiceNumber: 'CI-000001',
      status: CustomerInvoiceStatus.DRAFT,
      subtotal: new Prisma.Decimal('1000.0000'),
      discountAmount: new Prisma.Decimal('50.0000'),
      taxAmount: new Prisma.Decimal('95.0000'),
      grandTotal: new Prisma.Decimal('1045.0000'),
      amountPaid: new Prisma.Decimal('0.0000'),
      amountDue: new Prisma.Decimal('1045.0000'),
      lines: [],
    });

    const result = await service.create(
      mockOrgId,
      {
        customerId: mockCustomerId,
        invoiceDate: '2026-08-01',
        lines: [
          {
            itemId: mockItemId,
            quantity: 10,
            unitPrice: 100,
            discountAmount: 50,
            taxRate: 10, // 10% of 950 = 95
          },
        ],
      },
      mockUserId,
    );

    expect(result.invoiceNumber).toBe('CI-000001');
    expect(result.grandTotal.toString()).toBe('1045');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CUSTOMER_INVOICE_CREATED',
      }),
    );
  });

  it('2. should reject invoice creation when customer is inactive', async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      id: mockCustomerId,
      name: 'Acme Client',
      isActive: false,
    });

    await expect(
      service.create(
        mockOrgId,
        {
          customerId: mockCustomerId,
          invoiceDate: '2026-08-01',
          lines: [{ itemId: mockItemId, quantity: 1, unitPrice: 10 }],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should reject invoice creation when line quantity is <= 0', async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      id: mockCustomerId,
      isActive: true,
      currencyId: mockCurrencyId,
      paymentTermsDays: 15,
    });
    prismaMock.currency.findFirst.mockResolvedValue({
      id: mockCurrencyId,
      isActive: true,
    });

    await expect(
      service.create(
        mockOrgId,
        {
          customerId: mockCustomerId,
          invoiceDate: '2026-08-01',
          lines: [{ itemId: mockItemId, quantity: 0, unitPrice: 10 }],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('4. should create draft invoice from confirmed Sales Order', async () => {
    prismaMock.salesOrder.findFirst.mockResolvedValue({
      id: 'so-1',
      orderNumber: 'SO-000001',
      customerId: mockCustomerId,
      currencyId: mockCurrencyId,
      status: SalesOrderStatus.CONFIRMED,
      paymentTermsDays: 30,
      lines: [
        {
          id: 'so-line-1',
          itemId: mockItemId,
          quantity: new Prisma.Decimal('10.0000'),
          unitPrice: new Prisma.Decimal('100.0000'),
          discountAmount: new Prisma.Decimal('0.0000'),
          taxRate: new Prisma.Decimal('0.0000'),
        },
      ],
    });

    prismaMock.customerInvoice.findMany.mockResolvedValue([]);
    prismaMock.customer.findFirst.mockResolvedValue({
      id: mockCustomerId,
      isActive: true,
      currencyId: mockCurrencyId,
      paymentTermsDays: 30,
    });
    prismaMock.currency.findFirst.mockResolvedValue({
      id: mockCurrencyId,
      isActive: true,
    });
    prismaMock.item.findFirst.mockResolvedValue({ id: mockItemId });
    prismaMock.customerInvoice.create.mockResolvedValue({ id: mockInvoiceId });
    prismaMock.customerInvoice.findUniqueOrThrow.mockResolvedValue({
      id: mockInvoiceId,
      invoiceNumber: 'CI-000001',
      status: CustomerInvoiceStatus.DRAFT,
      grandTotal: new Prisma.Decimal('1000.0000'),
      lines: [],
    });

    const result = await service.createFromSalesOrder(
      mockOrgId,
      'so-1',
      mockUserId,
    );
    expect(result.invoiceNumber).toBe('CI-000001');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CUSTOMER_INVOICE_SOURCE_LINKED',
      }),
    );
  });

  it('5. should reject creating invoice from already fully invoiced Sales Order', async () => {
    prismaMock.salesOrder.findFirst.mockResolvedValue({
      id: 'so-1',
      orderNumber: 'SO-000001',
      customerId: mockCustomerId,
      currencyId: mockCurrencyId,
      status: SalesOrderStatus.CONFIRMED,
      paymentTermsDays: 30,
      lines: [
        {
          id: 'so-line-1',
          itemId: mockItemId,
          quantity: new Prisma.Decimal('10.0000'),
          unitPrice: new Prisma.Decimal('100.0000'),
          discountAmount: new Prisma.Decimal('0.0000'),
          taxRate: new Prisma.Decimal('0.0000'),
        },
      ],
    });

    // Previous invoice already billed all 10
    prismaMock.customerInvoice.findMany.mockResolvedValue([
      {
        lines: [
          {
            salesOrderLineId: 'so-line-1',
            quantity: new Prisma.Decimal('10.0000'),
          },
        ],
      },
    ]);

    await expect(
      service.createFromSalesOrder(mockOrgId, 'so-1', mockUserId),
    ).rejects.toThrow(BadRequestException);
  });

  it('6. should create draft invoice from delivered Delivery Order', async () => {
    prismaMock.deliveryOrder.findFirst.mockResolvedValue({
      id: 'do-1',
      deliveryNumber: 'DO-000001',
      salesOrderId: 'so-1',
      customerId: mockCustomerId,
      status: DeliveryOrderStatus.DELIVERED,
      salesOrder: {
        currencyId: mockCurrencyId,
        paymentTermsDays: 30,
        lines: [],
      },
      lines: [
        {
          id: 'do-line-1',
          itemId: mockItemId,
          quantity: new Prisma.Decimal('5.0000'),
          salesOrderLine: {
            id: 'so-line-1',
            unitPrice: new Prisma.Decimal('100.0000'),
            discountAmount: new Prisma.Decimal('0.0000'),
            taxRate: new Prisma.Decimal('0.0000'),
          },
        },
      ],
    });

    prismaMock.salesOrder.findFirst.mockResolvedValue({
      id: 'so-1',
      customerId: mockCustomerId,
    });
    prismaMock.customer.findFirst.mockResolvedValue({
      id: mockCustomerId,
      isActive: true,
      currencyId: mockCurrencyId,
      paymentTermsDays: 30,
    });
    prismaMock.currency.findFirst.mockResolvedValue({
      id: mockCurrencyId,
      isActive: true,
    });
    prismaMock.item.findFirst.mockResolvedValue({ id: mockItemId });
    prismaMock.customerInvoice.create.mockResolvedValue({ id: mockInvoiceId });
    prismaMock.customerInvoice.findUniqueOrThrow.mockResolvedValue({
      id: mockInvoiceId,
      invoiceNumber: 'CI-000001',
      status: CustomerInvoiceStatus.DRAFT,
      grandTotal: new Prisma.Decimal('500.0000'),
      lines: [],
    });

    const result = await service.createFromDeliveryOrder(
      mockOrgId,
      'do-1',
      mockUserId,
    );
    expect(result.invoiceNumber).toBe('CI-000001');
  });

  it('7. should issue draft invoice to customer and post balanced GL journal entry', async () => {
    prismaMock.customerInvoice.findFirst.mockResolvedValue({
      id: mockInvoiceId,
      organizationId: mockOrgId,
      invoiceNumber: 'CI-000001',
      invoiceDate: new Date('2026-08-01'),
      status: CustomerInvoiceStatus.DRAFT,
      subtotal: new Prisma.Decimal('1000.0000'),
      discountAmount: new Prisma.Decimal('50.0000'),
      taxAmount: new Prisma.Decimal('95.0000'),
      grandTotal: new Prisma.Decimal('1045.0000'),
      customer: { id: mockCustomerId, name: 'Acme Client' },
      lines: [],
    });

    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      name: 'FY2026-Q3',
      status: FiscalPeriodStatus.OPEN,
    });

    numberingMock.nextNumber.mockResolvedValue({
      sequenceKey: 'JOURNAL_ENTRY',
      number: 10,
      formatted: 'JE-000010',
    });

    prismaMock.journalEntry.create.mockResolvedValue({
      id: 'gl-entry-1',
      entryNumber: 'JE-000010',
    });

    prismaMock.customerInvoice.update.mockResolvedValue({
      id: mockInvoiceId,
      invoiceNumber: 'CI-000001',
      status: CustomerInvoiceStatus.ISSUED,
      grandTotal: new Prisma.Decimal('1045.0000'),
      lines: [],
    });

    const result = await service.issue(mockOrgId, mockInvoiceId, mockUserId);
    expect(result.status).toBe(CustomerInvoiceStatus.ISSUED);

    // Verify GL journal lines generated (Debit AR, Credit Rev, Credit Tax)
    expect(prismaMock.journalLine.createMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: mockOrgId,
          accountId: 'acc-ar',
          description: 'AR Invoice CI-000001 - Acme Client',
          debit: new Prisma.Decimal('1045.0000'),
          credit: new Prisma.Decimal(0),
          lineNumber: 1,
          journalEntryId: 'gl-entry-1',
        },
        {
          organizationId: mockOrgId,
          accountId: 'acc-rev',
          description: 'AR Invoice CI-000001 - Sales Revenue',
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal('950.0000'),
          lineNumber: 2,
          journalEntryId: 'gl-entry-1',
        },
        {
          organizationId: mockOrgId,
          accountId: 'acc-outtax',
          description: 'AR Invoice CI-000001 - Output Tax',
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal('95.0000'),
          lineNumber: 3,
          journalEntryId: 'gl-entry-1',
        },
      ],
    });
  });

  it('8. should void issued invoice and create compensating GL reversal', async () => {
    prismaMock.customerInvoice.findFirst.mockResolvedValue({
      id: mockInvoiceId,
      organizationId: mockOrgId,
      invoiceNumber: 'CI-000001',
      status: CustomerInvoiceStatus.ISSUED,
      amountPaid: new Prisma.Decimal('0.0000'),
      lines: [],
    });

    prismaMock.journalEntry.findFirst.mockResolvedValue({
      id: 'gl-entry-1',
      entryNumber: 'JE-000010',
      fiscalPeriodId: 'period-1',
      lines: [
        {
          id: 'line-1',
          accountId: 'acc-ar',
          debit: new Prisma.Decimal('1045'),
          credit: new Prisma.Decimal(0),
          lineNumber: 1,
          description: 'AR',
        },
        {
          id: 'line-2',
          accountId: 'acc-rev',
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal('950'),
          lineNumber: 2,
          description: 'Revenue',
        },
        {
          id: 'line-3',
          accountId: 'acc-outtax',
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal('95'),
          lineNumber: 3,
          description: 'Output Tax',
        },
      ],
    });

    numberingMock.nextNumber.mockResolvedValue({
      sequenceKey: 'JOURNAL_ENTRY',
      number: 11,
      formatted: 'JE-000011',
    });

    prismaMock.journalEntry.create.mockResolvedValue({
      id: 'gl-rev-1',
      entryNumber: 'JE-000011',
    });

    prismaMock.customerInvoice.update.mockResolvedValue({
      id: mockInvoiceId,
      invoiceNumber: 'CI-000001',
      status: CustomerInvoiceStatus.VOIDED,
      lines: [],
    });

    const result = await service.void(mockOrgId, mockInvoiceId, mockUserId);
    expect(result.status).toBe(CustomerInvoiceStatus.VOIDED);

    // Verify original journal marked VOIDED
    expect(prismaMock.journalEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'gl-entry-1' },
        data: { status: JournalEntryStatus.VOIDED },
      }),
    );

    // Verify reversal entry had inverted debits/credits
    expect(prismaMock.journalLine.createMany).toHaveBeenCalledWith({
      data: [
        {
          journalEntryId: 'gl-rev-1',
          organizationId: mockOrgId,
          accountId: 'acc-ar',
          description: 'Reversal: AR',
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal('1045'),
          lineNumber: 1,
        },
        {
          journalEntryId: 'gl-rev-1',
          organizationId: mockOrgId,
          accountId: 'acc-rev',
          description: 'Reversal: Revenue',
          debit: new Prisma.Decimal('950'),
          credit: new Prisma.Decimal(0),
          lineNumber: 2,
        },
        {
          journalEntryId: 'gl-rev-1',
          organizationId: mockOrgId,
          accountId: 'acc-outtax',
          description: 'Reversal: Output Tax',
          debit: new Prisma.Decimal('95'),
          credit: new Prisma.Decimal(0),
          lineNumber: 3,
        },
      ],
    });
  });

  it('9. should prevent voiding if customer payments have already been applied', async () => {
    prismaMock.customerInvoice.findFirst.mockResolvedValue({
      id: mockInvoiceId,
      organizationId: mockOrgId,
      invoiceNumber: 'CI-000001',
      status: CustomerInvoiceStatus.ISSUED,
      amountPaid: new Prisma.Decimal('500.0000'),
      lines: [],
    });

    await expect(
      service.void(mockOrgId, mockInvoiceId, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });
});
