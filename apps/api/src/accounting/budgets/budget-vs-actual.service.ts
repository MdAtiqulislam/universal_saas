import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BudgetQueryDto } from './dto/budget-query.dto';
import { Prisma, AccountType, JournalEntryStatus } from '@prisma/client';

@Injectable()
export class BudgetVsActualService {
  constructor(private readonly prisma: PrismaService) {}

  async getVsActual(
    organizationId: string,
    budgetId: string,
    query: BudgetQueryDto,
  ) {
    const budget = await this.prisma.budget.findFirst({
      where: { id: budgetId, organizationId, deletedAt: null },
      include: {
        currency: true,
        lines: {
          where: {
            ...(query.accountId ? { accountId: query.accountId } : {}),
            ...(query.category ? { category: query.category } : {}),
            ...(query.period ? { period: query.period } : {}),
            ...(query.startDate || query.endDate
              ? {
                  startDate: {
                    ...(query.startDate
                      ? { gte: new Date(query.startDate) }
                      : {}),
                  },
                  endDate: {
                    ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
                  },
                }
              : {}),
          },
          include: { account: true, fiscalPeriod: true },
          orderBy: [{ startDate: 'asc' }, { period: 'asc' }],
        },
      },
    });

    if (!budget) {
      throw new NotFoundException(`Budget ${budgetId} not found.`);
    }

    let totalBudgetAmount = new Prisma.Decimal(0);
    let totalActualAmount = new Prisma.Decimal(0);

    const lineResults = [];

    for (const line of budget.lines) {
      const budgetAmount = line.amount;
      totalBudgetAmount = totalBudgetAmount.add(budgetAmount);

      // Query posted journal lines for this account and line date window
      const journalLines = await this.prisma.journalLine.findMany({
        where: {
          organizationId,
          accountId: line.accountId,
          journalEntry: {
            status: JournalEntryStatus.POSTED,
            entryDate: {
              gte: line.startDate,
              lte: line.endDate,
            },
          },
        },
      });

      let lineActual = new Prisma.Decimal(0);
      for (const jl of journalLines) {
        if (
          line.account.type === AccountType.EXPENSE ||
          line.account.type === AccountType.ASSET
        ) {
          lineActual = lineActual.add(jl.debit).sub(jl.credit);
        } else {
          // REVENUE, LIABILITY, EQUITY
          lineActual = lineActual.add(jl.credit).sub(jl.debit);
        }
      }

      totalActualAmount = totalActualAmount.add(lineActual);

      // Variance = Budget - Actual
      const variance = budgetAmount.sub(lineActual);

      // Variance %
      let variancePercent = new Prisma.Decimal(0);
      if (!budgetAmount.isZero()) {
        variancePercent = variance.mul(100).div(budgetAmount);
      }

      // Utilization %
      let utilizationPercent = new Prisma.Decimal(0);
      if (!budgetAmount.isZero()) {
        utilizationPercent = lineActual.mul(100).div(budgetAmount);
      }

      const remainingAmount = variance;

      lineResults.push({
        lineId: line.id,
        accountId: line.accountId,
        accountCode: line.account.code,
        accountName: line.account.name,
        accountType: line.account.type,
        category: line.category,
        period: line.period,
        startDate: line.startDate.toISOString().slice(0, 10),
        endDate: line.endDate.toISOString().slice(0, 10),
        budgetAmount: budgetAmount.toFixed(4),
        actualAmount: lineActual.toFixed(4),
        variance: variance.toFixed(4),
        variancePercent: Number(variancePercent.toFixed(2)),
        utilizationPercent: Number(utilizationPercent.toFixed(2)),
        remainingAmount: remainingAmount.toFixed(4),
      });
    }

    const overallVariance = totalBudgetAmount.sub(totalActualAmount);
    let overallVariancePercent = new Prisma.Decimal(0);
    let overallUtilizationPercent = new Prisma.Decimal(0);

    if (!totalBudgetAmount.isZero()) {
      overallVariancePercent = overallVariance.mul(100).div(totalBudgetAmount);
      overallUtilizationPercent = totalActualAmount
        .mul(100)
        .div(totalBudgetAmount);
    }

    return {
      budgetId: budget.id,
      budgetNumber: budget.budgetNumber,
      budgetName: budget.name,
      fiscalYear: budget.fiscalYear,
      currency: budget.currency.code,
      summary: {
        totalBudget: totalBudgetAmount.toFixed(4),
        totalActual: totalActualAmount.toFixed(4),
        totalVariance: overallVariance.toFixed(4),
        variancePercent: Number(overallVariancePercent.toFixed(2)),
        utilizationPercent: Number(overallUtilizationPercent.toFixed(2)),
        remainingAmount: overallVariance.toFixed(4),
      },
      lines: lineResults,
    };
  }

