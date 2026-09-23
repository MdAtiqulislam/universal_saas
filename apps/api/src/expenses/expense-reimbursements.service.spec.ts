import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseReimbursementsService } from './expense-reimbursements.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { BadRequestException } from '@nestjs/common';
import {
  Prisma,
  ExpenseClaimStatus,
  PaymentType,
  PaymentStatus,
  FiscalPeriodStatus,
} from '@prisma/client';

describe('ExpenseReimbursementsService', () => {
  let service: ExpenseReimbursementsService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;
  let accountMappingService: any;

  const orgId = 'org-test-1';
  const userId = 'user-test-1';

  beforeEach(async () => {
    prisma = {
      expenseClaim: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      paymentAccount: {
        findFirst: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
      },
      payment: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn(),
      },
      paymentAllocation: {
        create: jest.fn(),
      },
      journalEntry: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingService = {
      nextNumber: jest
        .fn()
        .mockResolvedValueOnce({ formatted: 'PAY-000001' })
        .mockResolvedValueOnce({ formatted: 'JE-PAY-000001' }),
    };

    accountMappingService = {
      resolveAccount: jest.fn().mockResolvedValue('acc-payable'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseReimbursementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: ApAccountMappingService, useValue: accountMappingService },
      ],
    }).compile();

    service = module.get<ExpenseReimbursementsService>(
      ExpenseReimbursementsService,
    );
  });

  it('should process full reimbursement successfully and transition claim to PAID', async () => {
    const claim = {
      id: 'claim-1',
      organizationId: orgId,
      claimNumber: 'EX-000001',
      claimantId: 'claimant-1',
      currencyId: 'cur-usd',
      status: ExpenseClaimStatus.POSTED,
      approvedAmount: new Prisma.Decimal(100),
      paidAmount: new Prisma.Decimal(0),
      dueAmount: new Prisma.Decimal(100),
      claimant: { name: 'Alice' },
    };

    prisma.expenseClaim.findFirst.mockResolvedValue(claim);
    prisma.expenseClaim.findUnique.mockResolvedValue(claim);

    prisma.paymentAccount.findFirst.mockResolvedValue({
      id: 'pay-acc-1',
      organizationId: orgId,
      name: 'Operating Bank Account',
      accountingAccountId: 'acc-bank',
      isActive: true,
    });

    prisma.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'fp-1',
      status: FiscalPeriodStatus.OPEN,
    });

    prisma.journalEntry.create.mockResolvedValue({ id: 'je-pay-1' });
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      paymentNumber: 'PAY-000001',
      type: PaymentType.REIMBURSEMENT,
      status: PaymentStatus.ALLOCATED,
    });
    prisma.paymentAllocation.create.mockResolvedValue({ id: 'alloc-1' });
    prisma.expenseClaim.update.mockResolvedValue({
      ...claim,
      status: ExpenseClaimStatus.PAID,
      paidAmount: new Prisma.Decimal(100),
      dueAmount: new Prisma.Decimal(0),
    });

    const result = await service.reimburse(
      orgId,
      'claim-1',
      {
        paymentAccountId: 'pay-acc-1',
        amount: 100,
        paymentDate: '2026-08-21',
      },
      userId,
    );

    expect(result.payment.id).toBe('pay-1');
    expect(result.claim.status).toBe(ExpenseClaimStatus.PAID);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'EXPENSE_REIMBURSEMENT_POSTED' }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'EXPENSE_CLAIM_PAID' }),
    );
  });

  it('should process partial reimbursement and keep claim status as POSTED with updated balance', async () => {
    const claim = {
      id: 'claim-1',
      organizationId: orgId,
      claimNumber: 'EX-000001',
      claimantId: 'claimant-1',
      currencyId: 'cur-usd',
      status: ExpenseClaimStatus.POSTED,
      approvedAmount: new Prisma.Decimal(100),
      paidAmount: new Prisma.Decimal(0),
      dueAmount: new Prisma.Decimal(100),
      claimant: { name: 'Alice' },
    };

    prisma.expenseClaim.findFirst.mockResolvedValue(claim);
    prisma.expenseClaim.findUnique.mockResolvedValue(claim);

    prisma.paymentAccount.findFirst.mockResolvedValue({
      id: 'pay-acc-1',
      organizationId: orgId,
      name: 'Operating Bank Account',
      accountingAccountId: 'acc-bank',
      isActive: true,
    });

    prisma.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'fp-1',
      status: FiscalPeriodStatus.OPEN,
    });

    prisma.journalEntry.create.mockResolvedValue({ id: 'je-pay-1' });
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      paymentNumber: 'PAY-000001',
    });
    prisma.paymentAllocation.create.mockResolvedValue({ id: 'alloc-1' });
    prisma.expenseClaim.update.mockResolvedValue({
      ...claim,
      status: ExpenseClaimStatus.POSTED,
      paidAmount: new Prisma.Decimal(40),
      dueAmount: new Prisma.Decimal(60),
    });

    const result = await service.reimburse(
      orgId,
      'claim-1',
      {
        paymentAccountId: 'pay-acc-1',
        amount: 40,
        paymentDate: '2026-08-21',
      },
      userId,
    );

    expect(result.claim.dueAmount.toNumber()).toBe(60);
    expect(result.claim.paidAmount.toNumber()).toBe(40);
  });

  it('should prevent overpayment when reimbursement amount exceeds dueAmount', async () => {
    const claim = {
      id: 'claim-1',
      organizationId: orgId,
      claimNumber: 'EX-000001',
      status: ExpenseClaimStatus.POSTED,
      approvedAmount: new Prisma.Decimal(100),
      paidAmount: new Prisma.Decimal(80),
      dueAmount: new Prisma.Decimal(20),
    };

    prisma.expenseClaim.findFirst.mockResolvedValue(claim);

    await expect(
      service.reimburse(
        orgId,
        'claim-1',
        {
          paymentAccountId: 'pay-acc-1',
          amount: 50, // Exceeds 20
          paymentDate: '2026-08-21',
        },
        userId,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
