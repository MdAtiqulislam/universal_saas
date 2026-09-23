import { Test, TestingModule } from '@nestjs/testing';
import { SupplierInvoicesService } from './invoices/supplier-invoices.service';
import { AccountsPayableMatchingService } from './matching/accounts-payable-matching.service';
import { ApAccountMappingService } from './account-mapping/ap-account-mapping.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import {
  SupplierInvoiceStatus,
  FiscalPeriodStatus,
  AccountType,
  Prisma,
} from '@prisma/client';

describe('Accounts Payable Integrity & Procurement Integration Flow', () => {
  let invoiceService: SupplierInvoicesService;
  let matchingService: AccountsPayableMatchingService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockSupplierId = '22222222-2222-2222-2222-222222222222';
  const mockCurrencyId = '33333333-3333-3333-3333-333333333333';
  const mockPoId = '44444444-4444-4444-4444-444444444444';
  const mockPoLineId = '55555555-5555-5555-5555-555555555555';
  const mockGrId = '66666666-6666-6666-6666-666666666666';
  const mockGrLineId = '77777777-7777-7777-7777-777777777777';
  const mockItemId = '88888888-8888-8888-8888-888888888888';
  const mockInvoiceId = '99999999-9999-9999-9999-999999999999';
  const mockUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
      supplier: {
        findFirst: jest.fn().mockResolvedValue({
          id: mockSupplierId,
          organizationId: mockOrgId,
          name: 'Global Steel Corp',
          currencyId: mockCurrencyId,
          paymentTermsDays: 30,
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
      item: {
        findFirst: jest.fn().mockResolvedValue({
          id: mockItemId,
          organizationId: mockOrgId,
          sku: 'STEEL-BEAM',
          name: 'Steel Beam 10ft',
        }),
      },
      itemVariant: { findFirst: jest.fn() },
      purchaseOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: mockPoId,
          organizationId: mockOrgId,
          supplierId: mockSupplierId,
          poNumber: 'PO-000001',
          status: 'RECEIVED',
          lines: [
            {
              id: mockPoLineId,
              quantity: new Prisma.Decimal('100.0000'),
              unitPrice: new Prisma.Decimal('250.0000'),
              receivedQuantity: new Prisma.Decimal('100.0000'),
            },
          ],
        }),
      },
      goodsReceipt: {
        findFirst: jest.fn().mockResolvedValue({
          id: mockGrId,
          organizationId: mockOrgId,
          receiptNumber: 'GR-000001',
          status: 'COMPLETED',
          lines: [
            {
              id: mockGrLineId,
              quantity: new Prisma.Decimal('100.0000'),
              unitCost: new Prisma.Decimal('250.0000'),
            },
          ],
        }),
      },
      supplierInvoice: {
        create: jest.fn().mockResolvedValue({ id: mockInvoiceId }),
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      supplierInvoiceLine: {
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      fiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'period-1',
          name: 'FY2026-Q3',
          status: FiscalPeriodStatus.OPEN,
          startDate: new Date('2026-07-01'),
          endDate: new Date('2026-09-30'),
        }),
      },
      accountingAccountMapping: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const key = where.organizationId_key.key;
          return Promise.resolve({
            id: `m-${key}`,
            organizationId: mockOrgId,
            key,
            accountId: `acc-${key.toLowerCase()}`,
            account: {
              id: `acc-${key.toLowerCase()}`,
              code: key === 'ACCOUNTS_PAYABLE' ? '2010' : '5010',
              name: key,
              type:
                key === 'ACCOUNTS_PAYABLE'
                  ? AccountType.LIABILITY
                  : AccountType.EXPENSE,
              isActive: true,
              deletedAt: null,
            },
          });
        }),
      },
      journalEntry: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'gl-1', entryNumber: 'JE-000001' }),
        findFirst: jest.fn(),
        update: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierInvoicesService,
        AccountsPayableMatchingService,
        ApAccountMappingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
      ],
    }).compile();

    invoiceService = module.get<SupplierInvoicesService>(
      SupplierInvoicesService,
    );
    matchingService = module.get<AccountsPayableMatchingService>(
      AccountsPayableMatchingService,
    );
  });

  it('1. Complete Procurement -> AP flow: Draft -> 3-Way Match -> Approve -> Post GL Entry', async () => {
    // 1. Create draft invoice
    prismaMock.supplierInvoice.findUniqueOrThrow.mockResolvedValue({
      id: mockInvoiceId,
      invoiceNumber: 'SI-000001',
      invoiceDate: new Date('2026-08-15'),
      dueDate: new Date('2026-09-14'),
      status: SupplierInvoiceStatus.DRAFT,
      subtotal: new Prisma.Decimal('25000.0000'),
      discountAmount: new Prisma.Decimal('0.0000'),
      taxAmount: new Prisma.Decimal('0.0000'),
      grandTotal: new Prisma.Decimal('25000.0000'),
      amountPaid: new Prisma.Decimal('0.0000'),
      amountDue: new Prisma.Decimal('25000.0000'),
      purchaseOrderId: mockPoId,
      goodsReceiptId: mockGrId,
      supplier: {
        id: mockSupplierId,
        name: 'Global Steel Corp',
        paymentTermsDays: 30,
      },
      currency: { id: mockCurrencyId, code: 'USD', symbol: '$' },
      lines: [
        {
          id: 'inv-line-1',
          itemId: mockItemId,
          quantity: new Prisma.Decimal('100.0000'),
          unitPrice: new Prisma.Decimal('250.0000'),
          purchaseOrderLineId: mockPoLineId,
          goodsReceiptLineId: mockGrLineId,
          item: { id: mockItemId, sku: 'STEEL-BEAM', name: 'Steel Beam 10ft' },
          purchaseOrderLine: {
            id: mockPoLineId,
            quantity: new Prisma.Decimal('100.0000'),
            unitPrice: new Prisma.Decimal('250.0000'),
          },
          goodsReceiptLine: {
            id: mockGrLineId,
            quantity: new Prisma.Decimal('100.0000'),
            unitCost: new Prisma.Decimal('250.0000'),
          },
        },
      ],
    });

    const draft = await invoiceService.create(
      mockOrgId,
      {
        supplierId: mockSupplierId,
        invoiceDate: '2026-08-15',
        purchaseOrderId: mockPoId,
        goodsReceiptId: mockGrId,
        lines: [
          {
            itemId: mockItemId,
            quantity: 100,
            unitPrice: 250,
            purchaseOrderLineId: mockPoLineId,
            goodsReceiptLineId: mockGrLineId,
          },
        ],
      },
      mockUserId,
    );

    expect(draft.invoiceNumber).toBe('SI-000001');
    expect(draft.grandTotal.toString()).toBe('25000');

    // 2. Perform 3-Way Match
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(draft);
    const match = await matchingService.matchInvoice(
      mockOrgId,
      mockInvoiceId,
      mockUserId,
    );
    expect(match.overallStatus).toBe('MATCHED');
    expect(match.canApprove).toBe(true);

    // 3. Submit
    prismaMock.supplierInvoice.update.mockResolvedValue({
      ...draft,
      status: SupplierInvoiceStatus.SUBMITTED,
    });
    const submitted = await invoiceService.submit(
      mockOrgId,
      mockInvoiceId,
      mockUserId,
    );
    expect(submitted.status).toBe(SupplierInvoiceStatus.SUBMITTED);

    // 4. Approve
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(submitted);
    prismaMock.supplierInvoice.update.mockResolvedValue({
      ...submitted,
      status: SupplierInvoiceStatus.APPROVED,
    });
    const approved = await invoiceService.approve(
      mockOrgId,
      mockInvoiceId,
      mockUserId,
    );
    expect(approved.status).toBe(SupplierInvoiceStatus.APPROVED);

    // 5. Post to GL
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(approved);
    prismaMock.supplierInvoice.update.mockResolvedValue({
      ...approved,
      status: SupplierInvoiceStatus.POSTED,
      postedAt: new Date(),
      postedByUserId: mockUserId,
    });

    const posted = await invoiceService.post(
      mockOrgId,
      mockInvoiceId,
      mockUserId,
    );
    expect(posted.status).toBe(SupplierInvoiceStatus.POSTED);

    // Verify GL journal lines generated
    expect(prismaMock.journalLine.createMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: mockOrgId,
          accountId: 'acc-purchase_expense',
          description: 'AP Invoice SI-000001 - Purchase Expense',
          debit: new Prisma.Decimal('25000'),
          credit: new Prisma.Decimal(0),
          lineNumber: 1,
          journalEntryId: 'gl-1',
        },
        {
          organizationId: mockOrgId,
          accountId: 'acc-accounts_payable',
          description: 'AP Invoice SI-000001 - Global Steel Corp',
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal('25000'),
          lineNumber: 2,
          journalEntryId: 'gl-1',
        },
      ],
    });
  });
});
