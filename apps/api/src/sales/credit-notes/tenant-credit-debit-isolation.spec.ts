import { Test, TestingModule } from '@nestjs/testing';
import { CustomerCreditNotesService } from './customer-credit-notes.service';
import { CustomerRefundsService } from '../refunds/customer-refunds.service';
import { SupplierDebitNotesService } from '../../purchasing/debit-notes/supplier-debit-notes.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../../ap/account-mapping/ap-account-mapping.service';
import { BalancesService } from '../../inventory/balances/balances.service';
import { NotFoundException } from '@nestjs/common';
import { CreditNoteStatus, DebitNoteStatus } from '@prisma/client';

describe('Tenant Credit & Debit Isolation', () => {
  let creditNotesService: CustomerCreditNotesService;
  let refundsService: CustomerRefundsService;
  let debitNotesService: SupplierDebitNotesService;
  let prismaMock: any;

  const orgA = '11111111-1111-1111-1111-111111111111';
  const userA = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    prismaMock = {
      customer: { findFirst: jest.fn() },
      supplier: { findFirst: jest.fn() },
      paymentAccount: { findFirst: jest.fn() },
      currency: { findFirst: jest.fn() },
      customerInvoice: { findFirst: jest.fn() },
      supplierInvoice: { findFirst: jest.fn() },
      customerCreditNote: { findFirst: jest.fn() },
      customerRefund: { findFirst: jest.fn() },
      supplierDebitNote: { findFirst: jest.fn() },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerCreditNotesService,
        CustomerRefundsService,
        SupplierDebitNotesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
        { provide: NumberingService, useValue: { nextNumber: jest.fn() } },
        {
          provide: ApAccountMappingService,
          useValue: { resolveAccount: jest.fn() },
        },
        {
          provide: BalancesService,
          useValue: { applyStockMovement: jest.fn() },
        },
      ],
    }).compile();

    creditNotesService = module.get<CustomerCreditNotesService>(
      CustomerCreditNotesService,
    );
    refundsService = module.get<CustomerRefundsService>(CustomerRefundsService);
    debitNotesService = module.get<SupplierDebitNotesService>(
      SupplierDebitNotesService,
    );
  });

  it('1. Org A cannot read Org B credit notes', async () => {
    prismaMock.customerCreditNote.findFirst.mockResolvedValue(null);

    await expect(creditNotesService.findOne(orgA, 'cn-org-b')).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.customerCreditNote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'cn-org-b',
          organizationId: orgA,
        }),
      }),
    );
  });

  it('2. Org A cannot apply credit note against Org B invoice', async () => {
    prismaMock.customerCreditNote.findFirst.mockResolvedValue({
      id: 'cn-1',
      organizationId: orgA,
      customerId: 'cust-1',
      status: CreditNoteStatus.POSTED,
      remainingAmount: 100,
    });
    prismaMock.customerInvoice.findFirst.mockResolvedValue(null);

    await expect(
      creditNotesService.apply(
        orgA,
        'cn-1',
        { applications: [{ customerInvoiceId: 'inv-org-b', amount: 50 }] },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('3. Org A cannot read Org B debit notes', async () => {
    prismaMock.supplierDebitNote.findFirst.mockResolvedValue(null);

    await expect(debitNotesService.findOne(orgA, 'dn-org-b')).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.supplierDebitNote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'dn-org-b',
          organizationId: orgA,
        }),
      }),
    );
  });

  it('4. Org A cannot apply debit note against Org B supplier invoice', async () => {
    prismaMock.supplierDebitNote.findFirst.mockResolvedValue({
      id: 'dn-1',
      organizationId: orgA,
      supplierId: 'supp-1',
      status: DebitNoteStatus.POSTED,
      remainingAmount: 100,
    });
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);

    await expect(
      debitNotesService.apply(
        orgA,
        'dn-1',
        { applications: [{ supplierInvoiceId: 'si-org-b', amount: 50 }] },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('5. Org A cannot post refund against Org B credit note', async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      id: 'cust-1',
      isActive: true,
    });
    prismaMock.paymentAccount.findFirst.mockResolvedValue({
      id: 'pay-1',
      isActive: true,
    });
    prismaMock.currency.findFirst.mockResolvedValue({
      id: 'curr-1',
      isActive: true,
    });
    prismaMock.customerCreditNote.findFirst.mockResolvedValue(null);

    await expect(
      refundsService.create(
        orgA,
        {
          customerId: 'cust-1',
          creditNoteId: 'cn-org-b',
          paymentAccountId: 'pay-1',
          refundDate: '2026-08-28',
          amount: 50,
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
