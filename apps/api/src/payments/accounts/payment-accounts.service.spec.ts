import { Test, TestingModule } from '@nestjs/testing';
import { PaymentAccountsService } from './payment-accounts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { BadRequestException } from '@nestjs/common';
import { PaymentAccountType } from '@prisma/client';

describe('PaymentAccountsService', () => {
  let service: PaymentAccountsService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockAccountId = '22222222-2222-2222-2222-222222222222';
  const mockCurrencyId = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    prismaMock = {
      account: { findFirst: jest.fn() },
      currency: { findFirst: jest.fn() },
      paymentAccount: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      payment: { count: jest.fn() },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentAccountsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<PaymentAccountsService>(PaymentAccountsService);
  });

  it('1. should create payment account mapped to active GL account', async () => {
    prismaMock.account.findFirst.mockResolvedValue({
      id: mockAccountId,
      code: '1010',
      name: 'Main Cash',
      isActive: true,
    });

    prismaMock.currency.findFirst.mockResolvedValue({
      id: mockCurrencyId,
      code: 'USD',
      isActive: true,
    });

    prismaMock.paymentAccount.findFirst.mockResolvedValue(null);

    prismaMock.paymentAccount.create.mockResolvedValue({
      id: 'pa-1',
      organizationId: mockOrgId,
      code: 'CASH-MAIN',
      name: 'Main Office Cash',
      type: PaymentAccountType.CASH,
      currencyId: mockCurrencyId,
      accountingAccountId: mockAccountId,
      isActive: true,
    });

    const result = await service.create(mockOrgId, {
      code: 'CASH-MAIN',
      name: 'Main Office Cash',
      type: PaymentAccountType.CASH,
      currencyId: mockCurrencyId,
      accountingAccountId: mockAccountId,
    });

    expect(result.code).toBe('CASH-MAIN');
    expect(result.type).toBe(PaymentAccountType.CASH);
  });

  it('2. should reject creating payment account when GL account is inactive', async () => {
    prismaMock.account.findFirst.mockResolvedValue({
      id: mockAccountId,
      code: '1010',
      name: 'Main Cash',
      isActive: false,
    });

    await expect(
      service.create(mockOrgId, {
        code: 'CASH-MAIN',
        name: 'Main Office Cash',
        type: PaymentAccountType.CASH,
        currencyId: mockCurrencyId,
        accountingAccountId: mockAccountId,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should reject duplicate payment account code in organization', async () => {
    prismaMock.account.findFirst.mockResolvedValue({
      id: mockAccountId,
      code: '1010',
      name: 'Main Cash',
      isActive: true,
    });

    prismaMock.currency.findFirst.mockResolvedValue({
      id: mockCurrencyId,
      code: 'USD',
      isActive: true,
    });

    prismaMock.paymentAccount.findFirst.mockResolvedValue({
      id: 'pa-existing',
      code: 'CASH-MAIN',
    });

    await expect(
      service.create(mockOrgId, {
        code: 'CASH-MAIN',
        name: 'Main Office Cash',
        type: PaymentAccountType.CASH,
        currencyId: mockCurrencyId,
        accountingAccountId: mockAccountId,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
