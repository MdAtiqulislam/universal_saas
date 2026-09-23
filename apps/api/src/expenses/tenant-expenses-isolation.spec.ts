import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseClaimantsService } from './expense-claimants.service';
import { ExpenseClaimsService } from './expense-claims.service';
import { ExpenseReimbursementsService } from './expense-reimbursements.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { TaxRatesService } from '../tax/tax-rates.service';
import { TaxTransactionsService } from '../tax/tax-transactions.service';
import { NotFoundException } from '@nestjs/common';

describe('Tenant Isolation — Expense Management (M21)', () => {
  let categoriesService: ExpenseCategoriesService;
  let claimantsService: ExpenseClaimantsService;
  let claimsService: ExpenseClaimsService;
  let reimbursementsService: ExpenseReimbursementsService;
  let prisma: any;

  const orgA = 'org-tenant-a';
  const orgB = 'org-tenant-b';
  const userA = 'user-a';

  beforeEach(async () => {
    prisma = {
      expenseCategory: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      expenseClaimant: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      expenseClaim: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      currency: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cur-usd' }),
      },
      paymentAccount: {
        findFirst: jest.fn(),
      },
      account: {
        findFirst: jest.fn(),
      },
      taxCode: {
        findFirst: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
      },
      journalEntry: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      payment: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      paymentAllocation: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'NUM-001' }),
    };
    const accountMappingService = {
      resolveAccount: jest.fn().mockResolvedValue('acc-default'),
    };
    const taxRatesService = {
      findEffectiveRate: jest.fn().mockResolvedValue(null),
    };
    const taxTransactionsService = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseCategoriesService,
        ExpenseClaimantsService,
        ExpenseClaimsService,
        ExpenseReimbursementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: ApAccountMappingService, useValue: accountMappingService },
        { provide: TaxRatesService, useValue: taxRatesService },
        { provide: TaxTransactionsService, useValue: taxTransactionsService },
      ],
    }).compile();

    categoriesService = module.get<ExpenseCategoriesService>(
      ExpenseCategoriesService,
    );
    claimantsService = module.get<ExpenseClaimantsService>(
      ExpenseClaimantsService,
    );
    claimsService = module.get<ExpenseClaimsService>(ExpenseClaimsService);
    reimbursementsService = module.get<ExpenseReimbursementsService>(
      ExpenseReimbursementsService,
    );
  });

  it('1. Org A cannot read Org B expense categories', async () => {
    prisma.expenseCategory.findFirst.mockResolvedValue(null);
    await expect(
      categoriesService.findOne(orgA, `cat-${orgB}`),
    ).rejects.toThrow(NotFoundException);
  });

  it('2. Org A cannot update Org B expense categories', async () => {
    prisma.expenseCategory.findFirst.mockResolvedValue(null);
    await expect(
      categoriesService.update(orgA, `cat-${orgB}`, { name: 'Hacked' }, userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('3. Org A cannot delete Org B expense categories', async () => {
    prisma.expenseCategory.findFirst.mockResolvedValue(null);
    await expect(categoriesService.delete(orgA, `cat-${orgB}`)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('4. Org A cannot read Org B claimants', async () => {
    prisma.expenseClaimant.findFirst.mockResolvedValue(null);
    await expect(
      claimantsService.findOne(orgA, `claimant-${orgB}`),
    ).rejects.toThrow(NotFoundException);
  });

  it('5. Org A cannot update Org B claimants', async () => {
    prisma.expenseClaimant.findFirst.mockResolvedValue(null);
    await expect(
      claimantsService.update(orgA, `claimant-${orgB}`, { name: 'Hacked' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('6. Org A cannot create claim referencing Org B claimant', async () => {
    prisma.expenseClaimant.findFirst.mockResolvedValue(null); // Not found in Org A
    await expect(
      claimsService.create(
        orgA,
        {
          claimantId: `claimant-${orgB}`,
          claimDate: '2026-08-20',
          description: 'Cross-tenant claim',
          currencyId: 'cur-usd',
          lines: [
            {
              categoryId: 'cat-1',
              description: 'Item',
              expenseDate: '2026-08-20',
              quantity: 1,
              unitPrice: 10,
            },
          ],
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('7. Org A cannot create claim referencing Org B expense category', async () => {
    prisma.expenseClaimant.findFirst.mockResolvedValue({
      id: 'claimant-a',
      organizationId: orgA,
      isActive: true,
    });
    prisma.expenseCategory.findMany.mockResolvedValue([]); // Org B category not returned for Org A

    await expect(
      claimsService.create(
        orgA,
        {
          claimantId: 'claimant-a',
          claimDate: '2026-08-20',
          description: 'Test',
          currencyId: 'cur-usd',
          lines: [
            {
              categoryId: `cat-${orgB}`,
              description: 'Item',
              expenseDate: '2026-08-20',
              quantity: 1,
              unitPrice: 10,
            },
          ],
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('8. Org A cannot read Org B expense claims', async () => {
    prisma.expenseClaim.findFirst.mockResolvedValue(null);
    await expect(claimsService.findOne(orgA, `claim-${orgB}`)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('9. Org A cannot approve Org B expense claims', async () => {
    prisma.expenseClaim.findFirst.mockResolvedValue(null);
    await expect(
      claimsService.approve(orgA, `claim-${orgB}`, userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('10. Org A cannot reimburse Org B expense claims', async () => {
    prisma.expenseClaim.findFirst.mockResolvedValue(null);
    await expect(
      reimbursementsService.reimburse(
        orgA,
        `claim-${orgB}`,
        {
          paymentAccountId: 'pay-acc-a',
          amount: 50,
          paymentDate: '2026-08-21',
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
