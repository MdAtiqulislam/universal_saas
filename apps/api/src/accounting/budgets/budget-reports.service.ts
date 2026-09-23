import { Injectable } from '@nestjs/common';
import { BudgetVsActualService } from './budget-vs-actual.service';
import { BudgetQueryDto } from './dto/budget-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class BudgetReportsService {
  constructor(private readonly vsActualService: BudgetVsActualService) {}

  async getBudgetSummary(organizationId: string, budgetId: string) {
    const report = await this.vsActualService.getVsActual(
      organizationId,
      budgetId,
      {},
    );

    return {
      budgetId: report.budgetId,
      budgetNumber: report.budgetNumber,
      budgetName: report.budgetName,
      fiscalYear: report.fiscalYear,
      currency: report.currency,
      summary: report.summary,
    };
  }

  async getAccountBudgetReport(
    organizationId: string,
    budgetId: string,
    query: BudgetQueryDto,
  ) {
    const report = await this.vsActualService.getVsActual(
      organizationId,
      budgetId,
      query,
    );

    const accountMap = new Map<
      string,
      {
        accountId: string;
        accountCode: string;
        accountName: string;
        accountType: string;
        totalBudget: Prisma.Decimal;
        totalActual: Prisma.Decimal;
        totalVariance: Prisma.Decimal;
      }
    >();

    for (const line of report.lines) {
      if (!accountMap.has(line.accountId)) {
        accountMap.set(line.accountId, {
          accountId: line.accountId,
          accountCode: line.accountCode,
          accountName: line.accountName,
          accountType: line.accountType,
          totalBudget: new Prisma.Decimal(0),
          totalActual: new Prisma.Decimal(0),
          totalVariance: new Prisma.Decimal(0),
        });
      }

      const acc = accountMap.get(line.accountId)!;
      acc.totalBudget = acc.totalBudget.add(
        new Prisma.Decimal(line.budgetAmount),
      );
      acc.totalActual = acc.totalActual.add(
        new Prisma.Decimal(line.actualAmount),
      );
      acc.totalVariance = acc.totalVariance.add(
        new Prisma.Decimal(line.variance),
      );
    }

    const accounts = Array.from(accountMap.values()).map((acc) => {
      let utilizationPercent = new Prisma.Decimal(0);
      if (!acc.totalBudget.isZero()) {
        utilizationPercent = acc.totalActual.mul(100).div(acc.totalBudget);
      }

      return {
        accountId: acc.accountId,
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountType: acc.accountType,
        budget: acc.totalBudget.toFixed(4),
        actual: acc.totalActual.toFixed(4),
        variance: acc.totalVariance.toFixed(4),
        utilizationPercent: Number(utilizationPercent.toFixed(2)),
      };
    });

    return {
      budgetId: report.budgetId,
      budgetNumber: report.budgetNumber,
      currency: report.currency,
      summary: report.summary,
      accounts,
    };
  }

  async getCategoryBudgetReport(
    organizationId: string,
    budgetId: string,
    query: BudgetQueryDto,
  ) {
    const report = await this.vsActualService.getVsActual(
      organizationId,
      budgetId,
      query,
    );

    const catMap = new Map<
      string,
      {
        category: string;
        totalBudget: Prisma.Decimal;
        totalActual: Prisma.Decimal;
        totalVariance: Prisma.Decimal;
      }
    >();

    for (const line of report.lines) {
      if (!catMap.has(line.category)) {
        catMap.set(line.category, {
          category: line.category,
          totalBudget: new Prisma.Decimal(0),
          totalActual: new Prisma.Decimal(0),
          totalVariance: new Prisma.Decimal(0),
        });
      }

      const cat = catMap.get(line.category)!;
      cat.totalBudget = cat.totalBudget.add(
        new Prisma.Decimal(line.budgetAmount),
      );
      cat.totalActual = cat.totalActual.add(
        new Prisma.Decimal(line.actualAmount),
      );
      cat.totalVariance = cat.totalVariance.add(
        new Prisma.Decimal(line.variance),
      );
    }

    const categories = Array.from(catMap.values()).map((cat) => {
      let utilizationPercent = new Prisma.Decimal(0);
      if (!cat.totalBudget.isZero()) {
        utilizationPercent = cat.totalActual.mul(100).div(cat.totalBudget);
      }

      return {
        category: cat.category,
        budget: cat.totalBudget.toFixed(4),
        actual: cat.totalActual.toFixed(4),
        variance: cat.totalVariance.toFixed(4),
        utilizationPercent: Number(utilizationPercent.toFixed(2)),
      };
    });

    return {
      budgetId: report.budgetId,
      budgetNumber: report.budgetNumber,
      currency: report.currency,
      summary: report.summary,
      categories,
    };
  }

  async getPeriodBudgetReport(
    organizationId: string,
    budgetId: string,
    query: BudgetQueryDto,
  ) {
    const report = await this.vsActualService.getVsActual(
      organizationId,
      budgetId,
      query,
    );

    const periodMap = new Map<
      string,
      {
        period: string;
        totalBudget: Prisma.Decimal;
        totalActual: Prisma.Decimal;
        totalVariance: Prisma.Decimal;
      }
    >();

    for (const line of report.lines) {
      if (!periodMap.has(line.period)) {
        periodMap.set(line.period, {
          period: line.period,
          totalBudget: new Prisma.Decimal(0),
          totalActual: new Prisma.Decimal(0),
          totalVariance: new Prisma.Decimal(0),
        });
      }

      const p = periodMap.get(line.period)!;
      p.totalBudget = p.totalBudget.add(new Prisma.Decimal(line.budgetAmount));
      p.totalActual = p.totalActual.add(new Prisma.Decimal(line.actualAmount));
      p.totalVariance = p.totalVariance.add(new Prisma.Decimal(line.variance));
    }

    const periods = Array.from(periodMap.values()).map((p) => {
      let utilizationPercent = new Prisma.Decimal(0);
      if (!p.totalBudget.isZero()) {
        utilizationPercent = p.totalActual.mul(100).div(p.totalBudget);
      }

      return {
        period: p.period,
        budget: p.totalBudget.toFixed(4),
        actual: p.totalActual.toFixed(4),
        variance: p.totalVariance.toFixed(4),
        utilizationPercent: Number(utilizationPercent.toFixed(2)),
      };
    });

    return {
      budgetId: report.budgetId,
      budgetNumber: report.budgetNumber,
      currency: report.currency,
      summary: report.summary,
      periods,
    };
  }
}
