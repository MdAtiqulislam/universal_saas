import { Test, TestingModule } from '@nestjs/testing';
import { CustomerInvoicesService } from './invoices/customer-invoices.service';
import { ReceivablesService } from './receivables/receivables.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import {
  CustomerInvoiceStatus,
  FiscalPeriodStatus,
  SalesOrderStatus,
  DeliveryOrderStatus,
  Prisma,
} from '@prisma/client';

describe('Accounts Receivable Integrity & Order-to-Cash Integration Flow', () => {
  let invoiceService: CustomerInvoicesService;
  let receivablesService: ReceivablesService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockCustomerId = '22222222-2222-2222-2222-222222222222';
  const mockCurrencyId = '33333333-3333-3333-3333-333333333333';
  const mockItemId = '44444444-4444-4444-4444-444444444444';
  const mockInvoiceId = '55555555-5555-5555-5555-555555555555';
  const mockUserId = '66666666-6666-6666-6666-666666666666';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
      customer: {
        findFirst: jest.fn().mockResolvedValue({
          id: mockCustomerId,
          code: 'CUST-001',
          name: 'Global Enterprise',
          currencyId: mockCurrencyId,
          paymentTermsDays: 30,
          isActive: true,
          currency: { code: 'USD', symbol: '$' },
        }),
      },
      currency: {
        findFirst: jest.fn().mockResolvedValue({
          id: mockCurrencyId,
          code: 'USD',
          symbol: '$',
          isActive: true,
        }),
      },
      item: {
        findFirst: jest.fn().mockResolvedValue({
          id: mockItemId,
          sku: 'ITEM-100',
          name: 'Industrial Machine',
        }),
      },
      itemVariant: { findFirst: jest.fn().mockResolvedValue(null) },
      salesOrder: {
        findFirst: jest.fn().mockResolvedValue({
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
              unitPrice: new Prisma.Decimal('500.0000'),
              discountAmount: new Prisma.Decimal('0.0000'),
              taxRate: new Prisma.Decimal('10.0000'),
            },
          ],
        }),
      },
      deliveryOrder: {
        findFirst: jest.fn().mockResolvedValue({
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
              quantity: new Prisma.Decimal('10.0000'),
              salesOrderLine: {
                id: 'so-line-1',
                unitPrice: new Prisma.Decimal('500.0000'),
                discountAmount: new Prisma.Decimal('0.0000'),
                taxRate: new Prisma.Decimal('10.0000'),
              },
            },
          ],
        }),
      },
      customerInvoice: {
        create: jest.fn().mockResolvedValue({ id: mockInvoiceId }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: mockInvoiceId,
          invoiceNumber: 'CI-000001',
          invoiceDate: new Date('2026-08-01'),
          dueDate: new Date('2026-08-31'),
          status: CustomerInvoiceStatus.DRAFT,
          subtotal: new Prisma.Decimal('5000.0000'),
          discountAmount: new Prisma.Decimal('0.0000'),
          taxAmount: new Prisma.Decimal('500.0000'),
          grandTotal: new Prisma.Decimal('5500.0000'),
          amountPaid: new Prisma.Decimal('0.0000'),
          amountDue: new Prisma.Decimal('5500.0000'),
          customer: { id: mockCustomerId, name: 'Global Enterprise' },
          lines: [],
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: mockInvoiceId,
          organizationId: mockOrgId,
          invoiceNumber: 'CI-000001',
          invoiceDate: new Date('2026-08-01'),
          dueDate: new Date('2026-08-31'),
          status: CustomerInvoiceStatus.DRAFT,
          subtotal: new Prisma.Decimal('5000.0000'),
          discountAmount: new Prisma.Decimal('0.0000'),
          taxAmount: new Prisma.Decimal('500.0000'),
          grandTotal: new Prisma.Decimal('5500.0000'),
          amountPaid: new Prisma.Decimal('0.0000'),
          amountDue: new Prisma.Decimal('5500.0000'),
          customer: { id: mockCustomerId, name: 'Global Enterprise' },
          lines: [],
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({
          id: mockInvoiceId,
          invoiceNumber: 'CI-000001',
          status: CustomerInvoiceStatus.ISSUED,
          grandTotal: new Prisma.Decimal('5500.0000'),
          lines: [],
        }),
      },
      customerInvoiceLine: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      fiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'period-1',
          name: 'FY2026-Q3',
          status: FiscalPeriodStatus.OPEN,
        }),
      },
      journalEntry: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'je-1', entryNumber: 'JE-000001' }),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      journalLine: {
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerInvoicesService,
        ReceivablesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        {
          provide: ApAccountMappingService,
          useValue: {
            resolveAccount: jest.fn().mockImplementation((_, key) => {
              if (key === 'ACCOUNTS_RECEIVABLE')
                return Promise.resolve('acc-ar');
              if (key === 'SALES_REVENUE') return Promise.resolve('acc-rev');
              if (key === 'OUTPUT_TAX') return Promise.resolve('acc-tax');
              return Promise.resolve('acc-def');
            }),
          },
        },
      ],
    }).compile();

    invoiceService = module.get<CustomerInvoicesService>(
      CustomerInvoicesService,
    );
    receivablesService = module.get<ReceivablesService>(ReceivablesService);
  });

  it('1. Complete Order-to-Cash flow: DO -> Draft Invoice -> Issue -> GL Post -> Receivables Balance', async () => {
    // Step 1: Create draft customer invoice from Delivery Order
    const invoice = await invoiceService.createFromDeliveryOrder(
      mockOrgId,
      'do-1',
      mockUserId,
    );
    expect(invoice.invoiceNumber).toBe('CI-000001');
    expect(invoice.status).toBe(CustomerInvoiceStatus.DRAFT);

    // Step 2: Issue invoice (creates GL Journal Entry with Debit AR, Credit Revenue/Tax)
    const issued = await invoiceService.issue(
      mockOrgId,
      mockInvoiceId,
      mockUserId,
    );
    expect(issued.status).toBe(CustomerInvoiceStatus.ISSUED);

    // Step 3: Check Receivables Balance
    prismaMock.customerInvoice.findMany.mockResolvedValue([
      {
        id: mockInvoiceId,
        customerId: mockCustomerId,
        status: CustomerInvoiceStatus.ISSUED,
        grandTotal: new Prisma.Decimal('5500.0000'),
        amountPaid: new Prisma.Decimal('0.0000'),
        amountDue: new Prisma.Decimal('5500.0000'),
        dueDate: new Date('2026-08-31'),
      },
    ]);

    const balance = await receivablesService.getCustomerBalance(
      mockOrgId,
      mockCustomerId,
    );
    expect(balance.totalInvoiced).toBe(5500);
    expect(balance.totalPaid).toBe(0);
    expect(balance.totalDue).toBe(5500);
    expect(balance.openInvoiceCount).toBe(1);
  });
});
