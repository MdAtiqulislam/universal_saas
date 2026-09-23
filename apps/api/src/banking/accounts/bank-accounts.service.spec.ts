import { Test, TestingModule } from '@nestjs/testing';
import { BankAccountsService } from './bank-accounts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { BadRequestException } from '@nestjs/common';
import { PaymentAccountType } from '@prisma/client';

describe('BankAccountsService', () => {
  let service: BankAccountsService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockPaymentAccountId = '22222222-2222-2222-2222-222222222222';
  const mockCurrencyId = '33333333-3333-3333-3333-333333333333';
  const mockUserId = '44444444-4444-4444-4444-444444444444';

  beforeEach(async () => {
    prismaMock = {
      paymentAccount: { findFirst: jest.fn() },
      currency: { findFirst: jest.fn() },
      bankAccountProfile: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankAccountsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<BankAccountsService>(BankAccountsService);
  });

  it('1. should create bank account profile for active payment account', async () => {
    prismaMock.paymentAccount.findFirst.mockResolvedValue({
      id: mockPaymentAccountId,
      code: 'BANK-CORP',
      name: 'Corporate Bank Account',
      type: PaymentAccountType.BANK,
      currencyId: mockCurrencyId,
      isActive: true,
    });

    prismaMock.bankAccountProfile.findFirst.mockResolvedValue(null);
    prismaMock.currency.findFirst.mockResolvedValue({
      id: mockCurrencyId,
      isActive: true,
    });

    prismaMock.bankAccountProfile.create.mockResolvedValue({
      id: 'bap-1',
      organizationId: mockOrgId,
      paymentAccountId: mockPaymentAccountId,
      bankName: 'First National Bank',
      accountNumberMasked: '****1234',
      accountHolderName: 'Acme Corp Ltd',
    });

    const result = await service.create(
      mockOrgId,
      {
        paymentAccountId: mockPaymentAccountId,
        bankName: 'First National Bank',
        accountNumberMasked: '****1234',
        accountHolderName: 'Acme Corp Ltd',
      },
      mockUserId,
    );

    expect(result.bankName).toBe('First National Bank');
    expect(result.accountNumberMasked).toBe('****1234');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'BANK_ACCOUNT_CREATED' }),
    );
  });

  it('2. should reject creating bank account profile if payment account is inactive', async () => {
    prismaMock.paymentAccount.findFirst.mockResolvedValue({
      id: mockPaymentAccountId,
      code: 'BANK-CORP',
      name: 'Corporate Bank Account',
      isActive: false,
    });

    await expect(
      service.create(
        mockOrgId,
        {
          paymentAccountId: mockPaymentAccountId,
          bankName: 'First National Bank',
          accountNumberMasked: '****1234',
          accountHolderName: 'Acme Corp Ltd',
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should reject duplicate masked account number in organization', async () => {
    prismaMock.paymentAccount.findFirst.mockResolvedValue({
      id: mockPaymentAccountId,
      code: 'BANK-CORP',
      name: 'Corporate Bank Account',
      isActive: true,
      currencyId: mockCurrencyId,
    });

    prismaMock.bankAccountProfile.findFirst
      .mockResolvedValueOnce(null) // No existing profile for payment account
      .mockResolvedValueOnce({ id: 'bap-existing' }); // Existing masked number in org

    await expect(
      service.create(
        mockOrgId,
        {
          paymentAccountId: mockPaymentAccountId,
          bankName: 'First National Bank',
          accountNumberMasked: '****1234',
          accountHolderName: 'Acme Corp Ltd',
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
