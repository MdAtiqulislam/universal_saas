import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseClaimsService } from './expense-claims.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { TaxRatesService } from '../tax/tax-rates.service';
import { TaxTransactionsService } from '../tax/tax-transactions.service';
import { BadRequestException } from '@nestjs/common';
import { Prisma, ExpenseClaimStatus, FiscalPeriodStatus } from '@prisma/client';

describe('ExpenseClaimsService', () => {
  let service: ExpenseClaimsService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;
  let accountMappingService: any;
  let taxRatesService: any;
  let taxTransactionsService: any;

  const orgId = 'org-test-1';
  const userId = 'user-test-1';

  beforeEach(async () => {
    prisma = {
      expenseClaimant: {
        findFirst: jest.fn(),
      },
      currency: {
        findFirst: jest.fn(),
      },
      expenseCategory: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      expenseClaim: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
      },
      journalEntry: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      expenseReceipt: {
        create: jest.fn(),
      },
      expenseClaimLine: {
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'EX-000001' }),
    };

    accountMappingService = {
      resolveAccount: jest.fn().mockResolvedValue('acc-default'),
    };

    taxRatesService = {
      findEffectiveRate: jest.fn().mockResolvedValue({
        rate: new Prisma.Decimal(0.1),
      }),
    };

    taxTransactionsService = {
      record: jest.fn().mockResolvedValue({ id: 'tax-tx-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseClaimsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: ApAccountMappingService, useValue: accountMappingService },
        { provide: TaxRatesService, useValue: taxRatesService },
        { provide: TaxTransactionsService, useValue: taxTransactionsService },
      ],
    }).compile();

    service = module.get<ExpenseClaimsService>(ExpenseClaimsService);
  });

  describe('create', () => {
    it('should calculate line amounts, taxes, and create claim in DRAFT status', async () => {
      prisma.expenseClaimant.findFirst.mockResolvedValue({
        id: 'claimant-1',
        organizationId: orgId,
        isActive: true,
      });
      prisma.currency.findFirst.mockResolvedValue({ id: 'cur-usd' });
      prisma.expenseCategory.findMany.mockResolvedValue([
        {
          id: 'cat-1',
          organizationId: orgId,
          code: 'MEALS',
          taxCodeId: 'tax-vat-10',
        },
      ]);

      prisma.expenseClaim.create.mockResolvedValue({
        id: 'claim-1',
        organizationId: orgId,
        claimNumber: 'EX-000001',
        status: ExpenseClaimStatus.DRAFT,
        subtotal: new Prisma.Decimal(100),
        taxAmount: new Prisma.Decimal(10),
        totalAmount: new Prisma.Decimal(110),
      });

      const result = await service.create(
        orgId,
        {
          claimantId: 'claimant-1',
          claimDate: '2026-08-20',
          description: 'Client Lunch',
          currencyId: 'cur-usd',
          lines: [
            {
              categoryId: 'cat-1',
              description: 'Business Lunch with ACME',
              expenseDate: '2026-08-20',
              quantity: 1,
              unitPrice: 100,
            },
          ],
        },
        userId,
      );

      expect(result.id).toBe('claim-1');
      expect(prisma.expenseClaim.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ExpenseClaimStatus.DRAFT,
            subtotal: new Prisma.Decimal(100),
            taxAmount: new Prisma.Decimal(10),
            totalAmount: new Prisma.Decimal(110),
          }),
        }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'EXPENSE_CLAIM_CREATED',
          organizationId: orgId,
        }),
      );
    });

    it('should reject claim creation if claimant is inactive', async () => {
      prisma.expenseClaimant.findFirst.mockResolvedValue({
        id: 'claimant-1',
        isActive: false,
      });

      await expect(
        service.create(
          orgId,
          {
            claimantId: 'claimant-1',
            claimDate: '2026-08-20',
            description: 'Test',
            currencyId: 'cur-usd',
            lines: [
              {
                categoryId: 'cat-1',
                description: 'Test',
                expenseDate: '2026-08-20',
                quantity: 1,
                unitPrice: 50,
              },
            ],
          },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('lifecycle: submit, approve, reject, cancel, post, void', () => {
    it('should submit a draft claim', async () => {
      prisma.expenseClaim.findFirst.mockResolvedValue({
        id: 'claim-1',
        organizationId: orgId,
        claimNumber: 'EX-000001',
        status: ExpenseClaimStatus.DRAFT,
        claimant: { isActive: true },
        lines: [{ id: 'line-1' }],
      });
      prisma.expenseClaim.update.mockResolvedValue({
        id: 'claim-1',
        status: ExpenseClaimStatus.SUBMITTED,
        totalAmount: new Prisma.Decimal(110),
      });

      const result = await service.submit(orgId, 'claim-1', userId);
      expect(result.status).toBe(ExpenseClaimStatus.SUBMITTED);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'EXPENSE_CLAIM_SUBMITTED' }),
      );
    });

    it('should approve a submitted claim', async () => {
      prisma.expenseClaim.findFirst.mockResolvedValue({
        id: 'claim-1',
        organizationId: orgId,
        claimNumber: 'EX-000001',
        status: ExpenseClaimStatus.SUBMITTED,
        totalAmount: new Prisma.Decimal(110),
        claimant: { name: 'Alice' },
      });
      prisma.expenseClaim.update.mockResolvedValue({
        id: 'claim-1',
        status: ExpenseClaimStatus.APPROVED,
        approvedAmount: new Prisma.Decimal(110),
        dueAmount: new Prisma.Decimal(110),
      });

      const result = await service.approve(orgId, 'claim-1', userId);
      expect(result.status).toBe(ExpenseClaimStatus.APPROVED);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'EXPENSE_CLAIM_APPROVED' }),
      );
    });

    it('should reject a submitted claim with reason', async () => {
      prisma.expenseClaim.findFirst.mockResolvedValue({
        id: 'claim-1',
        organizationId: orgId,
        claimNumber: 'EX-000001',
        status: ExpenseClaimStatus.SUBMITTED,
      });
      prisma.expenseClaim.update.mockResolvedValue({
        id: 'claim-1',
        status: ExpenseClaimStatus.REJECTED,
        rejectionReason: 'Missing receipts',
      });

      const result = await service.reject(
        orgId,
        'claim-1',
        { reason: 'Missing receipts' },
        userId,
      );
      expect(result.status).toBe(ExpenseClaimStatus.REJECTED);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'EXPENSE_CLAIM_REJECTED',
          details: expect.objectContaining({ reason: 'Missing receipts' }),
        }),
      );
    });

    it('should post an approved claim to General Ledger and Tax Sub-ledger', async () => {
      prisma.expenseClaim.findFirst.mockResolvedValue({
        id: 'claim-1',
        organizationId: orgId,
        claimNumber: 'EX-000001',
        claimDate: new Date('2026-08-20'),
        description: 'Travel expenses',
        status: ExpenseClaimStatus.APPROVED,
        subtotal: new Prisma.Decimal(100),
        taxAmount: new Prisma.Decimal(10),
        totalAmount: new Prisma.Decimal(110),
        claimant: { name: 'Alice' },
        lines: [
          {
            id: 'line-1',
            categoryId: 'cat-1',
            category: { glAccountId: 'acc-travel' },
            description: 'Flight ticket',
            expenseDate: new Date('2026-08-20'),
            subtotal: new Prisma.Decimal(100),
            taxCodeId: 'tax-vat-10',
            taxRate: new Prisma.Decimal(0.1),
            taxAmount: new Prisma.Decimal(10),
            totalAmount: new Prisma.Decimal(110),
          },
        ],
      });

      prisma.fiscalPeriod.findFirst.mockResolvedValue({
        id: 'fp-1',
        status: FiscalPeriodStatus.OPEN,
      });

      prisma.journalEntry.create.mockResolvedValue({
        id: 'je-1',
        entryNumber: 'JE-EX-000001',
      });

      prisma.expenseClaim.update.mockResolvedValue({
        id: 'claim-1',
        status: ExpenseClaimStatus.POSTED,
        journalEntryId: 'je-1',
        totalAmount: new Prisma.Decimal(110),
      });

      const result = await service.post(orgId, 'claim-1', userId);

      expect(result.status).toBe(ExpenseClaimStatus.POSTED);
      expect(prisma.journalEntry.create).toHaveBeenCalled();
      expect(taxTransactionsService.record).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'EXPENSE_CLAIM_POSTED' }),
      );
    });

    it('should void a posted claim with compensating reversal when no payments exist', async () => {
      prisma.expenseClaim.findFirst.mockResolvedValue({
        id: 'claim-1',
        organizationId: orgId,
        claimNumber: 'EX-000001',
        status: ExpenseClaimStatus.POSTED,
        paidAmount: new Prisma.Decimal(0),
        journalEntry: {
          id: 'je-1',
          entryNumber: 'JE-EX-000001',
          lines: [
            {
              accountId: 'acc-travel',
              debit: new Prisma.Decimal(100),
              credit: new Prisma.Decimal(0),
            },
            {
              accountId: 'acc-payable',
              debit: new Prisma.Decimal(0),
              credit: new Prisma.Decimal(100),
            },
          ],
        },
      });

      prisma.fiscalPeriod.findFirst.mockResolvedValue({
        id: 'fp-1',
        status: FiscalPeriodStatus.OPEN,
      });

      prisma.expenseClaim.update.mockResolvedValue({
        id: 'claim-1',
        status: ExpenseClaimStatus.VOIDED,
      });

      const result = await service.void(orgId, 'claim-1', userId);
      expect(result.status).toBe(ExpenseClaimStatus.VOIDED);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'EXPENSE_CLAIM_VOIDED' }),
      );
    });

    it('should reject voiding if payments have already been applied', async () => {
      prisma.expenseClaim.findFirst.mockResolvedValue({
        id: 'claim-1',
        organizationId: orgId,
        claimNumber: 'EX-000001',
        status: ExpenseClaimStatus.POSTED,
        paidAmount: new Prisma.Decimal(50),
      });

      await expect(service.void(orgId, 'claim-1', userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
