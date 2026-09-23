import { Test, TestingModule } from '@nestjs/testing';
import { CustomerCreditNotesService } from './customer-credit-notes.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../../ap/account-mapping/ap-account-mapping.service';
import { BalancesService } from '../../inventory/balances/balances.service';
import {
  CreditNoteStatus,
  CustomerInvoiceStatus,
  FiscalPeriodStatus,
  Prisma,
  ReturnDisposition,
} from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('CustomerCreditNotesService', () => {
  let service: CustomerCreditNotesService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let accountMappingMock: any;
  let balancesMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    prismaMock = {
      customer: { findFirst: jest.fn() },
      currency: { findFirst: jest.fn() },
      item: { findFirst: jest.fn() },
      itemVariant: { findFirst: jest.fn() },
      location: { findFirst: jest.fn() },
      fiscalPeriod: { findFirst: jest.fn() },
      customerInvoice: { findFirst: jest.fn(), update: jest.fn() },
      customerCreditNote: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      customerCreditNoteLine: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      customerCreditApplication: {
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
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'CN-000001' }),
    };
    accountMappingMock = {
      resolveAccount: jest.fn().mockImplementation((_orgId, key) => {
        if (key === 'ACCOUNTS_RECEIVABLE') return 'acc-ar';
        if (key === 'SALES_RETURNS' || key === 'SALES_REVENUE')
          return 'acc-sales-returns';
        if (key === 'OUTPUT_TAX') return 'acc-output-tax';
        return 'acc-generic';
      }),
    };
    balancesMock = {
      applyStockMovement: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerCreditNotesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        { provide: ApAccountMappingService, useValue: accountMappingMock },
        { provide: BalancesService, useValue: balancesMock },
      ],
    }).compile();

    service = module.get<CustomerCreditNotesService>(
      CustomerCreditNotesService,
    );
  });

  it('1. should create a draft customer credit note with exact line calculations', async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      id: 'cust-1',
      name: 'Acme Corp',
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
      sku: 'PROD-1',
      name: 'Widget',
    });

    // 2 units @ $100 with $10 discount and 10% tax
    // gross: 200, net: 190, tax: 19, total: 209
    prismaMock.customerCreditNote.create.mockImplementation((args: any) => ({
      id: 'cn-1',
      ...args.data,
      lines: args.data.lines.create,
    }));

    const result = await service.create(
      mockOrgId,
      {
        customerId: 'cust-1',
        creditDate: '2026-08-28',
        lines: [
          {
            itemId: 'item-1',
            quantity: 2,
            unitPrice: 100,
            discountAmount: 10,
            taxRate: 10,
          },
        ],
      },
      mockUserId,
    );

    expect(result.grandTotal.toString()).toBe('209');
    expect(result.remainingAmount.toString()).toBe('209');
    expect(result.status).toBe(CreditNoteStatus.DRAFT);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'CUSTOMER_CREDIT_NOTE_CREATED' }),
    );
  });

  it('2. should approve draft credit note', async () => {
    prismaMock.customerCreditNote.findFirst.mockResolvedValue({
      id: 'cn-1',
      creditNoteNumber: 'CN-000001',
      status: CreditNoteStatus.DRAFT,
      lines: [],
    });
    prismaMock.customerCreditNote.update.mockResolvedValue({
      id: 'cn-1',
      creditNoteNumber: 'CN-000001',
      status: CreditNoteStatus.APPROVED,
    });

    const result = await service.approve(mockOrgId, 'cn-1', mockUserId);
    expect(result.status).toBe(CreditNoteStatus.APPROVED);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'CUSTOMER_CREDIT_NOTE_APPROVED' }),
    );
  });

  it('3. should post approved credit note to GL and return inventory', async () => {
    prismaMock.customerCreditNote.findFirst.mockResolvedValue({
      id: 'cn-1',
      creditNoteNumber: 'CN-000001',
      customerId: 'cust-1',
      creditDate: new Date('2026-08-28'),
      subtotal: new Prisma.Decimal(200),
      discountAmount: new Prisma.Decimal(10),
      taxAmount: new Prisma.Decimal(19),
      grandTotal: new Prisma.Decimal(209),
      status: CreditNoteStatus.APPROVED,
      customer: { id: 'cust-1', name: 'Acme Corp' },
      lines: [
        {
          itemId: 'item-1',
          variantId: null,
          quantity: new Prisma.Decimal(2),
          returnToInventory: true,
          disposition: ReturnDisposition.RESTOCK,
          locationId: 'loc-1',
        },
      ],
    });

    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      status: FiscalPeriodStatus.OPEN,
    });

    prismaMock.journalEntry.create.mockResolvedValue({
      id: 'je-1',
      entryNumber: 'JE-000001',
    });

    prismaMock.customerCreditNote.update.mockResolvedValue({
      id: 'cn-1',
      status: CreditNoteStatus.POSTED,
      journalEntryId: 'je-1',
      grandTotal: new Prisma.Decimal(209),
    });

    const result = await service.post(mockOrgId, 'cn-1', mockUserId);

    expect(result.status).toBe(CreditNoteStatus.POSTED);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceType: 'CUSTOMER_CREDIT_NOTE',
          lines: {
            create: expect.arrayContaining([
              expect.objectContaining({
                accountId: 'acc-sales-returns',
                debit: new Prisma.Decimal(190),
              }),
              expect.objectContaining({
                accountId: 'acc-output-tax',
                debit: new Prisma.Decimal(19),
              }),
              expect.objectContaining({
                accountId: 'acc-ar',
                credit: new Prisma.Decimal(209),
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
        locationId: 'loc-1',
        movementType: 'RECEIPT',
        quantity: 2,
      }),
      mockUserId,
      expect.anything(),
    );
  });

  it('4. should apply credit note against open customer invoices', async () => {
    prismaMock.customerCreditNote.findFirst.mockResolvedValue({
      id: 'cn-1',
      creditNoteNumber: 'CN-000001',
      customerId: 'cust-1',
      status: CreditNoteStatus.POSTED,
      appliedAmount: new Prisma.Decimal(0),
      remainingAmount: new Prisma.Decimal(200),
    });

    prismaMock.customerInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      invoiceNumber: 'CI-000001',
      customerId: 'cust-1',
      status: CustomerInvoiceStatus.ISSUED,
      amountPaid: new Prisma.Decimal(0),
      amountDue: new Prisma.Decimal(200),
    });

    prismaMock.customerCreditNote.update.mockResolvedValue({
      id: 'cn-1',
      appliedAmount: new Prisma.Decimal(200),
      remainingAmount: new Prisma.Decimal(0),
      status: CreditNoteStatus.APPLIED,
    });

    const result = await service.apply(
      mockOrgId,
      'cn-1',
      {
        applications: [{ customerInvoiceId: 'inv-1', amount: 200 }],
      },
      mockUserId,
    );

    expect(result.status).toBe(CreditNoteStatus.APPLIED);
    expect(prismaMock.customerInvoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: {
        amountPaid: new Prisma.Decimal(200),
        amountDue: new Prisma.Decimal(0),
        status: CustomerInvoiceStatus.PAID,
      },
    });
    expect(prismaMock.customerCreditApplication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        creditNoteId: 'cn-1',
        customerInvoiceId: 'inv-1',
        amount: new Prisma.Decimal(200),
      }),
    });
  });

  it('5. should reject application if applied amount exceeds invoice amount due', async () => {
    prismaMock.customerCreditNote.findFirst.mockResolvedValue({
      id: 'cn-1',
      customerId: 'cust-1',
      status: CreditNoteStatus.POSTED,
      remainingAmount: new Prisma.Decimal(500),
    });

    prismaMock.customerInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      invoiceNumber: 'CI-000001',
      customerId: 'cust-1',
      status: CustomerInvoiceStatus.ISSUED,
      amountDue: new Prisma.Decimal(100),
    });

    await expect(
      service.apply(
        mockOrgId,
        'cn-1',
        { applications: [{ customerInvoiceId: 'inv-1', amount: 200 }] },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('6. should void posted credit note creating compensating reversal GL entry', async () => {
    prismaMock.customerCreditNote.findFirst.mockResolvedValue({
      id: 'cn-1',
      creditNoteNumber: 'CN-000001',
      status: CreditNoteStatus.POSTED,
      appliedAmount: new Prisma.Decimal(0),
      subtotal: new Prisma.Decimal(100),
      discountAmount: new Prisma.Decimal(0),
      taxAmount: new Prisma.Decimal(10),
      grandTotal: new Prisma.Decimal(110),
    });

    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      status: FiscalPeriodStatus.OPEN,
    });

    prismaMock.journalEntry.create.mockResolvedValue({ id: 'je-rev-1' });
    prismaMock.customerCreditNote.update.mockResolvedValue({
      id: 'cn-1',
      status: CreditNoteStatus.VOIDED,
    });

    const result = await service.void(mockOrgId, 'cn-1', mockUserId);
    expect(result.status).toBe(CreditNoteStatus.VOIDED);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceType: 'REVERSAL',
          sourceId: 'cn-1',
          lines: {
            create: expect.arrayContaining([
              expect.objectContaining({
                accountId: 'acc-ar',
                debit: new Prisma.Decimal(110),
              }),
              expect.objectContaining({
                accountId: 'acc-sales-returns',
                credit: new Prisma.Decimal(100),
              }),
            ]),
          },
        }),
      }),
    );
  });
});
