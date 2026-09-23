import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './transactions/payments.service';
import { PaymentAccountsService } from './accounts/payment-accounts.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { NotFoundException } from '@nestjs/common';
import { PaymentType } from '@prisma/client';

describe('Tenant Payment & Settlement Isolation', () => {
  let paymentsService: PaymentsService;
  let accountsService: PaymentAccountsService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;
  let mappingMock: any;

  const orgA = '11111111-1111-1111-1111-111111111111';
  const userA = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
      account: { findFirst: jest.fn() },
      currency: { findFirst: jest.fn() },
      paymentAccount: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      payment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      customerInvoice: { findFirst: jest.fn() },
      supplierInvoice: { findFirst: jest.fn() },
    };

    eventBusMock = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'RC-000001' }),
    };
    mappingMock = { resolveAccount: jest.fn().mockResolvedValue('acc-id') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        PaymentAccountsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
        { provide: ApAccountMappingService, useValue: mappingMock },
      ],
    }).compile();

    paymentsService = module.get<PaymentsService>(PaymentsService);
    accountsService = module.get<PaymentAccountsService>(
      PaymentAccountsService,
    );
  });

  it('1. Org A cannot find Org B payment account by ID', async () => {
    prismaMock.paymentAccount.findFirst.mockResolvedValue(null);

    await expect(accountsService.findOne(orgA, 'pa-org-b')).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.paymentAccount.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pa-org-b', organizationId: orgA, deletedAt: null },
      }),
    );
  });

  it('2. Org A cannot create payment referencing Org B payment account', async () => {
    prismaMock.paymentAccount.findFirst.mockResolvedValue(null);

    await expect(
      paymentsService.create(
        orgA,
        {
          type: PaymentType.RECEIPT,
          paymentAccountId: 'pa-org-b',
          paymentDate: '2026-08-01',
          amount: 500,
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('3. Org A cannot find Org B payment', async () => {
    prismaMock.payment.findFirst.mockResolvedValue(null);

    await expect(paymentsService.findOne(orgA, 'pay-org-b')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('4. Org A cannot post Org B payment', async () => {
    prismaMock.payment.findFirst.mockResolvedValue(null);

    await expect(
      paymentsService.post(orgA, 'pay-org-b', userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('5. Org A cannot allocate to Org B customer invoice', async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      id: 'pay-1',
      type: PaymentType.RECEIPT,
      status: 'POSTED',
      amount: 1000,
      unallocatedAmount: 1000,
      currencyId: 'c-1',
    });

    prismaMock.customerInvoice.findFirst.mockResolvedValue(null);

    await expect(
      paymentsService.allocate(
        orgA,
        'pay-1',
        {
          allocations: [{ customerInvoiceId: 'inv-org-b', amount: 500 }],
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("6. Org A's unallocated receivables query strictly filters by Org A", async () => {
    prismaMock.payment.findMany.mockResolvedValue([]);

    await paymentsService.getUnallocatedReceivables(orgA);

    expect(prismaMock.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: orgA,
        }),
      }),
    );
  });
});
