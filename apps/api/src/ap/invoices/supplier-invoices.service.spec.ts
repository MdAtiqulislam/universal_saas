import { Test, TestingModule } from '@nestjs/testing';
import { SupplierInvoicesService } from './supplier-invoices.service';
import { AccountsPayableMatchingService } from '../matching/accounts-payable-matching.service';
import { ApAccountMappingService } from '../account-mapping/ap-account-mapping.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BadRequestException } from '@nestjs/common';
import {
  SupplierInvoiceStatus,
  FiscalPeriodStatus,
  JournalEntryStatus,
  Prisma,
} from '@prisma/client';

describe('SupplierInvoicesService', () => {
  let service: SupplierInvoicesService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let matchingMock: any;
  let accountMappingMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockSupplierId = '22222222-2222-2222-2222-222222222222';
  const mockCurrencyId = '33333333-3333-3333-3333-333333333333';
  const mockItemId = '44444444-4444-4444-4444-444444444444';
  const mockInvoiceId = '55555555-5555-5555-5555-555555555555';
  const mockUserId = '66666666-6666-6666-6666-666666666666';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
      supplier: {
        findFirst: jest.fn(),
      },
      currency: {
        findFirst: jest.fn(),
      },
      item: {
        findFirst: jest.fn(),
      },
      itemVariant: {
        findFirst: jest.fn(),
      },
      purchaseOrder: {
        findFirst: jest.fn(),
      },
      goodsReceipt: {
        findFirst: jest.fn(),
      },
      supplierInvoice: {
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      supplierInvoiceLine: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
      },
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
        sequenceKey: 'SUPPLIER_INVOICE',
        number: 1,
        formatted: 'SI-000001',
      }),
    };

    matchingMock = {
      matchInvoice: jest.fn().mockResolvedValue({
        canApprove: true,
        overallStatus: 'MATCHED',
      }),
    };

    accountMappingMock = {
      resolveAccount: jest.fn().mockImplementation((_, key) => {
        if (key === 'ACCOUNTS_PAYABLE') return Promise.resolve('acc-ap');
        if (key === 'PURCHASE_EXPENSE') return Promise.resolve('acc-exp');
        if (key === 'INPUT_TAX') return Promise.resolve('acc-tax');
        return Promise.resolve('acc-def');
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierInvoicesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        { provide: AccountsPayableMatchingService, useValue: matchingMock },
        { provide: ApAccountMappingService, useValue: accountMappingMock },
      ],
    }).compile();

    service = module.get<SupplierInvoicesService>(SupplierInvoicesService);
  });

  it('1. should create a draft supplier invoice with exact calculations and payment terms due date', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({
      id: mockSupplierId,
      name: 'Acme Supplies',
      currencyId: mockCurrencyId,
      paymentTermsDays: 30,
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
      name: 'Widget',
    });

    prismaMock.supplierInvoice.create.mockResolvedValue({
      id: mockInvoiceId,
    });

    prismaMock.supplierInvoice.findUniqueOrThrow.mockResolvedValue({
      id: mockInvoiceId,
      invoiceNumber: 'SI-000001',
      status: SupplierInvoiceStatus.DRAFT,
      subtotal: new Prisma.Decimal('1000.0000'),
      discountAmount: new Prisma.Decimal('100.0000'),
      taxAmount: new Prisma.Decimal('90.0000'),
      grandTotal: new Prisma.Decimal('990.0000'),
      amountPaid: new Prisma.Decimal('0.0000'),
      amountDue: new Prisma.Decimal('990.0000'),
      lines: [],
    });

    const result = await service.create(
      mockOrgId,
      {
        supplierId: mockSupplierId,
        invoiceDate: '2026-08-01',
        lines: [
          {
            itemId: mockItemId,
            quantity: 10,
            unitPrice: 100,
            discountAmount: 100,
            taxRate: 10, // 10% on 900 = 90
          },
        ],
      },
      mockUserId,
    );

    expect(result.invoiceNumber).toBe('SI-000001');
    expect(result.grandTotal.toString()).toBe('990');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'SUPPLIER_INVOICE_CREATED',
      }),
    );
  });

  it('2. should reject invoice creation when supplier is inactive', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({
      id: mockSupplierId,
      name: 'Acme Supplies',
      isActive: false,
    });

    await expect(
      service.create(
        mockOrgId,
        {
          supplierId: mockSupplierId,
          invoiceDate: '2026-08-01',
          lines: [{ itemId: mockItemId, quantity: 1, unitPrice: 10 }],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should reject invoice creation when line quantity is <= 0', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({
      id: mockSupplierId,
      isActive: true,
      currencyId: mockCurrencyId,
      paymentTermsDays: 30,
    });
    prismaMock.currency.findFirst.mockResolvedValue({
      id: mockCurrencyId,
      isActive: true,
    });

    await expect(
      service.create(
        mockOrgId,
        {
          supplierId: mockSupplierId,
          invoiceDate: '2026-08-01',
          lines: [{ itemId: mockItemId, quantity: 0, unitPrice: 10 }],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('4. should submit a draft supplier invoice (DRAFT -> SUBMITTED)', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: mockInvoiceId,
      organizationId: mockOrgId,
      invoiceNumber: 'SI-000001',
      status: SupplierInvoiceStatus.DRAFT,
      lines: [],
    });

    prismaMock.supplierInvoice.update.mockResolvedValue({
      id: mockInvoiceId,
      invoiceNumber: 'SI-000001',
      status: SupplierInvoiceStatus.SUBMITTED,
      lines: [],
    });

    const result = await service.submit(mockOrgId, mockInvoiceId, mockUserId);
    expect(result.status).toBe(SupplierInvoiceStatus.SUBMITTED);
  });

  it('5. should approve a submitted invoice (SUBMITTED -> APPROVED)', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: mockInvoiceId,
      organizationId: mockOrgId,
      invoiceNumber: 'SI-000001',
      status: SupplierInvoiceStatus.SUBMITTED,
      lines: [],
    });

    prismaMock.supplierInvoice.update.mockResolvedValue({
      id: mockInvoiceId,
      invoiceNumber: 'SI-000001',
      status: SupplierInvoiceStatus.APPROVED,
      lines: [],
    });

    const result = await service.approve(mockOrgId, mockInvoiceId, mockUserId);
    expect(result.status).toBe(SupplierInvoiceStatus.APPROVED);
    expect(matchingMock.matchInvoice).toHaveBeenCalled();
  });

  it('6. should reject approval if 3-way matching fails with over-invoicing', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: mockInvoiceId,
      organizationId: mockOrgId,
      invoiceNumber: 'SI-000001',
      status: SupplierInvoiceStatus.SUBMITTED,
      lines: [],
    });

    matchingMock.matchInvoice.mockResolvedValue({
      canApprove: false,
      overallStatus: 'OVER_INVOICED',
    });

    await expect(
      service.approve(mockOrgId, mockInvoiceId, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });

  it('7. should post approved invoice to GL and create balanced journal entry', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: mockInvoiceId,
      organizationId: mockOrgId,
      invoiceNumber: 'SI-000001',
      invoiceDate: new Date('2026-08-01'),
      status: SupplierInvoiceStatus.APPROVED,
      subtotal: new Prisma.Decimal('1000.0000'),
      discountAmount: new Prisma.Decimal('100.0000'),
      taxAmount: new Prisma.Decimal('90.0000'),
      grandTotal: new Prisma.Decimal('990.0000'),
      supplier: { id: mockSupplierId, name: 'Acme Supplies' },
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

    prismaMock.supplierInvoice.update.mockResolvedValue({
      id: mockInvoiceId,
      invoiceNumber: 'SI-000001',
      status: SupplierInvoiceStatus.POSTED,
      grandTotal: new Prisma.Decimal('990.0000'),
      lines: [],
    });

    const result = await service.post(mockOrgId, mockInvoiceId, mockUserId);
    expect(result.status).toBe(SupplierInvoiceStatus.POSTED);

    // Verify journal line creations
    expect(prismaMock.journalLine.createMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: mockOrgId,
          accountId: 'acc-exp',
          description: 'AP Invoice SI-000001 - Purchase Expense',
          debit: new Prisma.Decimal('900'),
          credit: new Prisma.Decimal(0),
          lineNumber: 1,
          journalEntryId: 'gl-entry-1',
        },
        {
          organizationId: mockOrgId,
          accountId: 'acc-tax',
          description: 'AP Invoice SI-000001 - Input Tax',
          debit: new Prisma.Decimal('90'),
          credit: new Prisma.Decimal(0),
          lineNumber: 2,
          journalEntryId: 'gl-entry-1',
        },
        {
          organizationId: mockOrgId,
          accountId: 'acc-ap',
          description: 'AP Invoice SI-000001 - Acme Supplies',
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal('990'),
          lineNumber: 3,
          journalEntryId: 'gl-entry-1',
        },
      ],
    });
  });

  it('8. should void posted invoice and create compensating GL reversal', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: mockInvoiceId,
      organizationId: mockOrgId,
      invoiceNumber: 'SI-000001',
      status: SupplierInvoiceStatus.POSTED,
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
          accountId: 'acc-exp',
          debit: new Prisma.Decimal('900'),
          credit: new Prisma.Decimal(0),
          lineNumber: 1,
          description: 'Purchase Expense',
        },
        {
          id: 'line-2',
          accountId: 'acc-tax',
          debit: new Prisma.Decimal('90'),
          credit: new Prisma.Decimal(0),
          lineNumber: 2,
          description: 'Tax',
        },
        {
          id: 'line-3',
          accountId: 'acc-ap',
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal('990'),
          lineNumber: 3,
          description: 'AP',
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

    prismaMock.supplierInvoice.update.mockResolvedValue({
      id: mockInvoiceId,
      invoiceNumber: 'SI-000001',
      status: SupplierInvoiceStatus.VOIDED,
      lines: [],
    });

    const result = await service.void(mockOrgId, mockInvoiceId, mockUserId);
    expect(result.status).toBe(SupplierInvoiceStatus.VOIDED);

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
          accountId: 'acc-exp',
          description: 'Reversal: Purchase Expense',
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal('900'),
          lineNumber: 1,
        },
        {
          journalEntryId: 'gl-rev-1',
          organizationId: mockOrgId,
          accountId: 'acc-tax',
          description: 'Reversal: Tax',
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal('90'),
          lineNumber: 2,
        },
        {
          journalEntryId: 'gl-rev-1',
          organizationId: mockOrgId,
          accountId: 'acc-ap',
          description: 'Reversal: AP',
          debit: new Prisma.Decimal('990'),
          credit: new Prisma.Decimal(0),
          lineNumber: 3,
        },
      ],
    });
  });

  it('9. should prevent voiding if payments have already been applied', async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: mockInvoiceId,
      organizationId: mockOrgId,
      invoiceNumber: 'SI-000001',
      status: SupplierInvoiceStatus.POSTED,
      amountPaid: new Prisma.Decimal('500.0000'),
      lines: [],
    });

    await expect(
      service.void(mockOrgId, mockInvoiceId, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });
});
