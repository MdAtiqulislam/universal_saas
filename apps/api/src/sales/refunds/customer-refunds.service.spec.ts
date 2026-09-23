import { Test, TestingModule } from '@nestjs/testing';
import { CustomerRefundsService } from './customer-refunds.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../../ap/account-mapping/ap-account-mapping.service';
import {
  CreditNoteStatus,
  FiscalPeriodStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';

describe('CustomerRefundsService', () => {
  let service: CustomerRefundsService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let accountMappingMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    prismaMock = {
      customer: { findFirst: jest.fn() },
      paymentAccount: { findFirst: jest.fn() },
      currency: { findFirst: jest.fn() },
      customerCreditNote: { findFirst: jest.fn(), update: jest.fn() },
      customerRefund: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      fiscalPeriod: { findFirst: jest.fn() },
      journalEntry: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };

    eventBusMock = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'RF-000001' }),
    };
    accountMappingMock = {
      resolveAccount: jest.fn().mockResolvedValue('acc-ar'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerRefundsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        { provide: ApAccountMappingService, useValue: accountMappingMock },
      ],
    }).compile();

    service = module.get<CustomerRefundsService>(CustomerRefundsService);
  });

  it('1. should create a draft customer refund linked to credit note', async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      id: 'cust-1',
      name: 'Acme',
      isActive: true,
      currencyId: 'curr-usd',
    });
    prismaMock.paymentAccount.findFirst.mockResolvedValue({
      id: 'pay-acc-1',
      name: 'Main Bank',
      currencyId: 'curr-usd',
      isActive: true,
    });
    prismaMock.currency.findFirst.mockResolvedValue({
      id: 'curr-usd',
      code: 'USD',
      isActive: true,
    });
    prismaMock.customerCreditNote.findFirst.mockResolvedValue({
      id: 'cn-1',
      status: CreditNoteStatus.POSTED,
      remainingAmount: new Prisma.Decimal(500),
    });

    prismaMock.customerRefund.create.mockImplementation((args: any) => ({
      id: 'rf-1',
      ...args.data,
    }));

    const result = await service.create(
      mockOrgId,
      {
        customerId: 'cust-1',
        creditNoteId: 'cn-1',
        paymentAccountId: 'pay-acc-1',
        refundDate: '2026-08-28',
        amount: 200,
        reason: 'Customer requested bank refund',
      },
      mockUserId,
    );

    expect(result.amount.toString()).toBe('200');
    expect(result.status).toBe(RefundStatus.DRAFT);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'CUSTOMER_REFUND_CREATED' }),
    );
  });

  it('2. should post refund creating balanced GL entry and updating credit note remaining balance', async () => {
    prismaMock.customerRefund.findFirst.mockResolvedValue({
      id: 'rf-1',
      refundNumber: 'RF-000001',
      customerId: 'cust-1',
      creditNoteId: 'cn-1',
      paymentAccountId: 'pay-acc-1',
      refundDate: new Date('2026-08-28'),
      amount: new Prisma.Decimal(200),
      status: RefundStatus.DRAFT,
      customer: { id: 'cust-1', name: 'Acme' },
      paymentAccount: {
        id: 'pay-acc-1',
        name: 'Main Bank',
        accountingAccountId: 'acc-bank',
      },
    });

    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      status: FiscalPeriodStatus.OPEN,
    });

    prismaMock.journalEntry.create.mockResolvedValue({ id: 'je-rf-1' });

    prismaMock.customerCreditNote.findFirst.mockResolvedValue({
      id: 'cn-1',
      appliedAmount: new Prisma.Decimal(0),
      remainingAmount: new Prisma.Decimal(500),
    });

    prismaMock.customerRefund.update.mockResolvedValue({
      id: 'rf-1',
      status: RefundStatus.POSTED,
      journalEntryId: 'je-rf-1',
      amount: new Prisma.Decimal(200),
    });

    const result = await service.post(mockOrgId, 'rf-1', mockUserId);

    expect(result.status).toBe(RefundStatus.POSTED);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceType: 'CUSTOMER_REFUND',
          lines: {
            create: expect.arrayContaining([
              expect.objectContaining({
                accountId: 'acc-ar',
                debit: new Prisma.Decimal(200),
              }),
              expect.objectContaining({
                accountId: 'acc-bank',
                credit: new Prisma.Decimal(200),
              }),
            ]),
          },
        }),
      }),
    );
    expect(prismaMock.customerCreditNote.update).toHaveBeenCalledWith({
      where: { id: 'cn-1' },
      data: {
        appliedAmount: new Prisma.Decimal(200),
        remainingAmount: new Prisma.Decimal(300),
        status: CreditNoteStatus.PARTIALLY_APPLIED,
      },
    });
  });

  it('3. should void posted refund creating reversal GL entry and restoring credit note balance', async () => {
    prismaMock.customerRefund.findFirst.mockResolvedValue({
      id: 'rf-1',
      refundNumber: 'RF-000001',
      customerId: 'cust-1',
      creditNoteId: 'cn-1',
      refundDate: new Date('2026-08-28'),
      amount: new Prisma.Decimal(200),
      status: RefundStatus.POSTED,
      customer: { id: 'cust-1', name: 'Acme' },
      paymentAccount: {
        id: 'pay-acc-1',
        name: 'Main Bank',
        accountingAccountId: 'acc-bank',
      },
    });

    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      status: FiscalPeriodStatus.OPEN,
    });

    prismaMock.journalEntry.create.mockResolvedValue({ id: 'je-rev-rf-1' });

    prismaMock.customerCreditNote.findFirst.mockResolvedValue({
      id: 'cn-1',
      appliedAmount: new Prisma.Decimal(200),
      remainingAmount: new Prisma.Decimal(300),
    });

    prismaMock.customerRefund.update.mockResolvedValue({
      id: 'rf-1',
      status: RefundStatus.VOIDED,
    });

    const result = await service.void(mockOrgId, 'rf-1', mockUserId);
    expect(result.status).toBe(RefundStatus.VOIDED);
    expect(prismaMock.customerCreditNote.update).toHaveBeenCalledWith({
      where: { id: 'cn-1' },
      data: {
        appliedAmount: new Prisma.Decimal(0),
        remainingAmount: new Prisma.Decimal(500),
        status: CreditNoteStatus.POSTED,
      },
    });
  });
});
