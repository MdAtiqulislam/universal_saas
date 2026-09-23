import { Test, TestingModule } from '@nestjs/testing';
import { BankReconciliationService } from './bank-reconciliation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BadRequestException } from '@nestjs/common';
import {
  BankReconciliationStatus,
  BankStatementStatus,
  BankTransactionStatus,
  Prisma,
} from '@prisma/client';

describe('BankReconciliationService', () => {
  let service: BankReconciliationService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockPaymentAccountId = '22222222-2222-2222-2222-222222222222';
  const mockStatementId = '33333333-3333-3333-3333-333333333333';
  const mockRecId = '44444444-4444-4444-4444-444444444444';
  const mockUserId = '55555555-5555-5555-5555-555555555555';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
      bankStatement: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      bankReconciliation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'REC-000001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankReconciliationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
      ],
    }).compile();

    service = module.get<BankReconciliationService>(BankReconciliationService);
  });

  it('1. should create bank reconciliation session and transition statement to RECONCILING', async () => {
    prismaMock.bankStatement.findFirst.mockResolvedValue({
      id: mockStatementId,
      organizationId: mockOrgId,
      paymentAccountId: mockPaymentAccountId,
      status: BankStatementStatus.IMPORTED,
      openingBalance: new Prisma.Decimal('10000.0000'),
      closingBalance: new Prisma.Decimal('15000.0000'),
      transactions: [],
    });

    prismaMock.bankReconciliation.findFirst.mockResolvedValue(null);

    prismaMock.bankReconciliation.create.mockResolvedValue({
      id: mockRecId,
      reconciliationNumber: 'REC-000001',
      status: BankReconciliationStatus.OPEN,
      bookBalance: new Prisma.Decimal('10000.0000'),
      statementBalance: new Prisma.Decimal('15000.0000'),
    });

    const result = await service.create(
      mockOrgId,
      {
        statementId: mockStatementId,
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31',
      },
      mockUserId,
    );

    expect(result.reconciliationNumber).toBe('REC-000001');
    expect(result.status).toBe(BankReconciliationStatus.OPEN);
    expect(prismaMock.bankStatement.update).toHaveBeenCalledWith({
      where: { id: mockStatementId },
      data: { status: BankStatementStatus.RECONCILING },
    });
  });

  it('2. should complete reconciliation when all transactions are matched and difference is 0, locking statement', async () => {
    prismaMock.bankReconciliation.findFirst.mockResolvedValue({
      id: mockRecId,
      status: BankReconciliationStatus.OPEN,
      statement: {
        id: mockStatementId,
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
      paymentAccount: { id: mockPaymentAccountId },
    });

    prismaMock.bankReconciliation.update.mockResolvedValue({
      id: mockRecId,
      status: BankReconciliationStatus.COMPLETED,
    });

    const result = await service.complete(mockOrgId, mockRecId, mockUserId);
    expect(result.status).toBe(BankReconciliationStatus.COMPLETED);
    expect(prismaMock.bankStatement.update).toHaveBeenCalledWith({
      where: { id: mockStatementId },
      data: { status: BankStatementStatus.LOCKED },
    });
  });

  it('3. should reject completing reconciliation if unmatched transactions remain', async () => {
    prismaMock.bankReconciliation.findFirst.mockResolvedValue({
      id: mockRecId,
      status: BankReconciliationStatus.OPEN,
      statement: {
        id: mockStatementId,
        openingBalance: new Prisma.Decimal('10000.0000'),
        closingBalance: new Prisma.Decimal('15000.0000'),
        transactions: [
          {
            id: 't1',
            status: BankTransactionStatus.UNMATCHED,
          },
        ],
      },
    });

    await expect(
      service.complete(mockOrgId, mockRecId, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });

  it('4. should cancel open reconciliation session and revert statement status to IMPORTED', async () => {
    prismaMock.bankReconciliation.findFirst.mockResolvedValue({
      id: mockRecId,
      status: BankReconciliationStatus.OPEN,
      statement: { id: mockStatementId },
      paymentAccount: { id: mockPaymentAccountId },
    });

    prismaMock.bankReconciliation.update.mockResolvedValue({
      id: mockRecId,
      status: BankReconciliationStatus.CANCELLED,
    });

    const result = await service.cancel(mockOrgId, mockRecId, mockUserId);
    expect(result.status).toBe(BankReconciliationStatus.CANCELLED);
    expect(prismaMock.bankStatement.update).toHaveBeenCalledWith({
      where: { id: mockStatementId },
      data: { status: BankStatementStatus.IMPORTED },
    });
  });
});
