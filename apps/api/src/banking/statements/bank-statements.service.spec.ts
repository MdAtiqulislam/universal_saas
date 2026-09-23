import { Test, TestingModule } from '@nestjs/testing';
import { BankStatementsService } from './bank-statements.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BadRequestException } from '@nestjs/common';
import { BankStatementStatus, Prisma } from '@prisma/client';

describe('BankStatementsService', () => {
  let service: BankStatementsService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockPaymentAccountId = '22222222-2222-2222-2222-222222222222';
  const mockCurrencyId = '33333333-3333-3333-3333-333333333333';
  const mockStatementId = '44444444-4444-4444-4444-444444444444';
  const mockUserId = '55555555-5555-5555-5555-555555555555';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
      paymentAccount: { findFirst: jest.fn() },
      currency: { findFirst: jest.fn() },
      bankStatement: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      bankStatementTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'BS-000001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankStatementsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
      ],
    }).compile();

    service = module.get<BankStatementsService>(BankStatementsService);
  });

  it('1. should create bank statement in DRAFT status with BS- prefix', async () => {
    prismaMock.paymentAccount.findFirst.mockResolvedValue({
      id: mockPaymentAccountId,
      currencyId: mockCurrencyId,
      isActive: true,
    });
    prismaMock.currency.findFirst.mockResolvedValue({
      id: mockCurrencyId,
      isActive: true,
    });

    prismaMock.bankStatement.create.mockResolvedValue({
      id: mockStatementId,
      statementNumber: 'BS-000001',
      status: BankStatementStatus.DRAFT,
      openingBalance: new Prisma.Decimal('10000.0000'),
      closingBalance: new Prisma.Decimal('15000.0000'),
    });

    const result = await service.create(
      mockOrgId,
      {
        paymentAccountId: mockPaymentAccountId,
        statementDate: '2026-08-01',
        openingBalance: 10000,
        closingBalance: 15000,
      },
      mockUserId,
    );

    expect(result.statementNumber).toBe('BS-000001');
    expect(result.status).toBe(BankStatementStatus.DRAFT);
  });

  it('2. should import batch statement transactions and transition status to IMPORTED', async () => {
    prismaMock.bankStatement.findFirst.mockResolvedValue({
      id: mockStatementId,
      statementNumber: 'BS-000001',
      status: BankStatementStatus.DRAFT,
    });

    const result = await service.importTransactions(
      mockOrgId,
      mockStatementId,
      {
        transactions: [
          {
            transactionDate: '2026-08-01',
            description: 'Customer Wire Receipt',
            creditAmount: 5000,
            debitAmount: 0,
            amount: 5000,
          },
          {
            transactionDate: '2026-08-02',
            description: 'Monthly Service Fee',
            creditAmount: 0,
            debitAmount: 50,
            amount: 50,
          },
        ],
      },
      mockUserId,
    );

    expect(result.importedCount).toBe(2);
    expect(prismaMock.bankStatementTransaction.createMany).toHaveBeenCalled();
  });

  it('3. should reject transactions violating debit/credit XOR constraint', async () => {
    prismaMock.bankStatement.findFirst.mockResolvedValue({
      id: mockStatementId,
      status: BankStatementStatus.DRAFT,
    });

    await expect(
      service.importTransactions(
        mockOrgId,
        mockStatementId,
        {
          transactions: [
            {
              transactionDate: '2026-08-01',
              description: 'Invalid item',
              creditAmount: 5000,
              debitAmount: 100, // Both non-zero!
            },
          ],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('4. should reject duplicate externalTransactionId within import batch', async () => {
    prismaMock.bankStatement.findFirst.mockResolvedValue({
      id: mockStatementId,
      status: BankStatementStatus.DRAFT,
    });

    await expect(
      service.importTransactions(
        mockOrgId,
        mockStatementId,
        {
          transactions: [
            {
              transactionDate: '2026-08-01',
              description: 'Item 1',
              creditAmount: 100,
              externalTransactionId: 'EXT-DUP-1',
            },
            {
              transactionDate: '2026-08-02',
              description: 'Item 2',
              creditAmount: 200,
              externalTransactionId: 'EXT-DUP-1', // Duplicate!
            },
          ],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
