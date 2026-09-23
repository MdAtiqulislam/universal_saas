import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './transactions/payments.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import {
  PaymentType,
  PaymentStatus,
  PaymentAccountType,
  FiscalPeriodStatus,
  CustomerInvoiceStatus,
  SupplierInvoiceStatus,
  Prisma,
} from '@prisma/client';

describe('Payment & Settlement Integrity End-to-End Flows', () => {
  let paymentsService: PaymentsService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockBankAccountId = '22222222-2222-2222-2222-222222222222';
  const mockCurrencyId = '33333333-3333-3333-3333-333333333333';
  const mockCustomerId = '44444444-4444-4444-4444-444444444444';
  const mockSupplierId = '55555555-5555-5555-5555-555555555555';
  const mockInvoiceId = '66666666-6666-6666-6666-666666666666';
  const mockUserId = '77777777-7777-7777-7777-777777777777';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
      account: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'gl-acc-bank',
          code: '1020',
          name: 'Corporate Bank Account',
          isActive: true,
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
      customer: {
        findFirst: jest.fn().mockResolvedValue({
          id: mockCustomerId,
          name: 'Global Tech Inc',
          isActive: true,
        }),
      },
      supplier: {
        findFirst: jest.fn().mockResolvedValue({
          id: mockSupplierId,
          name: 'Industrial Raw Supplies',
          isActive: true,
        }),
      },
      paymentAccount: {
        findFirst: jest.fn().mockResolvedValue({
          id: mockBankAccountId,
          code: 'BANK-CORP',
          name: 'Corporate Bank Account',
          type: PaymentAccountType.BANK,
          currencyId: mockCurrencyId,
          accountingAccountId: 'gl-acc-bank',
          isActive: true,
        }),
        create: jest.fn(),
      },
      customerInvoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: mockInvoiceId,
          organizationId: mockOrgId,
          customerId: mockCustomerId,
          invoiceNumber: 'CI-000001',
          currencyId: mockCurrencyId,
          status: CustomerInvoiceStatus.ISSUED,
          grandTotal: new Prisma.Decimal('1000.0000'),
          amountPaid: new Prisma.Decimal('0.0000'),
          amountDue: new Prisma.Decimal('1000.0000'),
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: mockInvoiceId,
          grandTotal: new Prisma.Decimal('1000.0000'),
          amountPaid: new Prisma.Decimal('1000.0000'),
          amountDue: new Prisma.Decimal('0.0000'),
          status: CustomerInvoiceStatus.PAID,
        }),
        update: jest.fn(),
      },
      supplierInvoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: mockInvoiceId,
          organizationId: mockOrgId,
          supplierId: mockSupplierId,
          invoiceNumber: 'SI-000001',
          currencyId: mockCurrencyId,
          status: SupplierInvoiceStatus.POSTED,
          grandTotal: new Prisma.Decimal('500.0000'),
          amountPaid: new Prisma.Decimal('0.0000'),
          amountDue: new Prisma.Decimal('500.0000'),
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: mockInvoiceId,
          grandTotal: new Prisma.Decimal('500.0000'),
          amountPaid: new Prisma.Decimal('500.0000'),
          amountDue: new Prisma.Decimal('0.0000'),
          status: SupplierInvoiceStatus.PAID,
        }),
        update: jest.fn(),
      },
      payment: {
        create: jest.fn().mockResolvedValue({
          id: 'pay-1',
          paymentNumber: 'RC-000001',
          type: PaymentType.RECEIPT,
          status: PaymentStatus.DRAFT,
          amount: new Prisma.Decimal('1000.0000'),
          allocatedAmount: new Prisma.Decimal('0.0000'),
          unallocatedAmount: new Prisma.Decimal('1000.0000'),
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'pay-1',
          paymentNumber: 'RC-000001',
          type: PaymentType.RECEIPT,
          status: PaymentStatus.DRAFT,
          paymentAccountId: mockBankAccountId,
          currencyId: mockCurrencyId,
          customerId: mockCustomerId,
          paymentDate: new Date('2026-08-01'),
          amount: new Prisma.Decimal('1000.0000'),
          allocatedAmount: new Prisma.Decimal('0.0000'),
          unallocatedAmount: new Prisma.Decimal('1000.0000'),
          paymentAccount: { accountingAccountId: 'gl-acc-bank' },
          currency: { code: 'USD' },
          customer: { name: 'Global Tech Inc' },
          allocations: [],
        }),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'pay-1',
            paymentNumber: 'RC-000001',
            type: PaymentType.RECEIPT,
            status: data.status ?? PaymentStatus.POSTED,
            amount: new Prisma.Decimal('1000.0000'),
            allocatedAmount:
              data.allocatedAmount ?? new Prisma.Decimal('1000.0000'),
            unallocatedAmount:
              data.unallocatedAmount ?? new Prisma.Decimal('0.0000'),
            paymentAccount: { accountingAccountId: 'gl-acc-bank' },
            currency: { code: 'USD' },
            customer: { name: 'Global Tech Inc' },
            allocations: [],
          }),
        ),
      },
      paymentAllocation: {
        create: jest.fn().mockResolvedValue({ id: 'alloc-1' }),
        deleteMany: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'period-1',
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
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };

    eventBusMock = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingMock = {
      nextNumber: jest.fn().mockImplementation((_, key) => {
        if (key === 'CUSTOMER_RECEIPT')
          return Promise.resolve({ formatted: 'RC-000001' });
        if (key === 'SUPPLIER_PAYMENT')
          return Promise.resolve({ formatted: 'PY-000001' });
        return Promise.resolve({ formatted: 'JE-000001' });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        {
          provide: ApAccountMappingService,
          useValue: {
            resolveAccount: jest.fn().mockImplementation((_, key) => {
              if (key === 'ACCOUNTS_RECEIVABLE')
                return Promise.resolve('gl-acc-ar');
              if (key === 'ACCOUNTS_PAYABLE')
                return Promise.resolve('gl-acc-ap');
              return Promise.resolve('gl-acc-def');
            }),
          },
        },
      ],
    }).compile();

    paymentsService = module.get<PaymentsService>(PaymentsService);
  });

  it('1. Complete Customer Order-to-Cash Settlement: Receipt -> Post -> GL Journal -> Allocate -> Invoice PAID', async () => {
    // 1. Create Receipt
    const receipt = await paymentsService.create(
      mockOrgId,
      {
        type: PaymentType.RECEIPT,
        paymentAccountId: mockBankAccountId,
        customerId: mockCustomerId,
        paymentDate: '2026-08-01',
        amount: 1000,
      },
      mockUserId,
    );
    expect(receipt.paymentNumber).toBe('RC-000001');

    // 2. Post Receipt to General Ledger (Debit Bank, Credit AR)
    const posted = await paymentsService.post(mockOrgId, 'pay-1', mockUserId);
    expect(posted.status).toBe(PaymentStatus.POSTED);

    // 3. Allocate Receipt against Customer Invoice
    prismaMock.payment.findFirst.mockResolvedValue({
      id: 'pay-1',
      paymentNumber: 'RC-000001',
      type: PaymentType.RECEIPT,
      status: PaymentStatus.POSTED,
      amount: new Prisma.Decimal('1000.0000'),
      allocatedAmount: new Prisma.Decimal('0.0000'),
      unallocatedAmount: new Prisma.Decimal('1000.0000'),
      currencyId: mockCurrencyId,
      customerId: mockCustomerId,
      paymentAccount: { accountingAccountId: 'gl-acc-bank' },
    });

    const allocated = await paymentsService.allocate(
      mockOrgId,
      'pay-1',
      {
        allocations: [{ customerInvoiceId: mockInvoiceId, amount: 1000 }],
      },
      mockUserId,
    );

    expect(allocated.status).toBe(PaymentStatus.ALLOCATED);
    expect(prismaMock.customerInvoice.update).toHaveBeenCalledWith({
      where: { id: mockInvoiceId },
      data: {
        amountPaid: new Prisma.Decimal('1000.0000'),
        amountDue: new Prisma.Decimal('0.0000'),
        status: CustomerInvoiceStatus.PAID,
      },
    });
  });
});
