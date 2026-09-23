import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseReportsService } from './expense-reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ExpenseClaimStatus } from '@prisma/client';

describe('ExpenseReportsService', () => {
  let service: ExpenseReportsService;
  let prisma: any;

  const orgId = 'org-test-1';

  beforeEach(async () => {
    prisma = {
      expenseClaim: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      expenseCategory: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ExpenseReportsService>(ExpenseReportsService);
  });

  describe('getSummary', () => {
    it('should compute accurate summary across claims', async () => {
      prisma.expenseClaim.findMany.mockResolvedValue([
        {
          id: 'claim-1',
          status: ExpenseClaimStatus.POSTED,
          totalAmount: new Prisma.Decimal(100),
          approvedAmount: new Prisma.Decimal(100),
          paidAmount: new Prisma.Decimal(40),
          dueAmount: new Prisma.Decimal(60),
        },
        {
          id: 'claim-2',
          status: ExpenseClaimStatus.PAID,
          totalAmount: new Prisma.Decimal(50),
          approvedAmount: new Prisma.Decimal(50),
          paidAmount: new Prisma.Decimal(50),
          dueAmount: new Prisma.Decimal(0),
        },
      ]);

      const result = await service.getSummary(orgId, {});

      expect(result.summary.claimsCount).toBe(2);
      expect(result.summary.totalSubmitted.toNumber()).toBe(150);
      expect(result.summary.totalApproved.toNumber()).toBe(150);
      expect(result.summary.totalPosted.toNumber()).toBe(150);
      expect(result.summary.totalPaid.toNumber()).toBe(90);
      expect(result.summary.totalOutstanding.toNumber()).toBe(60);
    });
  });

  describe('getByCategory', () => {
    it('should aggregate claim lines by category', async () => {
      prisma.expenseCategory.findMany.mockResolvedValue([
        {
          id: 'cat-1',
          code: 'MEALS',
          name: 'Meals',
          claimLines: [
            {
              subtotal: new Prisma.Decimal(40),
              taxAmount: new Prisma.Decimal(4),
              totalAmount: new Prisma.Decimal(44),
            },
            {
              subtotal: new Prisma.Decimal(60),
              taxAmount: new Prisma.Decimal(6),
              totalAmount: new Prisma.Decimal(66),
            },
          ],
        },
      ]);

      const result = await service.getByCategory(orgId, {});
      expect(result.breakdown).toHaveLength(1);
      expect(result.breakdown[0].linesCount).toBe(2);
      expect(result.breakdown[0].subtotal.toNumber()).toBe(100);
      expect(result.breakdown[0].taxAmount.toNumber()).toBe(10);
      expect(result.breakdown[0].totalAmount.toNumber()).toBe(110);
    });
  });

  describe('getReimbursementAging', () => {
    it('should bucket outstanding claims by age', async () => {
      const now = new Date();
      const day15Ago = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      const day45Ago = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);

      prisma.expenseClaim.findMany.mockResolvedValue([
        {
          id: 'claim-1',
          claimNumber: 'EX-000001',
          claimDate: day15Ago,
          totalAmount: new Prisma.Decimal(100),
          paidAmount: new Prisma.Decimal(0),
          dueAmount: new Prisma.Decimal(100),
          claimant: { name: 'Alice' },
        },
        {
          id: 'claim-2',
          claimNumber: 'EX-000002',
          claimDate: day45Ago,
          totalAmount: new Prisma.Decimal(200),
          paidAmount: new Prisma.Decimal(50),
          dueAmount: new Prisma.Decimal(150),
          claimant: { name: 'Bob' },
        },
      ]);

      const result = await service.getReimbursementAging(orgId, {});

      expect(result.summary.totalOutstanding.toNumber()).toBe(250);
      expect(result.summary.days1To30.toNumber()).toBe(100);
      expect(result.summary.days31To60.toNumber()).toBe(150);
    });
  });
});
