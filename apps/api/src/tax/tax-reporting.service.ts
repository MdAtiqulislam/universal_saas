import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaxReportQueryDto } from './dto/tax-report-query.dto';
import { Prisma, TaxScope } from '@prisma/client';

@Injectable()
export class TaxReportingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Executive tax summary report (Sales, Output Tax, Purchases, Input Tax, Net Payable)
   */
  async getSummary(organizationId: string, query: TaxReportQueryDto) {
    const dateFilter: Prisma.TaxTransactionWhereInput =
      query.startDate || query.endDate
        ? {
            transactionDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {};

    const [outputAgg, inputAgg] = await Promise.all([
      this.prisma.taxTransaction.aggregate({
        where: {
          organizationId,
          taxScope: TaxScope.OUTPUT,
          ...dateFilter,
        },
        _sum: {
          taxableAmount: true,
          taxAmount: true,
        },
      }),
      this.prisma.taxTransaction.aggregate({
        where: {
          organizationId,
          taxScope: TaxScope.INPUT,
          ...dateFilter,
        },
        _sum: {
          taxableAmount: true,
          taxAmount: true,
        },
      }),
    ]);

    const totalTaxableSales =
      outputAgg._sum.taxableAmount ?? new Prisma.Decimal(0);
    const totalOutputTax = outputAgg._sum.taxAmount ?? new Prisma.Decimal(0);
    const totalTaxablePurchases =
      inputAgg._sum.taxableAmount ?? new Prisma.Decimal(0);
    const totalInputTax = inputAgg._sum.taxAmount ?? new Prisma.Decimal(0);
    const netTaxPayable = totalOutputTax.sub(totalInputTax);

    return {
      period: {
        startDate: query.startDate ?? null,
        endDate: query.endDate ?? null,
      },
      summary: {
        totalTaxableSales,
        totalOutputTax,
        totalTaxablePurchases,
        totalInputTax,
        netTaxPayable,
      },
    };
  }

  /**
   * Detailed Output Tax (Sales) report
   */
  async getOutputTaxReport(organizationId: string, query: TaxReportQueryDto) {
    return this.getScopedReport(organizationId, TaxScope.OUTPUT, query);
  }

  /**
   * Detailed Input Tax (Purchases) report
   */
  async getInputTaxReport(organizationId: string, query: TaxReportQueryDto) {
    return this.getScopedReport(organizationId, TaxScope.INPUT, query);
  }

  private async getScopedReport(
    organizationId: string,
    taxScope: TaxScope,
    query: TaxReportQueryDto,
  ) {
    const where: Prisma.TaxTransactionWhereInput = {
      organizationId,
      taxScope,
      ...(query.taxCodeId ? { taxCodeId: query.taxCodeId } : {}),
      ...(query.jurisdictionId ? { jurisdictionId: query.jurisdictionId } : {}),
      ...(query.startDate || query.endDate
        ? {
            transactionDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total, summary] = await Promise.all([
      this.prisma.taxTransaction.findMany({
        where,
        include: {
          taxCode: true,
          jurisdiction: true,
          journalEntry: true,
        },
        orderBy: { transactionDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.taxTransaction.count({ where }),
      this.prisma.taxTransaction.aggregate({
        where,
        _sum: {
          taxableAmount: true,
          taxAmount: true,
        },
      }),
    ]);

    return {
      taxScope,
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalTaxableAmount: summary._sum.taxableAmount ?? new Prisma.Decimal(0),
        totalTaxAmount: summary._sum.taxAmount ?? new Prisma.Decimal(0),
      },
    };
  }

  /**
   * Tax breakdown by Tax Code
   */
  async getReportByTaxCode(organizationId: string, query: TaxReportQueryDto) {
    const where: Prisma.TaxTransactionWhereInput = {
      organizationId,
      ...(query.taxScope ? { taxScope: query.taxScope } : {}),
      ...(query.startDate || query.endDate
        ? {
            transactionDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const taxCodes = await this.prisma.taxCode.findMany({
      where: { organizationId },
      include: {
        taxTransactions: {
          where,
        },
      },
    });

    const breakdown = taxCodes.map((code) => {
      let totalTaxable = new Prisma.Decimal(0);
      let totalTax = new Prisma.Decimal(0);

      for (const tx of code.taxTransactions) {
        totalTaxable = totalTaxable.add(tx.taxableAmount);
        totalTax = totalTax.add(tx.taxAmount);
      }

      return {
        taxCodeId: code.id,
        code: code.code,
        name: code.name,
        taxType: code.taxType,
        transactionsCount: code.taxTransactions.length,
        totalTaxableAmount: totalTaxable,
        totalTaxAmount: totalTax,
      };
    });

    return { breakdown };
  }

  /**
   * Tax breakdown by Jurisdiction
   */
  async getReportByJurisdiction(
    organizationId: string,
    query: TaxReportQueryDto,
  ) {
    const where: Prisma.TaxTransactionWhereInput = {
      organizationId,
      ...(query.taxScope ? { taxScope: query.taxScope } : {}),
      ...(query.startDate || query.endDate
        ? {
            transactionDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const jurisdictions = await this.prisma.taxJurisdiction.findMany({
      where: { organizationId },
      include: {
        taxTransactions: {
          where,
        },
      },
    });

    const breakdown = jurisdictions.map((j) => {
      let totalTaxable = new Prisma.Decimal(0);
      let totalTax = new Prisma.Decimal(0);

      for (const tx of j.taxTransactions) {
        totalTaxable = totalTaxable.add(tx.taxableAmount);
        totalTax = totalTax.add(tx.taxAmount);
      }

      return {
        jurisdictionId: j.id,
        code: j.code,
        name: j.name,
        countryCode: j.countryCode,
        transactionsCount: j.taxTransactions.length,
        totalTaxableAmount: totalTaxable,
        totalTaxAmount: totalTax,
      };
    });

    return { breakdown };
  }
}
