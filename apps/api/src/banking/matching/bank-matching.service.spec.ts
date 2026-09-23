import { Test, TestingModule } from '@nestjs/testing';
import { BankMatchingService } from './bank-matching.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BadRequestException } from '@nestjs/common';
import {
  BankTransactionStatus,
  BankStatementStatus,
  PaymentStatus,
  FiscalPeriodStatus,
  Prisma,
} from '@prisma/client';

describe('BankMatchingService', () => {
  let service: BankMatchingService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockPaymentAccountId = '22222222-2222-2222-2222-222222222222';
  const mockTxnId = '33333333-3333-3333-3333-333333333333';
  const mockPaymentId = '44444444-4444-4444-4444-444444444444';
  const mockUserId = '55555555-5555-5555-5555-555555555555';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
      bankStatementTransaction: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      journalEntry: {
        findFirst: jest.fn(),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'gl-1', entryNumber: 'JE-000001' }),
        count: jest.fn().mockResolvedValue(0),
      },
      journalLine: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      account: {
        findFirst: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'JE-000001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankMatchingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
      ],
    }).compile();

    service = module.get<BankMatchingService>(BankMatchingService);
  });

  it('1. should match statement transaction to valid Payment', async () => {
    prismaMock.bankStatementTransaction.findFirst.mockImplementation(
      (args: any) => {
        if (args?.where?.matchedPaymentId) {
          return Promise.resolve(null);
        }
        return Promise.resolve({
          id: mockTxnId,
          amount: new Prisma.Decimal('1000.0000'),
          status: BankTransactionStatus.UNMATCHED,
          bankStatement: {
            id: 'stmt-1',
            paymentAccountId: mockPaymentAccountId,
            status: BankStatementStatus.IMPORTED,
          },
        });
      },
    );

    prismaMock.payment.findFirst.mockResolvedValue({
      id: mockPaymentId,
      paymentNumber: 'RC-000001',
      paymentAccountId: mockPaymentAccountId,
      amount: new Prisma.Decimal('1000.0000'),
      status: PaymentStatus.POSTED,
    });

    prismaMock.bankStatementTransaction.update.mockResolvedValue({
      id: mockTxnId,
      status: BankTransactionStatus.MATCHED,
      matchedPaymentId: mockPaymentId,
    });

    const result = await service.matchPayment(
      mockOrgId,
      mockTxnId,
      mockPaymentId,
      mockUserId,
    );

    expect(result.status).toBe(BankTransactionStatus.MATCHED);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'BANK_TRANSACTION_MATCHED' }),
    );
  });

  it('2. should reject matching if Payment amount differs from transaction amount', async () => {
    prismaMock.bankStatementTransaction.findFirst.mockResolvedValue({
      id: mockTxnId,
      amount: new Prisma.Decimal('1000.0000'),
      status: BankTransactionStatus.UNMATCHED,
      bankStatement: {
        paymentAccountId: mockPaymentAccountId,
        status: BankStatementStatus.IMPORTED,
      },
    });

    prismaMock.payment.findFirst.mockResolvedValue({
      id: mockPaymentId,
      paymentAccountId: mockPaymentAccountId,
      amount: new Prisma.Decimal('500.0000'), // Mismatch!
      status: PaymentStatus.POSTED,
    });

    await expect(
      service.matchPayment(mockOrgId, mockTxnId, mockPaymentId, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should unmatch previously matched transaction', async () => {
    prismaMock.bankStatementTransaction.findFirst.mockResolvedValue({
      id: mockTxnId,
      status: BankTransactionStatus.MATCHED,
      bankStatement: {
        status: BankStatementStatus.IMPORTED,
      },
    });

    prismaMock.bankStatementTransaction.update.mockResolvedValue({
      id: mockTxnId,
      status: BankTransactionStatus.UNMATCHED,
      matchedPaymentId: null,
    });

    const result = await service.unmatch(mockOrgId, mockTxnId, mockUserId);
    expect(result.status).toBe(BankTransactionStatus.UNMATCHED);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'BANK_TRANSACTION_UNMATCHED' }),
    );
  });

  it('4. should post bank charge adjustment with balanced GL journal (Debit Expense, Credit Bank)', async () => {
    prismaMock.bankStatementTransaction.findFirst.mockResolvedValue({
      id: mockTxnId,
      description: 'Monthly Service Fee',
      debitAmount: new Prisma.Decimal('25.0000'),
      creditAmount: new Prisma.Decimal('0.0000'),
      amount: new Prisma.Decimal('25.0000'),
      transactionDate: new Date('2026-08-01'),
      status: BankTransactionStatus.UNMATCHED,
      bankStatement: {
        statementNumber: 'BS-000001',
        status: BankStatementStatus.IMPORTED,
        paymentAccount: { accountingAccountId: 'acc-bank' },
      },
    });

    prismaMock.account.findFirst.mockResolvedValue({
      id: 'acc-expense',
      code: '6050',
      name: 'Bank Charges',
      isActive: true,
    });

    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      status: FiscalPeriodStatus.OPEN,
    });

    prismaMock.bankStatementTransaction.update.mockResolvedValue({
      id: mockTxnId,
      status: BankTransactionStatus.ADJUSTED,
    });

    const result = await service.postAdjustment(
      mockOrgId,
      mockTxnId,
      {
        adjustmentType: 'BANK_CHARGE',
        expenseOrIncomeAccountId: 'acc-expense',
      },
      mockUserId,
    );

    expect(result.status).toBe(BankTransactionStatus.ADJUSTED);
    expect(prismaMock.journalLine.createMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: mockOrgId,
          accountId: 'acc-expense',
          description: 'BANK_CHARGE: Monthly Service Fee (BS-000001)',
          debit: new Prisma.Decimal('25.0000'),
          credit: new Prisma.Decimal(0),
          lineNumber: 1,
          journalEntryId: 'gl-1',
        },
        {
          organizationId: mockOrgId,
          accountId: 'acc-bank',
          description: 'BANK_CHARGE: Monthly Service Fee (BS-000001)',
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal('25.0000'),
          lineNumber: 2,
          journalEntryId: 'gl-1',
        },
      ],
    });
  });
});
