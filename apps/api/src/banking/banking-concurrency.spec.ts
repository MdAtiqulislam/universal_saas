import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BankMatchingService } from './matching/bank-matching.service';
import { BankReconciliationService } from './reconciliation/bank-reconciliation.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import {
  BankTransactionStatus,
  BankStatementStatus,
  BankReconciliationStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

describe('Banking & Reconciliation Concurrency Guards', () => {
  let matchingService: BankMatchingService;
  let reconciliationService: BankReconciliationService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockTxnId = '22222222-2222-2222-2222-222222222222';
  const mockPaymentId = '33333333-3333-3333-3333-333333333333';
  const mockRecId = '44444444-4444-4444-4444-444444444444';
  const mockUserId = '55555555-5555-5555-5555-555555555555';

  const lock = {
    locked: false,
    async acquire<T>(fn: () => Promise<T>): Promise<T> {
      while (this.locked) {
        await new Promise((r) => setTimeout(r, 1));
      }
      this.locked = true;
      try {
        return await fn();
      } finally {
        this.locked = false;
      }
    },
  };

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb: any) => {
        return lock.acquire(async () => {
          await Promise.resolve();
          return cb(prismaMock);
        });
      }),
      bankStatementTransaction: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(),
      },
      bankReconciliation: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      bankStatement: {
        update: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankMatchingService,
        BankReconciliationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: { nextNumber: jest.fn() } },
      ],
    }).compile();

    matchingService = module.get<BankMatchingService>(BankMatchingService);
    reconciliationService = module.get<BankReconciliationService>(
      BankReconciliationService,
    );
  });

  it('1. 50 parallel match attempts against the same statement transaction should result in exactly 1 success and 49 failures', async () => {
    let isMatched = false;

    prismaMock.bankStatementTransaction.findFirst = jest
      .fn()
      .mockImplementation((args: any) => {
        if (args?.where?.matchedPaymentId) {
          return Promise.resolve(null);
        }
        return Promise.resolve({
          id: mockTxnId,
          organizationId: mockOrgId,
          amount: new Prisma.Decimal('1000.0000'),
          status: isMatched
            ? BankTransactionStatus.MATCHED
            : BankTransactionStatus.UNMATCHED,
          bankStatement: {
            id: 'stmt-1',
            paymentAccountId: 'pa-1',
            status: BankStatementStatus.IMPORTED,
          },
        });
      });

    prismaMock.payment.findFirst = jest.fn().mockResolvedValue({
      id: mockPaymentId,
      paymentAccountId: 'pa-1',
      amount: new Prisma.Decimal('1000.0000'),
      status: PaymentStatus.POSTED,
    });

    prismaMock.bankStatementTransaction.update = jest
      .fn()
      .mockImplementation(() => {
        if (isMatched) {
          throw new BadRequestException('Double match prevented');
        }
        isMatched = true;
        return Promise.resolve({
          id: mockTxnId,
          status: BankTransactionStatus.MATCHED,
        });
      });

    const attempts = Array.from({ length: 50 }, () =>
      matchingService
        .matchPayment(mockOrgId, mockTxnId, mockPaymentId, mockUserId)
        .then(() => ({ success: true, error: null as any }))
        .catch((err) => ({ success: false, error: err })),
    );

    const outcomes = await Promise.all(attempts);
    const successes = outcomes.filter((o) => o.success);
    const failures = outcomes.filter((o) => !o.success);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(49);
  });

  it('2. 20 parallel reconciliation completion attempts should result in exactly 1 success and 19 failures', async () => {
    let isCompleted = false;

    prismaMock.bankReconciliation.findFirst = jest
      .fn()
      .mockImplementation(() => {
        return Promise.resolve({
          id: mockRecId,
          status: isCompleted
            ? BankReconciliationStatus.COMPLETED
            : BankReconciliationStatus.OPEN,
          statement: {
            id: 'stmt-1',
            openingBalance: new Prisma.Decimal('10000.0000'),
            closingBalance: new Prisma.Decimal('15000.0000'),
            transactions: [
              {
                id: 't1',
                creditAmount: new Prisma.Decimal('5000.0000'),
                amount: new Prisma.Decimal('5000.0000'),
                status: BankTransactionStatus.MATCHED,
              },
            ],
          },
          paymentAccount: { id: 'pa-1' },
        });
      });

    prismaMock.bankReconciliation.update = jest.fn().mockImplementation(() => {
      if (isCompleted) {
        throw new BadRequestException('Already completed');
      }
      isCompleted = true;
      return Promise.resolve({
        id: mockRecId,
        status: BankReconciliationStatus.COMPLETED,
      });
    });

    const attempts = Array.from({ length: 20 }, () =>
      reconciliationService
        .complete(mockOrgId, mockRecId, mockUserId)
        .then(() => ({ success: true, error: null as any }))
        .catch((err) => ({ success: false, error: err })),
    );

    const outcomes = await Promise.all(attempts);
    const successes = outcomes.filter((o) => o.success);
    const failures = outcomes.filter((o) => !o.success);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(19);
  });
});