  async getUtilization(organizationId: string, budgetId: string) {
    const vsActual = await this.getVsActual(organizationId, budgetId, {});

    return {
      budgetId: vsActual.budgetId,
      budgetNumber: vsActual.budgetNumber,
      budgetName: vsActual.budgetName,
      fiscalYear: vsActual.fiscalYear,
      currency: vsActual.currency,
      totalBudget: vsActual.summary.totalBudget,
      actualSpent: vsActual.summary.totalActual,
      remainingAmount: vsActual.summary.remainingAmount,
      utilizationPercentage: vsActual.summary.utilizationPercent,
      breakdown: vsActual.lines.map((l) => ({
        account: `${l.accountCode} - ${l.accountName}`,
        category: l.category,
        period: l.period,
        budget: l.budgetAmount,
        actual: l.actualAmount,
        remaining: l.remainingAmount,
        utilization: l.utilizationPercent,
      })),
    };
  }

  async getDrillDown(
    organizationId: string,
    budgetId: string,
    accountId: string,
    period?: string,
  ) {
    const budget = await this.prisma.budget.findFirst({
      where: { id: budgetId, organizationId, deletedAt: null },
      include: {
        lines: {
          where: {
            accountId,
            ...(period ? { period } : {}),
          },
        },
      },
    });

    if (!budget) {
      throw new NotFoundException(`Budget ${budgetId} not found.`);
    }

    const account = await this.prisma.account.findFirst({
      where: { id: accountId, organizationId },
    });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found.`);
    }

    // Determine date range from budget lines or budget header
    let startDate = budget.startDate;
    let endDate = budget.endDate;

    if (budget.lines.length > 0) {
      startDate = budget.lines[0].startDate;
      endDate = budget.lines[budget.lines.length - 1].endDate;
    }

    const journalLines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        accountId,
        journalEntry: {
          status: JournalEntryStatus.POSTED,
          entryDate: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      include: {
        journalEntry: true,
      },
      orderBy: { journalEntry: { entryDate: 'asc' } },
    });

    let runningBalance = new Prisma.Decimal(0);
    const transactions = journalLines.map((jl) => {
      let netImpact = new Prisma.Decimal(0);
      if (
        account.type === AccountType.EXPENSE ||
        account.type === AccountType.ASSET
      ) {
        netImpact = jl.debit.sub(jl.credit);
      } else {
        netImpact = jl.credit.sub(jl.debit);
      }
      runningBalance = runningBalance.add(netImpact);

      return {
        journalEntryId: jl.journalEntryId,
        entryNumber: jl.journalEntry.entryNumber,
        entryDate: jl.journalEntry.entryDate.toISOString().slice(0, 10),
        description: jl.description || jl.journalEntry.description,
        sourceType: jl.journalEntry.sourceType,
        sourceId: jl.journalEntry.sourceId,
        debit: jl.debit.toFixed(4),
        credit: jl.credit.toFixed(4),
        netImpact: netImpact.toFixed(4),
        runningBalance: runningBalance.toFixed(4),
      };
    });

    return {
      budgetId: budget.id,
      budgetNumber: budget.budgetNumber,
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
      },
      period: period ?? 'ALL',
      dateRange: {
        start: startDate.toISOString().slice(0, 10),
        end: endDate.toISOString().slice(0, 10),
      },
      totalActual: runningBalance.toFixed(4),
      transactions,
    };
  }
}
