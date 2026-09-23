import { Test, TestingModule } from '@nestjs/testing';
import { BankAccountsService } from './accounts/bank-accounts.service';
import { BankStatementsService } from './statements/bank-statements.service';
import { BankMatchingService } from './matching/bank-matching.service';
import { BankReconciliationService } from './reconciliation/bank-reconciliation.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { NotFoundException } from '@nestjs/common';

describe('Tenant Banking & Reconciliation Isolation', () => {
  let accountsService: BankAccountsService;
  let statementsService: BankStatementsService;
  let matchingService: BankMatchingService;
  let reconciliationService: BankReconciliationService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;

  const orgA = '11111111-1111-1111-1111-111111111111';
  const userA = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
      bankAccountProfile: { findFirst: jest.fn() },
      bankStatement: { findFirst: jest.fn() },
      bankStatementTransaction: { findFirst: jest.fn() },
      bankReconciliation: { findFirst: jest.fn() },
      payment: { findFirst: jest.fn() },
      journalEntry: { findFirst: jest.fn() },
    };

    eventBusMock = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'NUM-001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankAccountsService,
        BankStatementsService,
        BankMatchingService,
        BankReconciliationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
      ],
    }).compile();

    accountsService = module.get<BankAccountsService>(BankAccountsService);
    statementsService = module.get<BankStatementsService>(
      BankStatementsService,
    );
    matchingService = module.get<BankMatchingService>(BankMatchingService);
    reconciliationService = module.get<BankReconciliationService>(
      BankReconciliationService,
    );
  });

  it('1. Org A cannot find Org B bank account profile', async () => {
    prismaMock.bankAccountProfile.findFirst.mockResolvedValue(null);

    await expect(accountsService.findOne(orgA, 'bap-org-b')).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.bankAccountProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bap-org-b', organizationId: orgA, deletedAt: null },
      }),
    );
  });

  it('2. Org A cannot find Org B bank statement', async () => {
    prismaMock.bankStatement.findFirst.mockResolvedValue(null);

    await expect(statementsService.findOne(orgA, 'stmt-org-b')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('3. Org A cannot import transactions into Org B bank statement', async () => {
    prismaMock.bankStatement.findFirst.mockResolvedValue(null);

    await expect(
      statementsService.importTransactions(
        orgA,
        'stmt-org-b',
        { transactions: [] },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('4. Org A cannot match transaction against Org B Payment', async () => {
    prismaMock.bankStatementTransaction.findFirst.mockResolvedValue({
      id: 'txn-1',
      bankStatement: { paymentAccountId: 'pa-1', status: 'IMPORTED' },
      amount: 100,
    });
    prismaMock.payment.findFirst.mockResolvedValue(null); // Not found in Org A

    await expect(
      matchingService.matchPayment(orgA, 'txn-1', 'pay-org-b', userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('5. Org A cannot complete Org B bank reconciliation', async () => {
    prismaMock.bankReconciliation.findFirst.mockResolvedValue(null);

    await expect(
      reconciliationService.complete(orgA, 'rec-org-b', userA),
    ).rejects.toThrow(NotFoundException);
  });
});
