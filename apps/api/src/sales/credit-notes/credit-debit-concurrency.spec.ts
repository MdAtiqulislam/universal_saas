import { Test, TestingModule } from '@nestjs/testing';
import { CustomerCreditNotesService } from './customer-credit-notes.service';
import { SupplierDebitNotesService } from '../../purchasing/debit-notes/supplier-debit-notes.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../../ap/account-mapping/ap-account-mapping.service';
import { BalancesService } from '../../inventory/balances/balances.service';
import {
  CreditNoteStatus,
  CustomerInvoiceStatus,
  DebitNoteStatus,
  Prisma,
  SupplierInvoiceStatus,
} from '@prisma/client';

describe('Credit & Debit Note Concurrency', () => {
  let creditNotesService: CustomerCreditNotesService;
  let debitNotesService: SupplierDebitNotesService;
  let prismaMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    prismaMock = {
      customerInvoice: { findFirst: jest.fn(), update: jest.fn() },
      customerCreditNote: { findFirst: jest.fn(), update: jest.fn() },
      customerCreditApplication: { create: jest.fn() },
      supplierInvoice: { findFirst: jest.fn(), update: jest.fn() },
      supplierDebitNote: { findFirst: jest.fn(), update: jest.fn() },
      supplierDebitApplication: { create: jest.fn() },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerCreditNotesService,
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
    debitNotesService = module.get<SupplierDebitNotesService>(
      SupplierDebitNotesService,
    );
  });

  it('1. 100 parallel credit applications should never exceed remaining amount under transactional serialization', async () => {
    let creditRemaining = new Prisma.Decimal(100);
    let invoiceDue = new Prisma.Decimal(100);

    let queue = Promise.resolve();
    prismaMock.$transaction.mockImplementation((callback: any) => {
      const runInTx = async () => {
        const mockTx = {
          customerCreditNote: {
            findFirst: jest.fn().mockImplementation(() => ({
              id: 'cn-1',
              customerId: 'cust-1',
              status: CreditNoteStatus.POSTED,
              appliedAmount: new Prisma.Decimal(100).sub(creditRemaining),
              remainingAmount: creditRemaining,
            })),
            update: jest.fn().mockImplementation((args) => {
              creditRemaining = args.data.remainingAmount;
              return { id: 'cn-1', ...args.data };
            }),
          },
          customerInvoice: {
            findFirst: jest.fn().mockImplementation(() => ({
              id: 'inv-1',
              customerId: 'cust-1',
              status: CustomerInvoiceStatus.ISSUED,
              amountPaid: new Prisma.Decimal(100).sub(invoiceDue),
              amountDue: invoiceDue,
            })),
            update: jest.fn().mockImplementation((args) => {
              invoiceDue = args.data.amountDue;
              return { id: 'inv-1', ...args.data };
            }),
          },
          customerCreditApplication: {
            create: jest.fn(),
          },
        };
        return await callback(mockTx);
      };

      const result = queue.then(runInTx);
      queue = result.catch(() => {});
      return result;
    });

    const promises = Array.from({ length: 100 }).map(() =>
      creditNotesService
        .apply(
          mockOrgId,
          'cn-1',
          { applications: [{ customerInvoiceId: 'inv-1', amount: 2 }] },
          mockUserId,
        )
        .then(() => 'SUCCESS')
        .catch(() => 'REJECTED'),
    );

    const results = await Promise.all(promises);
    const successes = results.filter((r) => r === 'SUCCESS');
    const rejections = results.filter((r) => r === 'REJECTED');

    // Exactly 50 operations of $2 fit into $100
    expect(successes.length).toBe(50);
    expect(rejections.length).toBe(50);
    expect(creditRemaining.isZero()).toBe(true);
    expect(invoiceDue.isZero()).toBe(true);
  });

  it('2. 100 parallel debit applications should never exceed remaining amount under transactional serialization', async () => {
    let debitRemaining = new Prisma.Decimal(50);
    let invoiceDue = new Prisma.Decimal(50);

    let queue = Promise.resolve();
    prismaMock.$transaction.mockImplementation((callback: any) => {
      const runInTx = async () => {
        const mockTx = {
          supplierDebitNote: {
            findFirst: jest.fn().mockImplementation(() => ({
              id: 'dn-1',
              supplierId: 'supp-1',
              status: DebitNoteStatus.POSTED,
              appliedAmount: new Prisma.Decimal(50).sub(debitRemaining),
              remainingAmount: debitRemaining,
            })),
            update: jest.fn().mockImplementation((args) => {
              debitRemaining = args.data.remainingAmount;
              return { id: 'dn-1', ...args.data };
            }),
          },
          supplierInvoice: {
            findFirst: jest.fn().mockImplementation(() => ({
              id: 'si-1',
              supplierId: 'supp-1',
              status: SupplierInvoiceStatus.POSTED,
              amountPaid: new Prisma.Decimal(50).sub(invoiceDue),
              amountDue: invoiceDue,
            })),
            update: jest.fn().mockImplementation((args) => {
              invoiceDue = args.data.amountDue;
              return { id: 'si-1', ...args.data };
            }),
          },
          supplierDebitApplication: {
            create: jest.fn(),
          },
        };
        return await callback(mockTx);
      };

      const result = queue.then(runInTx);
      queue = result.catch(() => {});
      return result;
    });

    const promises = Array.from({ length: 100 }).map(() =>
      debitNotesService
        .apply(
          mockOrgId,
          'dn-1',
          { applications: [{ supplierInvoiceId: 'si-1', amount: 1 }] },
          mockUserId,
        )
        .then(() => 'SUCCESS')
        .catch(() => 'REJECTED'),
    );

    const results = await Promise.all(promises);
    const successes = results.filter((r) => r === 'SUCCESS');
    const rejections = results.filter((r) => r === 'REJECTED');

    expect(successes.length).toBe(50);
    expect(rejections.length).toBe(50);
    expect(debitRemaining.isZero()).toBe(true);
    expect(invoiceDue.isZero()).toBe(true);
  });
});
