import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { ApAccountMappingService } from '../../ap/account-mapping/ap-account-mapping.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BadRequestException } from '@nestjs/common';
import {
  PaymentType,
  PaymentStatus,
  FiscalPeriodStatus,
  CustomerInvoiceStatus,
  Prisma,
} from '@prisma/client';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let accountMappingMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockPaymentAccountId = '22222222-2222-2222-2222-222222222222';
  const mockCurrencyId = '33333333-3333-3333-3333-333333333333';
  const mockCustomerId = '44444444-4444-4444-4444-444444444444';
  const mockSupplierId = '55555555-5555-5555-5555-555555555555';
  const mockPaymentId = '66666666-6666-6666-6666-666666666666';
  const mockUserId = '77777777-7777-7777-7777-777777777777';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
      paymentAccount: { findFirst: jest.fn() },
      currency: { findFirst: jest.fn() },
      customer: { findFirst: jest.fn() },
      supplier: { findFirst: jest.fn() },
      customerInvoice: {
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      supplierInvoice: {
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      paymentAllocation: {
        create: jest.fn(),
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
      nextNumber: jest.fn().mockImplementation((_, key) => {
        if (key === 'CUSTOMER_RECEIPT') {
          return Promise.resolve({ formatted: 'RC-000001' });
        }
        if (key === 'SUPPLIER_PAYMENT') {
          return Promise.resolve({ formatted: 'PY-000001' });
        }
        return Promise.resolve({ formatted: 'JE-000001' });
      }),
    };

    accountMappingMock = {
      resolveAccount: jest.fn().mockImplementation((_, key) => {
        if (key === 'ACCOUNTS_RECEIVABLE') return Promise.resolve('acc-ar');
        if (key === 'ACCOUNTS_PAYABLE') return Promise.resolve('acc-ap');
        return Promise.resolve('acc-def');
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        { provide: ApAccountMappingService, useValue: accountMappingMock },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('1. should create draft customer receipt and allocate payment number with RC- prefix', async () => {
    prismaMock.paymentAccount.findFirst.mockResolvedValue({
      id: mockPaymentAccountId,
      currencyId: mockCurrencyId,
      isActive: true,
    });
    prismaMock.currency.findFirst.mockResolvedValue({
      id: mockCurrencyId,
      isActive: true,
    });
    prismaMock.customer.findFirst.mockResolvedValue({ id: mockCustomerId });

    prismaMock.payment.create.mockResolvedValue({
      id: mockPaymentId,
      paymentNumber: 'RC-000001',
      type: PaymentType.RECEIPT,
      status: PaymentStatus.DRAFT,
      amount: new Prisma.Decimal('1000.0000'),
      allocatedAmount: new Prisma.Decimal('0.0000'),
      unallocatedAmount: new Prisma.Decimal('1000.0000'),
    });

    const result = await service.create(
      mockOrgId,
      {
        type: PaymentType.RECEIPT,
        paymentAccountId: mockPaymentAccountId,
        customerId: mockCustomerId,
        paymentDate: '2026-08-01',
        amount: 1000,
      },
      mockUserId,
    );

    expect(result.paymentNumber).toBe('RC-000001');
    expect(result.type).toBe(PaymentType.RECEIPT);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'CUSTOMER_RECEIPT_CREATED' }),
    );
  });

  it('2. should create draft supplier payment and allocate payment number with PY- prefix', async () => {
    prismaMock.paymentAccount.findFirst.mockResolvedValue({
      id: mockPaymentAccountId,
      currencyId: mockCurrencyId,
      isActive: true,
    });
    prismaMock.currency.findFirst.mockResolvedValue({
      id: mockCurrencyId,
      isActive: true,
    });
    prismaMock.supplier.findFirst.mockResolvedValue({ id: mockSupplierId });

    prismaMock.payment.create.mockResolvedValue({
      id: mockPaymentId,
      paymentNumber: 'PY-000001',
      type: PaymentType.PAYMENT,
      status: PaymentStatus.DRAFT,
      amount: new Prisma.Decimal('500.0000'),
      allocatedAmount: new Prisma.Decimal('0.0000'),
      unallocatedAmount: new Prisma.Decimal('500.0000'),
    });

    const result = await service.create(
      mockOrgId,
      {
        type: PaymentType.PAYMENT,
        paymentAccountId: mockPaymentAccountId,
        supplierId: mockSupplierId,
        paymentDate: '2026-08-01',
        amount: 500,
      },
      mockUserId,
    );

    expect(result.paymentNumber).toBe('PY-000001');
    expect(result.type).toBe(PaymentType.PAYMENT);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'SUPPLIER_PAYMENT_CREATED' }),
    );
  });

  it('3. should post customer receipt generating balanced GL journal (Debit Bank, Credit AR)', async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      id: mockPaymentId,
      paymentNumber: 'RC-000001',
      type: PaymentType.RECEIPT,
      status: PaymentStatus.DRAFT,
      amount: new Prisma.Decimal('1000.0000'),
      paymentDate: new Date('2026-08-01'),
      paymentAccount: { accountingAccountId: 'acc-bank' },
      customer: { name: 'Acme Client' },
    });

    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      status: FiscalPeriodStatus.OPEN,
    });

    prismaMock.journalEntry.create.mockResolvedValue({
      id: 'je-1',
      entryNumber: 'JE-000001',
    });

    prismaMock.payment.update.mockResolvedValue({
      id: mockPaymentId,
      paymentNumber: 'RC-000001',
      status: PaymentStatus.POSTED,
      amount: new Prisma.Decimal('1000.0000'),
    });

    const result = await service.post(mockOrgId, mockPaymentId, mockUserId);
    expect(result.status).toBe(PaymentStatus.POSTED);

    // Verify GL journal lines generated: Debit Bank, Credit AR
    expect(prismaMock.journalLine.createMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: mockOrgId,
          accountId: 'acc-bank',
          description: 'RC-000001 - Funds Received',
          debit: new Prisma.Decimal('1000.0000'),
          credit: new Prisma.Decimal(0),
          lineNumber: 1,
          journalEntryId: 'je-1',
        },
        {
          organizationId: mockOrgId,
          accountId: 'acc-ar',
          description: 'RC-000001 - AR Settlement',
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal('1000.0000'),
          lineNumber: 2,
          journalEntryId: 'je-1',
        },
      ],
    });
  });

  it('4. should post supplier payment generating balanced GL journal (Debit AP, Credit Bank)', async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      id: mockPaymentId,
      paymentNumber: 'PY-000001',
      type: PaymentType.PAYMENT,
      status: PaymentStatus.DRAFT,
      amount: new Prisma.Decimal('500.0000'),
      paymentDate: new Date('2026-08-01'),
      paymentAccount: { accountingAccountId: 'acc-bank' },
      supplier: { name: 'Acme Supplies' },
    });

    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      status: FiscalPeriodStatus.OPEN,
    });

    prismaMock.journalEntry.create.mockResolvedValue({
      id: 'je-2',
      entryNumber: 'JE-000002',
    });

    prismaMock.payment.update.mockResolvedValue({
      id: mockPaymentId,
      paymentNumber: 'PY-000001',
      status: PaymentStatus.POSTED,
      amount: new Prisma.Decimal('500.0000'),
    });

    const result = await service.post(mockOrgId, mockPaymentId, mockUserId);
    expect(result.status).toBe(PaymentStatus.POSTED);

    // Verify GL lines: Debit AP, Credit Bank
    expect(prismaMock.journalLine.createMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: mockOrgId,
          accountId: 'acc-ap',
          description: 'PY-000001 - AP Settlement',
          debit: new Prisma.Decimal('500.0000'),
          credit: new Prisma.Decimal(0),
          lineNumber: 1,
          journalEntryId: 'je-2',
        },
        {
          organizationId: mockOrgId,
          accountId: 'acc-bank',
          description: 'PY-000001 - Funds Disbursed',
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal('500.0000'),
          lineNumber: 2,
          journalEntryId: 'je-2',
        },
      ],
    });
  });

  it('5. should partially allocate posted receipt across customer invoices and update invoice amountPaid/amountDue', async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      id: mockPaymentId,
      type: PaymentType.RECEIPT,
      status: PaymentStatus.POSTED,
      amount: new Prisma.Decimal('1000.0000'),
      allocatedAmount: new Prisma.Decimal('0.0000'),
      unallocatedAmount: new Prisma.Decimal('1000.0000'),
      currencyId: mockCurrencyId,
      customerId: mockCustomerId,
    });

    prismaMock.customerInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      organizationId: mockOrgId,
      customerId: mockCustomerId,
      currencyId: mockCurrencyId,
      status: CustomerInvoiceStatus.ISSUED,
      grandTotal: new Prisma.Decimal('600.0000'),
      amountPaid: new Prisma.Decimal('0.0000'),
      amountDue: new Prisma.Decimal('600.0000'),
    });

    prismaMock.payment.update.mockResolvedValue({
      id: mockPaymentId,
      status: PaymentStatus.PARTIALLY_ALLOCATED,
      allocatedAmount: new Prisma.Decimal('400.0000'),
      unallocatedAmount: new Prisma.Decimal('600.0000'),
    });

    const result = await service.allocate(
      mockOrgId,
      mockPaymentId,
      {
        allocations: [{ customerInvoiceId: 'inv-1', amount: 400 }],
      },
      mockUserId,
    );

    expect(result.status).toBe(PaymentStatus.PARTIALLY_ALLOCATED);

    // Verify invoice was updated to PARTIALLY_PAID
    expect(prismaMock.customerInvoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: {
        amountPaid: new Prisma.Decimal('400.0000'),
        amountDue: new Prisma.Decimal('200.0000'),
        status: CustomerInvoiceStatus.PARTIALLY_PAID,
      },
    });
  });

  it('6. should fully allocate payment when sum of allocations equals payment amount', async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      id: mockPaymentId,
      type: PaymentType.RECEIPT,
      status: PaymentStatus.POSTED,
      amount: new Prisma.Decimal('1000.0000'),
      allocatedAmount: new Prisma.Decimal('0.0000'),
      unallocatedAmount: new Prisma.Decimal('1000.0000'),
      currencyId: mockCurrencyId,
      customerId: mockCustomerId,
    });

    prismaMock.customerInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      organizationId: mockOrgId,
      customerId: mockCustomerId,
      currencyId: mockCurrencyId,
      status: CustomerInvoiceStatus.ISSUED,
      grandTotal: new Prisma.Decimal('1000.0000'),
      amountPaid: new Prisma.Decimal('0.0000'),
      amountDue: new Prisma.Decimal('1000.0000'),
    });

    prismaMock.payment.update.mockResolvedValue({
      id: mockPaymentId,
      status: PaymentStatus.ALLOCATED,
      allocatedAmount: new Prisma.Decimal('1000.0000'),
      unallocatedAmount: new Prisma.Decimal('0.0000'),
    });

    const result = await service.allocate(
      mockOrgId,
      mockPaymentId,
      {
        allocations: [{ customerInvoiceId: 'inv-1', amount: 1000 }],
      },
      mockUserId,
    );

    expect(result.status).toBe(PaymentStatus.ALLOCATED);

    // Verify invoice was updated to PAID
    expect(prismaMock.customerInvoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: {
        amountPaid: new Prisma.Decimal('1000.0000'),
        amountDue: new Prisma.Decimal('0.0000'),
        status: CustomerInvoiceStatus.PAID,
      },
    });
  });

  it('7. should reject allocation exceeding payment unallocated balance', async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      id: mockPaymentId,
      type: PaymentType.RECEIPT,
      status: PaymentStatus.POSTED,
      amount: new Prisma.Decimal('500.0000'),
      allocatedAmount: new Prisma.Decimal('0.0000'),
      unallocatedAmount: new Prisma.Decimal('500.0000'),
    });

    await expect(
      service.allocate(
        mockOrgId,
        mockPaymentId,
        {
          allocations: [{ customerInvoiceId: 'inv-1', amount: 600 }],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('8. should void posted payment with compensating GL reversal and rollback invoice balances', async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      id: mockPaymentId,
      paymentNumber: 'RC-000001',
      status: PaymentStatus.ALLOCATED,
      journalEntryId: 'je-1',
      allocations: [
        {
          id: 'alloc-1',
          customerInvoiceId: 'inv-1',
          supplierInvoiceId: null,
          amount: new Prisma.Decimal('1000.0000'),
        },
      ],
    });

    prismaMock.customerInvoice.findUniqueOrThrow.mockResolvedValue({
      id: 'inv-1',
      grandTotal: new Prisma.Decimal('1000.0000'),
      amountPaid: new Prisma.Decimal('1000.0000'),
      amountDue: new Prisma.Decimal('0.0000'),
      status: CustomerInvoiceStatus.PAID,
    });

    prismaMock.journalEntry.findFirst.mockResolvedValue({
      id: 'je-1',
      entryNumber: 'JE-000001',
      fiscalPeriodId: 'period-1',
      lines: [
        {
          accountId: 'acc-bank',
          debit: new Prisma.Decimal('1000'),
          credit: new Prisma.Decimal(0),
          lineNumber: 1,
        },
        {
          accountId: 'acc-ar',
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal('1000'),
          lineNumber: 2,
        },
      ],
    });

    prismaMock.journalEntry.create.mockResolvedValue({ id: 'je-rev' });

    prismaMock.payment.update.mockResolvedValue({
      id: mockPaymentId,
      paymentNumber: 'RC-000001',
      status: PaymentStatus.VOIDED,
    });

    const result = await service.void(mockOrgId, mockPaymentId, mockUserId);
    expect(result.status).toBe(PaymentStatus.VOIDED);

    // Verify invoice rollback
    expect(prismaMock.customerInvoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: {
        amountPaid: new Prisma.Decimal('0.0000'),
        amountDue: new Prisma.Decimal('1000.0000'),
        status: CustomerInvoiceStatus.ISSUED,
      },
    });

    // Verify allocations deleted
    expect(prismaMock.paymentAllocation.deleteMany).toHaveBeenCalledWith({
      where: { paymentId: mockPaymentId },
    });
  });
});
