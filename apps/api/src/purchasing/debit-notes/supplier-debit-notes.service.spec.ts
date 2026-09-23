import { Test, TestingModule } from '@nestjs/testing';
import { SupplierDebitNotesService } from './supplier-debit-notes.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../../ap/account-mapping/ap-account-mapping.service';
import { BalancesService } from '../../inventory/balances/balances.service';
import {
  DebitNoteStatus,
  FiscalPeriodStatus,
  Prisma,
  SupplierInvoiceStatus,
} from '@prisma/client';

describe('SupplierDebitNotesService', () => {
  let service: SupplierDebitNotesService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let accountMappingMock: any;
  let balancesMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    prismaMock = {
      supplier: { findFirst: jest.fn() },
      currency: { findFirst: jest.fn() },
      item: { findFirst: jest.fn() },
      itemVariant: { findFirst: jest.fn() },
      location: { findFirst: jest.fn() },
      fiscalPeriod: { findFirst: jest.fn() },
      supplierInvoice: { findFirst: jest.fn(), update: jest.fn() },
      supplierDebitNote: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      supplierDebitNoteLine: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      supplierDebitApplication: {
        create: jest.fn(),
      },
      journalEntry: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };

    eventBusMock = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'DN-000001' }),
    };
    accountMappingMock = {
      resolveAccount: jest.fn().mockImplementation((_orgId, key) => {
        if (key === 'ACCOUNTS_PAYABLE') return 'acc-ap';
        if (key === 'PURCHASE_EXPENSE') return 'acc-purchase-expense';
        if (key === 'INPUT_TAX') return 'acc-input-tax';
        return 'acc-generic';
      }),
    };
    balancesMock = {
      applyStockMovement: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierDebitNotesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        { provide: ApAccountMappingService, useValue: accountMappingMock },
        { provide: BalancesService, useValue: balancesMock },
      ],
    }).compile();

    service = module.get<SupplierDebitNotesService>(SupplierDebitNotesService);
  });

  it('1. should create a draft supplier debit note with multi-line calculations', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({
      id: 'supp-1',
      name: 'Global Parts',
      isActive: true,
      currencyId: 'curr-usd',
    });
    prismaMock.currency.findFirst.mockResolvedValue({
      id: 'curr-usd',
      code: 'USD',
      isActive: true,
    });
    prismaMock.item.findFirst.mockResolvedValue({
      id: 'item-1',
      sku: 'RAW-1',
      name: 'Steel Sheet',
    });

    prismaMock.supplierDebitNote.create.mockImplementation((args: any) => ({
      id: 'dn-1',
      ...args.data,
      lines: args.data.lines.create,
    }));

    const result = await service.create(
      mockOrgId,
      {
        supplierId: 'supp-1',
        debitDate: '2026-08-28',
        lines: [
          {
            itemId: 'item-1',
            quantity: 5,
            unitPrice: 50,
            discountAmount: 0,
            taxRate: 10,
          },
        ],
      },
      mockUserId,
    );

    // subtotal: 250, tax: 25, grandTotal: 275
    expect(result.grandTotal.toString()).toBe('275');
    expect(result.remainingAmount.toString()).toBe('275');
    expect(result.status).toBe(DebitNoteStatus.DRAFT);
  });

  it('2. should approve and post debit note to GL and record stock return issue', async () => {
    prismaMock.supplierDebitNote.findFirst.mockResolvedValue({
      id: 'dn-1',
      debitNoteNumber: 'DN-000001',
      supplierId: 'supp-1',
      debitDate: new Date('2026-08-28'),
      subtotal: new Prisma.Decimal(250),
      discountAmount: new Prisma.Decimal(0),
      taxAmount: new Prisma.Decimal(25),
      grandTotal: new Prisma.Decimal(275),
      status: DebitNoteStatus.APPROVED,
      supplier: { id: 'supp-1', name: 'Global Parts' },
      lines: [
        {
          itemId: 'item-1',
          variantId: null,
          quantity: new Prisma.Decimal(5),
          returnToInventory: true,
          locationId: 'loc-1',
        },
      ],
    });

    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      status: FiscalPeriodStatus.OPEN,
    });

    prismaMock.journalEntry.create.mockResolvedValue({ id: 'je-dn-1' });
    prismaMock.supplierDebitNote.update.mockResolvedValue({
      id: 'dn-1',
      status: DebitNoteStatus.POSTED,
      journalEntryId: 'je-dn-1',
      grandTotal: new Prisma.Decimal(275),
    });

    const result = await service.post(mockOrgId, 'dn-1', mockUserId);
    expect(result.status).toBe(DebitNoteStatus.POSTED);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceType: 'SUPPLIER_DEBIT_NOTE',
          lines: {
            create: expect.arrayContaining([
              expect.objectContaining({
                accountId: 'acc-ap',
                debit: new Prisma.Decimal(275),
              }),
              expect.objectContaining({
                accountId: 'acc-purchase-expense',
                credit: new Prisma.Decimal(250),
              }),
              expect.objectContaining({
                accountId: 'acc-input-tax',
                credit: new Prisma.Decimal(25),
              }),
            ]),
          },
        }),
      }),
    );
    expect(balancesMock.applyStockMovement).toHaveBeenCalledWith(
      mockOrgId,
      expect.objectContaining({
        itemId: 'item-1',
        movementType: 'ISSUE',
        quantity: 5,
      }),
      mockUserId,
      expect.anything(),
    );
  });

  it('3. should apply debit note against supplier invoices', async () => {
    prismaMock.supplierDebitNote.findFirst.mockResolvedValue({
      id: 'dn-1',
      supplierId: 'supp-1',
      status: DebitNoteStatus.POSTED,
      appliedAmount: new Prisma.Decimal(0),
      remainingAmount: new Prisma.Decimal(275),
    });

    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: 'si-1',
      invoiceNumber: 'SI-000001',
      supplierId: 'supp-1',
      status: SupplierInvoiceStatus.POSTED,
      amountPaid: new Prisma.Decimal(0),
      amountDue: new Prisma.Decimal(275),
    });

    prismaMock.supplierDebitNote.update.mockResolvedValue({
      id: 'dn-1',
      appliedAmount: new Prisma.Decimal(275),
      remainingAmount: new Prisma.Decimal(0),
      status: DebitNoteStatus.APPLIED,
    });

    const result = await service.apply(
      mockOrgId,
      'dn-1',
      { applications: [{ supplierInvoiceId: 'si-1', amount: 275 }] },
      mockUserId,
    );

    expect(result.status).toBe(DebitNoteStatus.APPLIED);
    expect(prismaMock.supplierInvoice.update).toHaveBeenCalledWith({
      where: { id: 'si-1' },
      data: {
        amountPaid: new Prisma.Decimal(275),
        amountDue: new Prisma.Decimal(0),
        status: SupplierInvoiceStatus.PAID,
      },
    });
  });

  it('4. should void posted debit note creating compensating reversal GL entry', async () => {
    prismaMock.supplierDebitNote.findFirst.mockResolvedValue({
      id: 'dn-1',
      debitNoteNumber: 'DN-000001',
      status: DebitNoteStatus.POSTED,
      appliedAmount: new Prisma.Decimal(0),
      subtotal: new Prisma.Decimal(250),
      discountAmount: new Prisma.Decimal(0),
      taxAmount: new Prisma.Decimal(25),
      grandTotal: new Prisma.Decimal(275),
    });

    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      status: FiscalPeriodStatus.OPEN,
    });

    prismaMock.journalEntry.create.mockResolvedValue({ id: 'je-rev-dn-1' });
    prismaMock.supplierDebitNote.update.mockResolvedValue({
      id: 'dn-1',
      status: DebitNoteStatus.VOIDED,
    });

    const result = await service.void(mockOrgId, 'dn-1', mockUserId);
    expect(result.status).toBe(DebitNoteStatus.VOIDED);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceType: 'REVERSAL',
          lines: {
            create: expect.arrayContaining([
              expect.objectContaining({
                accountId: 'acc-purchase-expense',
                debit: new Prisma.Decimal(250),
              }),
              expect.objectContaining({
                accountId: 'acc-ap',
                credit: new Prisma.Decimal(275),
              }),
            ]),
          },
        }),
      }),
    );
  });
});
