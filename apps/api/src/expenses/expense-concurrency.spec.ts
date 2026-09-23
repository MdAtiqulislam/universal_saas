import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseClaimsService } from './expense-claims.service';
import { ExpenseReimbursementsService } from './expense-reimbursements.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { TaxRatesService } from '../tax/tax-rates.service';
import { TaxTransactionsService } from '../tax/tax-transactions.service';
import {
  Prisma,
  ExpenseClaimStatus,
  FiscalPeriodStatus,
  PaymentType,
  PaymentStatus,
} from '@prisma/client';

describe('Expense Concurrency (M21)', () => {
  let claimsService: ExpenseClaimsService;
  let reimbursementsService: ExpenseReimbursementsService;
  let prisma: any;

  const orgId = 'org-concurrency-test';
  const userId = 'user-worker';

  beforeEach(async () => {
    let claimStatus: ExpenseClaimStatus = ExpenseClaimStatus.APPROVED;
    let dueAmount = new Prisma.Decimal(100);
    let paidAmount = new Prisma.Decimal(0);

    prisma = {
      expenseClaim: {
        findFirst: jest.fn().mockImplementation(() => ({
          id: 'claim-conc-1',
          organizationId: orgId,
          claimNumber: 'EX-000001',
          claimDate: new Date('2026-08-20'),
          description: 'Concurrency Test Claim',
          currencyId: 'cur-usd',
          status: claimStatus,
          subtotal: new Prisma.Decimal(100),
          taxAmount: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal(100),
          approvedAmount: new Prisma.Decimal(100),
          paidAmount,
          dueAmount,
          claimant: { name: 'Alice' },
          lines: [
            {
              id: 'line-1',
              categoryId: 'cat-1',
              category: { glAccountId: 'acc-exp' },
              description: 'Expense Item',
              expenseDate: new Date('2026-08-20'),
              subtotal: new Prisma.Decimal(100),
              taxAmount: new Prisma.Decimal(0),
              totalAmount: new Prisma.Decimal(100),
            },
          ],
        })),
        findUnique: jest.fn().mockImplementation(() => ({
          id: 'claim-conc-1',
          organizationId: orgId,
          claimNumber: 'EX-000001',
          currencyId: 'cur-usd',
          status: claimStatus,
          approvedAmount: new Prisma.Decimal(100),
          paidAmount,
          dueAmount,
          claimant: { name: 'Alice' },
        })),
        update: jest.fn().mockImplementation(({ data }) => {
          if (data.status) {
            claimStatus = data.status;
          }
          if (data.paidAmount) {
            paidAmount = data.paidAmount;
          }
          if (data.dueAmount) {
            dueAmount = data.dueAmount;
          }
          return {
            id: 'claim-conc-1',
            organizationId: orgId,
            claimNumber: 'EX-000001',
            status: claimStatus,
            totalAmount: new Prisma.Decimal(100),
            paidAmount,
            dueAmount,
            claimant: { name: 'Alice' },
            currency: { id: 'cur-usd' },
            journalEntryId: data.journalEntryId ?? 'je-1',
            lines: [],
          };
        }),
      },
      paymentAccount: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pay-acc-1',
          organizationId: orgId,
          name: 'Bank',
          accountingAccountId: 'acc-bank',
          isActive: true,
        }),
      },
      fiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'fp-1',
          status: FiscalPeriodStatus.OPEN,
        }),
      },
      journalEntry: {
        create: jest.fn().mockResolvedValue({ id: 'je-1' }),
        count: jest.fn().mockResolvedValue(0),
      },
      payment: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: `pay-${Math.random()}`,
          paymentNumber: 'PAY-001',
          type: PaymentType.REIMBURSEMENT,
          status: PaymentStatus.ALLOCATED,
          amount: data.amount,
        })),
        count: jest.fn().mockResolvedValue(0),
      },
      paymentAllocation: {
        create: jest.fn().mockResolvedValue({ id: 'alloc-1' }),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'NUM-001' }),
    };
    const accountMappingService = {
      resolveAccount: jest.fn().mockResolvedValue('acc-payable'),
    };
    const taxRatesService = {
      findEffectiveRate: jest.fn().mockResolvedValue(null),
    };
    const taxTransactionsService = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseClaimsService,
        ExpenseReimbursementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: ApAccountMappingService, useValue: accountMappingService },
        { provide: TaxRatesService, useValue: taxRatesService },
        { provide: TaxTransactionsService, useValue: taxTransactionsService },
      ],
    }).compile();

    claimsService = module.get<ExpenseClaimsService>(ExpenseClaimsService);
    reimbursementsService = module.get<ExpenseReimbursementsService>(
      ExpenseReimbursementsService,
    );
  });

  it('should handle 100 concurrent posting attempts idempotently', async () => {
    let postingDone = false;
    prisma.expenseClaim.findFirst.mockImplementation(() => {
      if (postingDone) {
        return {
          id: 'claim-conc-1',
          organizationId: orgId,
          claimNumber: 'EX-000001',
          status: ExpenseClaimStatus.POSTED,
          subtotal: new Prisma.Decimal(100),
          taxAmount: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal(100),
          approvedAmount: new Prisma.Decimal(100),
          paidAmount: new Prisma.Decimal(0),
          dueAmount: new Prisma.Decimal(100),
          claimant: { name: 'Alice' },
          lines: [],
        };
      }
      postingDone = true;
      return {
        id: 'claim-conc-1',
        organizationId: orgId,
        claimNumber: 'EX-000001',
        status: ExpenseClaimStatus.APPROVED,
        claimDate: new Date('2026-08-20'),
        subtotal: new Prisma.Decimal(100),
        taxAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(100),
        approvedAmount: new Prisma.Decimal(100),
        paidAmount: new Prisma.Decimal(0),
        dueAmount: new Prisma.Decimal(100),
        claimant: { name: 'Alice' },
        lines: [
          {
            id: 'line-1',
            categoryId: 'cat-1',
            category: { glAccountId: 'acc-exp' },
            description: 'Expense Item',
            expenseDate: new Date('2026-08-20'),
            subtotal: new Prisma.Decimal(100),
            taxAmount: new Prisma.Decimal(0),
            totalAmount: new Prisma.Decimal(100),
          },
        ],
      };
    });

    const attempts = Array.from({ length: 100 }, () =>
      claimsService
        .post(orgId, 'claim-conc-1', userId)
        .then(() => ({ status: 'fulfilled' }))
        .catch((err) => ({ status: 'rejected', reason: err.message })),
    );

    const results = await Promise.all(attempts);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(99);
  });

  it('should handle concurrent reimbursement attempts without overpayment', async () => {
    let balance = new Prisma.Decimal(100);
    let totalPaid = new Prisma.Decimal(0);

    prisma.expenseClaim.findFirst.mockImplementation(() => ({
      id: 'claim-reimb-conc',
      organizationId: orgId,
      claimNumber: 'EX-000001',
      claimantId: 'claimant-1',
      currencyId: 'cur-usd',
      status: ExpenseClaimStatus.POSTED,
      approvedAmount: new Prisma.Decimal(100),
      paidAmount: totalPaid,
      dueAmount: balance,
      claimant: { name: 'Alice' },
    }));

    prisma.expenseClaim.findUnique.mockImplementation(() => ({
      id: 'claim-reimb-conc',
      organizationId: orgId,
      claimNumber: 'EX-000001',
      currencyId: 'cur-usd',
      status: ExpenseClaimStatus.POSTED,
      approvedAmount: new Prisma.Decimal(100),
      paidAmount: totalPaid,
      dueAmount: balance,
      claimant: { name: 'Alice' },
    }));

    let mutex = Promise.resolve();
    prisma.$transaction.mockImplementation((cb: any) => {
      const runWithLock = () => {
        return cb({
          ...prisma,
          expenseClaim: {
            ...prisma.expenseClaim,
            findUnique: jest.fn().mockImplementation(() => ({
              id: 'claim-reimb-conc',
              organizationId: orgId,
              claimNumber: 'EX-000001',
              currencyId: 'cur-usd',
              status: ExpenseClaimStatus.POSTED,
              approvedAmount: new Prisma.Decimal(100),
              paidAmount: totalPaid,
              dueAmount: balance,
              claimant: { name: 'Alice' },
            })),
            update: jest.fn().mockImplementation(({ data }) => {
              if (data.dueAmount) {
                balance = data.dueAmount;
              }
              if (data.paidAmount) {
                totalPaid = data.paidAmount;
              }
              return {
                id: 'claim-reimb-conc',
                organizationId: orgId,
                claimNumber: 'EX-000001',
                status: balance.isZero()
                  ? ExpenseClaimStatus.PAID
                  : ExpenseClaimStatus.POSTED,
                totalAmount: new Prisma.Decimal(100),
                paidAmount: totalPaid,
                dueAmount: balance,
                claimant: { name: 'Alice' },
                currency: { id: 'cur-usd' },
                lines: [],
              };
            }),
          },
        });
      };

      const result = mutex.then(runWithLock);
      mutex = result.catch(() => {});
      return result;
    });

    // Concurrency test: 100 workers attempting to reimburse $10 each on a $100 claim
    // At most 10 can succeed, and total paid will equal 100
    const attempts = Array.from({ length: 100 }, () =>
      reimbursementsService
        .reimburse(
          orgId,
          'claim-reimb-conc',
          {
            paymentAccountId: 'pay-acc-1',
            amount: 10,
            paymentDate: '2026-08-21',
          },
          userId,
        )
        .then((res) => ({ status: 'fulfilled', res }))
        .catch((err) => ({ status: 'rejected', reason: err.message })),
    );

    const results = await Promise.all(attempts);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');

    expect(fulfilled.length).toBe(10);
    expect(totalPaid.toNumber()).toBe(100);
    expect(balance.toNumber()).toBe(0);
  });
});
