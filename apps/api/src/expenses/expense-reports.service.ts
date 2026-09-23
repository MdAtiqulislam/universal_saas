import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseReportQueryDto } from './dto/expense-report-query.dto';
import { Prisma, ExpenseClaimStatus } from '@prisma/client';

@Injectable()
export class ExpenseReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Executive Expense Summary Report
   */
  async getSummary(organizationId: string, query: ExpenseReportQueryDto) {
    const where: Prisma.ExpenseClaimWhereInput = {
      organizationId,
      ...(query.claimantId ? { claimantId: query.claimantId } : {}),
      ...(query.currencyId ? { currencyId: query.currencyId } : {}),
      ...(query.startDate || query.endDate
        ? {
            claimDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const claims = await this.prisma.expenseClaim.findMany({
      where,
    });

    let totalSubmitted = new Prisma.Decimal(0);
    let totalApproved = new Prisma.Decimal(0);
    let totalPosted = new Prisma.Decimal(0);
    let totalPaid = new Prisma.Decimal(0);
    let totalOutstanding = new Prisma.Decimal(0);

    for (const c of claims) {
      if (
        c.status === ExpenseClaimStatus.SUBMITTED ||
        c.status === ExpenseClaimStatus.APPROVED ||
        c.status === ExpenseClaimStatus.POSTED ||
        c.status === ExpenseClaimStatus.PAID ||
        c.status === ExpenseClaimStatus.CLOSED
      ) {
        totalSubmitted = totalSubmitted.add(c.totalAmount);
      }

      if (c.approvedAmount.greaterThan(0)) {
        totalApproved = totalApproved.add(c.approvedAmount);
      }

      if (
        c.status === ExpenseClaimStatus.POSTED ||
        c.status === ExpenseClaimStatus.PAID ||
        c.status === ExpenseClaimStatus.CLOSED
      ) {
        totalPosted = totalPosted.add(c.totalAmount);
      }

      totalPaid = totalPaid.add(c.paidAmount);
      totalOutstanding = totalOutstanding.add(c.dueAmount);
    }

    return {
      period: {
        startDate: query.startDate ?? null,
        endDate: query.endDate ?? null,
      },
      summary: {
        claimsCount: claims.length,
        totalSubmitted,
        totalApproved,
        totalPosted,
        totalPaid,
        totalOutstanding,
      },
    };
  }

  /**
   * Expense breakdown by category
   */
  async getByCategory(organizationId: string, query: ExpenseReportQueryDto) {
    const lineWhere: Prisma.ExpenseClaimLineWhereInput = {
      organizationId,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.startDate || query.endDate
        ? {
            expenseDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const categories = await this.prisma.expenseCategory.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        claimLines: {
          where: lineWhere,
        },
      },
    });

    const breakdown = categories.map((cat) => {
      let subtotal = new Prisma.Decimal(0);
      let taxAmount = new Prisma.Decimal(0);
      let totalAmount = new Prisma.Decimal(0);

      for (const line of cat.claimLines) {
        subtotal = subtotal.add(line.subtotal);
        taxAmount = taxAmount.add(line.taxAmount);
        totalAmount = totalAmount.add(line.totalAmount);
      }

      return {
        categoryId: cat.id,
        code: cat.code,
        name: cat.name,
        linesCount: cat.claimLines.length,
        subtotal,
        taxAmount,
        totalAmount,
      };
    });

    return { breakdown };
  }

  /**
   * Employee reimbursement aging report (Current, 1-30, 31-60, 61-90, 90+ days)
   */
  async getReimbursementAging(
    organizationId: string,
    query: ExpenseReportQueryDto,
  ) {
    const claims = await this.prisma.expenseClaim.findMany({
      where: {
        organizationId,
        status: {
          in: [ExpenseClaimStatus.POSTED, ExpenseClaimStatus.APPROVED],
        },
        dueAmount: { gt: 0 },
        ...(query.claimantId ? { claimantId: query.claimantId } : {}),
        ...(query.currencyId ? { currencyId: query.currencyId } : {}),
      },
      include: { claimant: true, currency: true },
      orderBy: { claimDate: 'asc' },
    });

    const now = new Date();

    const buckets = {
      current: new Prisma.Decimal(0),
      days1To30: new Prisma.Decimal(0),
      days31To60: new Prisma.Decimal(0),
      days61To90: new Prisma.Decimal(0),
      over90: new Prisma.Decimal(0),
      totalOutstanding: new Prisma.Decimal(0),
    };

    const details = claims.map((c) => {
      const diffTime = Math.abs(now.getTime() - c.claimDate.getTime());
      const ageDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      buckets.totalOutstanding = buckets.totalOutstanding.add(c.dueAmount);

      let bucketName: string;
      if (ageDays <= 0) {
        buckets.current = buckets.current.add(c.dueAmount);
        bucketName = 'CURRENT';
      } else if (ageDays <= 30) {
        buckets.days1To30 = buckets.days1To30.add(c.dueAmount);
        bucketName = '1-30';
      } else if (ageDays <= 60) {
        buckets.days31To60 = buckets.days31To60.add(c.dueAmount);
        bucketName = '31-60';
      } else if (ageDays <= 90) {
        buckets.days61To90 = buckets.days61To90.add(c.dueAmount);
        bucketName = '61-90';
      } else {
        buckets.over90 = buckets.over90.add(c.dueAmount);
        bucketName = '90+';
      }

      return {
        claimId: c.id,
        claimNumber: c.claimNumber,
        claimantName: c.claimant.name,
        claimDate: c.claimDate,
        totalAmount: c.totalAmount,
        paidAmount: c.paidAmount,
        dueAmount: c.dueAmount,
        ageDays,
        bucket: bucketName,
      };
    });

    return {
      asOfDate: now.toISOString(),
      summary: buckets,
      claims: details,
    };
  }

  /**
   * Detailed Expense Ledger / Audit drilldown
   */
  async getLedger(organizationId: string, query: ExpenseReportQueryDto) {
    const where: Prisma.ExpenseClaimWhereInput = {
      organizationId,
      ...(query.claimantId ? { claimantId: query.claimantId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.startDate || query.endDate
        ? {
            claimDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.expenseClaim.findMany({
        where,
        include: {
          claimant: true,
          currency: true,
          lines: {
            include: { category: true, glAccount: true, taxCode: true },
          },
          receipts: true,
          journalEntry: { include: { lines: true } },
          allocations: { include: { payment: true } },
        },
        orderBy: { claimDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.expenseClaim.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
