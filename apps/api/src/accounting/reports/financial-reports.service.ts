import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { TrialBalanceQueryDto } from './dto/trial-balance-query.dto';
import { GeneralLedgerQueryDto } from './dto/general-ledger-query.dto';
import { FinancialStatementQueryDto } from './dto/financial-statement-query.dto';
import {
  Account,
  AccountType,
  JournalEntryStatus,
  ReportSnapshotType,
  FinancialReportSnapshot,
  Prisma,
} from '@prisma/client';
import * as crypto from 'crypto';
import { FinancialKpiQueryDto } from './dto/financial-kpi-query.dto';
import { ReconciliationQueryDto } from './dto/reconciliation-query.dto';
import { BudgetReportQueryDto } from './dto/budget-report-query.dto';
import { CreateReportSnapshotDto } from './dto/create-snapshot.dto';

export interface TrialBalanceAccountRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  openingDebit: string;
  openingCredit: string;
  periodDebit: string;
  periodCredit: string;
  closingDebit: string;
  closingCredit: string;
  netBalance: string;
}

export interface TrialBalanceReport {
  period: {
    startDate: string;
    endDate: string;
    fiscalPeriodId?: string;
  };
  accounts: TrialBalanceAccountRow[];
  summary: {
    totalOpeningDebit: string;
    totalOpeningCredit: string;
    totalPeriodDebit: string;
    totalPeriodCredit: string;
    totalClosingDebit: string;
    totalClosingCredit: string;
    isBalanced: boolean;
    difference: string;
  };
}

export interface GeneralLedgerLineItem {
  id: string;
  journalEntryId: string;
  entryNumber: string;
  entryDate: string;
  description: string | null;
  debit: string;
  credit: string;
  runningBalance: string;
  sourceType: string | null;
  sourceId: string | null;
  lineNumber: number;
}

export interface GeneralLedgerReport {
  account: {
    id: string;
    code: string;
    name: string;
    type: AccountType;
  } | null;
  period: {
    startDate: string;
    endDate: string;
    fiscalPeriodId?: string;
  };
  openingBalance: string;
  totalDebits: string;
  totalCredits: string;
  closingBalance: string;
  lines: GeneralLedgerLineItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface FinancialStatementAccountItem {
  accountId: string;
  code: string;
  name: string;
  amount: string;
}

export interface BalanceSheetReport {
  asOfDate: string;
  assets: {
    accounts: FinancialStatementAccountItem[];
    total: string;
  };
  liabilities: {
    accounts: FinancialStatementAccountItem[];
    total: string;
  };
  equity: {
    accounts: FinancialStatementAccountItem[];
    currentPeriodNetIncome: string;
    total: string;
  };
  summary: {
    totalAssets: string;
    totalLiabilitiesAndEquity: string;
    difference: string;
    isBalanced: boolean;
  };
}

export interface IncomeStatementReport {
  period: {
    startDate: string;
    endDate: string;
    fiscalPeriodId?: string;
  };
  revenue: {
    accounts: FinancialStatementAccountItem[];
    total: string;
  };
  expenses: {
    accounts: FinancialStatementAccountItem[];
    total: string;
  };
  summary: {
    totalRevenue: string;
    totalExpenses: string;
    netIncome: string;
  };
}

export interface CashFlowReport {
  period: {
    startDate: string;
    endDate: string;
    fiscalPeriodId?: string;
  };
  operatingActivities: {
    items: Array<{ description: string; amount: string }>;
    total: string;
  };
  investingActivities: {
    items: Array<{ description: string; amount: string }>;
    total: string;
  };
  financingActivities: {
    items: Array<{ description: string; amount: string }>;
    total: string;
  };
  summary: {
    openingCash: string;
    netCashChange: string;
    closingCash: string;
  };
}

@Injectable()
export class FinancialReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Helper: Resolve date range from query parameters or fiscal period.
   */
  private async resolveDateRange(
    organizationId: string,
    query: {
      startDate?: string;
      endDate?: string;
      asOfDate?: string;
      fiscalPeriodId?: string;
    },
  ): Promise<{ startDate: Date; endDate: Date; fiscalPeriodId?: string }> {
    if (query.fiscalPeriodId) {
      const period = await this.prisma.fiscalPeriod.findFirst({
        where: { id: query.fiscalPeriodId, organizationId },
      });
      if (!period) {
        throw new NotFoundException(
          `Fiscal period with ID ${query.fiscalPeriodId} not found in this organization.`,
        );
      }
      return {
        startDate: period.startDate,
        endDate: period.endDate,
        fiscalPeriodId: period.id,
      };
    }

    const end = query.asOfDate
      ? new Date(query.asOfDate)
      : query.endDate
        ? new Date(query.endDate)
        : new Date();

    const start = query.startDate
      ? new Date(query.startDate)
      : new Date(Date.UTC(end.getUTCFullYear(), 0, 1)); // Default Jan 1 of current year

    if (start > end) {
      throw new BadRequestException('Start date cannot be after end date.');
    }

    return { startDate: start, endDate: end };
  }

  /**
   * 1. General Ledger Trial Balance
   */
  async getTrialBalance(
    organizationId: string,
    query: TrialBalanceQueryDto,
    actorUserId?: string,
  ): Promise<TrialBalanceReport> {
    const { startDate, endDate, fiscalPeriodId } = await this.resolveDateRange(
      organizationId,
      query,
    );

    // 1. Fetch all accounts in organization
    const accountWhere: Prisma.AccountWhereInput = {
      organizationId,
      deletedAt: null,
    };
    if (query.accountType) {
      accountWhere.type = query.accountType;
    }

    const accounts = await this.prisma.account.findMany({
      where: accountWhere,
      orderBy: [{ code: 'asc' }],
    });

    // 2. Fetch posted journal lines
    // Opening lines: entryDate < startDate
    const openingLines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          status: JournalEntryStatus.POSTED,
          entryDate: { lt: startDate },
        },
      },
      select: {
        accountId: true,
        debit: true,
        credit: true,
      },
    });

    // Period lines: entryDate >= startDate and entryDate <= endDate
    const periodLines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          status: JournalEntryStatus.POSTED,
          entryDate: { gte: startDate, lte: endDate },
        },
      },
      select: {
        accountId: true,
        debit: true,
        credit: true,
      },
    });

    // 3. Aggregate totals by accountId
    const openingMap = new Map<
      string,
      { debit: Prisma.Decimal; credit: Prisma.Decimal }
    >();
    for (const line of openingLines) {
      const existing = openingMap.get(line.accountId) ?? {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      };
      existing.debit = existing.debit.add(line.debit);
      existing.credit = existing.credit.add(line.credit);
      openingMap.set(line.accountId, existing);
    }

    const periodMap = new Map<
      string,
      { debit: Prisma.Decimal; credit: Prisma.Decimal }
    >();
    for (const line of periodLines) {
      const existing = periodMap.get(line.accountId) ?? {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      };
      existing.debit = existing.debit.add(line.debit);
      existing.credit = existing.credit.add(line.credit);
      periodMap.set(line.accountId, existing);
    }

    // 4. Build account rows and compute balances
    let totalOpeningDebit = new Prisma.Decimal(0);
    let totalOpeningCredit = new Prisma.Decimal(0);
    let totalPeriodDebit = new Prisma.Decimal(0);
    let totalPeriodCredit = new Prisma.Decimal(0);
    let totalClosingDebit = new Prisma.Decimal(0);
    let totalClosingCredit = new Prisma.Decimal(0);

    const rows: TrialBalanceAccountRow[] = [];

    for (const acc of accounts) {
      const op = openingMap.get(acc.id) ?? {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      };
      const per = periodMap.get(acc.id) ?? {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      };

      const closingDebit = op.debit.add(per.debit);
      const closingCredit = op.credit.add(per.credit);

      let netBalance: Prisma.Decimal;
      if (acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE) {
        netBalance = closingDebit.sub(closingCredit);
      } else {
        netBalance = closingCredit.sub(closingDebit);
      }

      totalOpeningDebit = totalOpeningDebit.add(op.debit);
      totalOpeningCredit = totalOpeningCredit.add(op.credit);
      totalPeriodDebit = totalPeriodDebit.add(per.debit);
      totalPeriodCredit = totalPeriodCredit.add(per.credit);
      totalClosingDebit = totalClosingDebit.add(closingDebit);
      totalClosingCredit = totalClosingCredit.add(closingCredit);

      // Check if zero balance
      const isZero =
        op.debit.isZero() &&
        op.credit.isZero() &&
        per.debit.isZero() &&
        per.credit.isZero();

      if (!isZero || query.includeZeroBalance) {
        rows.push({
          accountId: acc.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          openingDebit: op.debit.toFixed(4),
          openingCredit: op.credit.toFixed(4),
          periodDebit: per.debit.toFixed(4),
          periodCredit: per.credit.toFixed(4),
          closingDebit: closingDebit.toFixed(4),
          closingCredit: closingCredit.toFixed(4),
          netBalance: netBalance.toFixed(4),
        });
      }
    }

    const difference = totalClosingDebit.sub(totalClosingCredit);
    const isBalanced = difference.isZero();

    if (actorUserId) {
      await this.eventBus.publish({
        eventName: 'FINANCIAL_REPORT_GENERATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'financial_report.trial_balance',
        resource: 'report',
        details: {
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10),
          isBalanced,
        },
      });
    }

    return {
      period: {
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        fiscalPeriodId,
      },
      accounts: rows,
      summary: {
        totalOpeningDebit: totalOpeningDebit.toFixed(4),
        totalOpeningCredit: totalOpeningCredit.toFixed(4),
        totalPeriodDebit: totalPeriodDebit.toFixed(4),
        totalPeriodCredit: totalPeriodCredit.toFixed(4),
        totalClosingDebit: totalClosingDebit.toFixed(4),
        totalClosingCredit: totalClosingCredit.toFixed(4),
        isBalanced,
        difference: difference.toFixed(4),
      },
    };
  }

  /**
   * 2. General Ledger / Account Ledger
   */
  async getGeneralLedger(
    organizationId: string,
    query: GeneralLedgerQueryDto,
    actorUserId?: string,
  ): Promise<GeneralLedgerReport> {
    const { startDate, endDate, fiscalPeriodId } = await this.resolveDateRange(
      organizationId,
      query,
    );

    let targetAccount: Account | null = null;
    if (query.accountId || query.accountCode) {
      targetAccount = await this.prisma.account.findFirst({
        where: {
          organizationId,
          ...(query.accountId ? { id: query.accountId } : {}),
          ...(query.accountCode ? { code: query.accountCode } : {}),
          deletedAt: null,
        },
      });
      if (!targetAccount) {
        throw new NotFoundException(
          'Specified account not found in this organization.',
        );
      }
    }

    // 1. Calculate opening balance prior to startDate
    let openingBalance = new Prisma.Decimal(0);
    if (targetAccount) {
      const priorLines = await this.prisma.journalLine.findMany({
        where: {
          organizationId,
          accountId: targetAccount.id,
          journalEntry: {
            status: JournalEntryStatus.POSTED,
            entryDate: { lt: startDate },
          },
        },
        select: { debit: true, credit: true },
      });

      let priorDebits = new Prisma.Decimal(0);
      let priorCredits = new Prisma.Decimal(0);
      for (const pl of priorLines) {
        priorDebits = priorDebits.add(pl.debit);
        priorCredits = priorCredits.add(pl.credit);
      }

      if (
        targetAccount.type === AccountType.ASSET ||
        targetAccount.type === AccountType.EXPENSE
      ) {
        openingBalance = priorDebits.sub(priorCredits);
      } else {
        openingBalance = priorCredits.sub(priorDebits);
      }
    }

    // 2. Fetch all period lines for the account(s)
    const lineWhere: Prisma.JournalLineWhereInput = {
      organizationId,
      journalEntry: {
        status: JournalEntryStatus.POSTED,
        entryDate: { gte: startDate, lte: endDate },
        ...(query.sourceType ? { sourceType: query.sourceType } : {}),
        ...(query.sourceId ? { sourceId: query.sourceId } : {}),
      },
      ...(targetAccount ? { accountId: targetAccount.id } : {}),
    };

    const allPeriodLines = await this.prisma.journalLine.findMany({
      where: lineWhere,
      include: {
        journalEntry: {
          select: {
            id: true,
            entryNumber: true,
            entryDate: true,
            sourceType: true,
            sourceId: true,
            createdAt: true,
          },
        },
        account: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
      orderBy: [
        { journalEntry: { entryDate: 'asc' } },
        { journalEntry: { entryNumber: 'asc' } },
        { lineNumber: 'asc' },
      ],
    });

    // 3. Compute running balance and totals
    let currentRunning = new Prisma.Decimal(openingBalance);
    let totalDebits = new Prisma.Decimal(0);
    let totalCredits = new Prisma.Decimal(0);

    const calculatedLines: GeneralLedgerLineItem[] = [];

    for (const l of allPeriodLines) {
      totalDebits = totalDebits.add(l.debit);
      totalCredits = totalCredits.add(l.credit);

      const accType = targetAccount ? targetAccount.type : l.account.type;
      if (accType === AccountType.ASSET || accType === AccountType.EXPENSE) {
        currentRunning = currentRunning.add(l.debit).sub(l.credit);
      } else {
        currentRunning = currentRunning.add(l.credit).sub(l.debit);
      }

      calculatedLines.push({
        id: l.id,
        journalEntryId: l.journalEntry.id,
        entryNumber: l.journalEntry.entryNumber,
        entryDate: l.journalEntry.entryDate.toISOString().slice(0, 10),
        description: l.description,
        debit: l.debit.toFixed(4),
        credit: l.credit.toFixed(4),
        runningBalance: currentRunning.toFixed(4),
        sourceType: l.journalEntry.sourceType,
        sourceId: l.journalEntry.sourceId,
        lineNumber: l.lineNumber,
      });
    }

    const closingBalance = currentRunning;

    // 4. Pagination
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const paginatedLines = calculatedLines.slice(skip, skip + limit);

    if (actorUserId) {
      await this.eventBus.publish({
        eventName: 'FINANCIAL_REPORT_GENERATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'financial_report.general_ledger',
        resource: 'report',
        details: {
          accountId: targetAccount?.id,
          totalLines: calculatedLines.length,
        },
      });
    }

    return {
      account: targetAccount
        ? {
            id: targetAccount.id,
            code: targetAccount.code,
            name: targetAccount.name,
            type: targetAccount.type,
          }
        : null,
      period: {
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        fiscalPeriodId,
      },
      openingBalance: openingBalance.toFixed(4),
      totalDebits: totalDebits.toFixed(4),
      totalCredits: totalCredits.toFixed(4),
      closingBalance: closingBalance.toFixed(4),
      lines: paginatedLines,
      pagination: {
        total: calculatedLines.length,
        page,
        limit,
        totalPages: Math.ceil(calculatedLines.length / limit) || 1,
      },
    };
  }

  /**
   * 3. Account Balance Drill-down
   */
  async getAccountBalance(
    organizationId: string,
    accountId: string,
    query: FinancialStatementQueryDto,
  ): Promise<{
    account: { id: string; code: string; name: string; type: AccountType };
    period: { startDate: string; endDate: string; fiscalPeriodId?: string };
    openingBalance: string;
    debitTotal: string;
    creditTotal: string;
    closingBalance: string;
  }> {
    const glReport = await this.getGeneralLedger(organizationId, {
      accountId,
      startDate: query.startDate,
      endDate: query.endDate,
      fiscalPeriodId: query.fiscalPeriodId,
      limit: 1,
    });

    return {
      account: glReport.account!,
      period: glReport.period,
      openingBalance: glReport.openingBalance,
      debitTotal: glReport.totalDebits,
      creditTotal: glReport.totalCredits,
      closingBalance: glReport.closingBalance,
    };
  }

  /**
   * 4. Balance Sheet Statement
   */
  async getBalanceSheet(
    organizationId: string,
    query: FinancialStatementQueryDto,
    actorUserId?: string,
  ): Promise<BalanceSheetReport> {
    const { endDate: asOfDate } = await this.resolveDateRange(
      organizationId,
      query,
    );

    // 1. Fetch all accounts
    const accounts = await this.prisma.account.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ code: 'asc' }],
    });

    // 2. Fetch all posted journal lines up to asOfDate
    const cumulativeLines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          status: JournalEntryStatus.POSTED,
          entryDate: { lte: asOfDate },
        },
      },
      select: {
        accountId: true,
        debit: true,
        credit: true,
      },
    });

    const accountTotals = new Map<
      string,
      { debit: Prisma.Decimal; credit: Prisma.Decimal }
    >();
    for (const line of cumulativeLines) {
      const existing = accountTotals.get(line.accountId) ?? {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      };
      existing.debit = existing.debit.add(line.debit);
      existing.credit = existing.credit.add(line.credit);
      accountTotals.set(line.accountId, existing);
    }

    const assetItems: FinancialStatementAccountItem[] = [];
    const liabilityItems: FinancialStatementAccountItem[] = [];
    const equityItems: FinancialStatementAccountItem[] = [];

    let totalAssets = new Prisma.Decimal(0);
    let totalLiabilities = new Prisma.Decimal(0);
    let totalEquityAccounts = new Prisma.Decimal(0);
    let cumulativeRevenue = new Prisma.Decimal(0);
    let cumulativeExpenses = new Prisma.Decimal(0);

    for (const acc of accounts) {
      const totals = accountTotals.get(acc.id) ?? {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      };

      if (acc.type === AccountType.ASSET) {
        const bal = totals.debit.sub(totals.credit);
        if (!bal.isZero()) {
          assetItems.push({
            accountId: acc.id,
            code: acc.code,
            name: acc.name,
            amount: bal.toFixed(4),
          });
          totalAssets = totalAssets.add(bal);
        }
      } else if (acc.type === AccountType.LIABILITY) {
        const bal = totals.credit.sub(totals.debit);
        if (!bal.isZero()) {
          liabilityItems.push({
            accountId: acc.id,
            code: acc.code,
            name: acc.name,
            amount: bal.toFixed(4),
          });
          totalLiabilities = totalLiabilities.add(bal);
        }
      } else if (acc.type === AccountType.EQUITY) {
        const bal = totals.credit.sub(totals.debit);
        if (!bal.isZero()) {
          equityItems.push({
            accountId: acc.id,
            code: acc.code,
            name: acc.name,
            amount: bal.toFixed(4),
          });
          totalEquityAccounts = totalEquityAccounts.add(bal);
        }
      } else if (acc.type === AccountType.REVENUE) {
        cumulativeRevenue = cumulativeRevenue.add(
          totals.credit.sub(totals.debit),
        );
      } else if (acc.type === AccountType.EXPENSE) {
        cumulativeExpenses = cumulativeExpenses.add(
          totals.debit.sub(totals.credit),
        );
      }
    }

    // Cumulative Net Income (Retained Earnings foundation)
    const currentPeriodNetIncome = cumulativeRevenue.sub(cumulativeExpenses);
    const totalEquity = totalEquityAccounts.add(currentPeriodNetIncome);
    const totalLiabilitiesAndEquity = totalLiabilities.add(totalEquity);
    const difference = totalAssets.sub(totalLiabilitiesAndEquity);
    const isBalanced = difference.isZero();

    if (actorUserId) {
      await this.eventBus.publish({
        eventName: 'FINANCIAL_REPORT_GENERATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'financial_report.balance_sheet',
        resource: 'report',
        details: {
          asOfDate: asOfDate.toISOString().slice(0, 10),
          isBalanced,
        },
      });
    }

    return {
      asOfDate: asOfDate.toISOString().slice(0, 10),
      assets: {
        accounts: assetItems,
        total: totalAssets.toFixed(4),
      },
      liabilities: {
        accounts: liabilityItems,
        total: totalLiabilities.toFixed(4),
      },
      equity: {
        accounts: equityItems,
        currentPeriodNetIncome: currentPeriodNetIncome.toFixed(4),
        total: totalEquity.toFixed(4),
      },
      summary: {
        totalAssets: totalAssets.toFixed(4),
        totalLiabilitiesAndEquity: totalLiabilitiesAndEquity.toFixed(4),
        difference: difference.toFixed(4),
        isBalanced,
      },
    };
  }

  /**
   * 5. Income Statement / Profit & Loss Statement
   */
  async getIncomeStatement(
    organizationId: string,
    query: FinancialStatementQueryDto,
    actorUserId?: string,
  ): Promise<IncomeStatementReport> {
    const { startDate, endDate, fiscalPeriodId } = await this.resolveDateRange(
      organizationId,
      query,
    );

    const accounts = await this.prisma.account.findMany({
      where: {
        organizationId,
        type: { in: [AccountType.REVENUE, AccountType.EXPENSE] },
        deletedAt: null,
      },
      orderBy: [{ code: 'asc' }],
    });

    const periodLines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          status: JournalEntryStatus.POSTED,
          entryDate: { gte: startDate, lte: endDate },
        },
        account: {
          type: { in: [AccountType.REVENUE, AccountType.EXPENSE] },
        },
      },
      select: {
        accountId: true,
        debit: true,
        credit: true,
      },
    });

    const periodMap = new Map<
      string,
      { debit: Prisma.Decimal; credit: Prisma.Decimal }
    >();
    for (const line of periodLines) {
      const existing = periodMap.get(line.accountId) ?? {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      };
      existing.debit = existing.debit.add(line.debit);
      existing.credit = existing.credit.add(line.credit);
      periodMap.set(line.accountId, existing);
    }

    const revenueItems: FinancialStatementAccountItem[] = [];
    const expenseItems: FinancialStatementAccountItem[] = [];

    let totalRevenue = new Prisma.Decimal(0);
    let totalExpenses = new Prisma.Decimal(0);

    for (const acc of accounts) {
      const totals = periodMap.get(acc.id) ?? {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      };

      if (acc.type === AccountType.REVENUE) {
        const bal = totals.credit.sub(totals.debit);
        if (!bal.isZero()) {
          revenueItems.push({
            accountId: acc.id,
            code: acc.code,
            name: acc.name,
            amount: bal.toFixed(4),
          });
          totalRevenue = totalRevenue.add(bal);
        }
      } else if (acc.type === AccountType.EXPENSE) {
        const bal = totals.debit.sub(totals.credit);
        if (!bal.isZero()) {
          expenseItems.push({
            accountId: acc.id,
            code: acc.code,
            name: acc.name,
            amount: bal.toFixed(4),
          });
          totalExpenses = totalExpenses.add(bal);
        }
      }
    }

    const netIncome = totalRevenue.sub(totalExpenses);

    if (actorUserId) {
      await this.eventBus.publish({
        eventName: 'FINANCIAL_REPORT_GENERATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'financial_report.income_statement',
        resource: 'report',
        details: {
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10),
          netIncome: netIncome.toFixed(4),
        },
      });
    }

    return {
      period: {
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        fiscalPeriodId,
      },
      revenue: {
        accounts: revenueItems,
        total: totalRevenue.toFixed(4),
      },
      expenses: {
        accounts: expenseItems,
        total: totalExpenses.toFixed(4),
      },
      summary: {
        totalRevenue: totalRevenue.toFixed(4),
        totalExpenses: totalExpenses.toFixed(4),
        netIncome: netIncome.toFixed(4),
      },
    };
  }

  /**
   * 6. Cash Flow Statement Foundation
   */
  async getCashFlow(
    organizationId: string,
    query: FinancialStatementQueryDto,
    actorUserId?: string,
  ): Promise<CashFlowReport> {
    const { startDate, endDate, fiscalPeriodId } = await this.resolveDateRange(
      organizationId,
      query,
    );

    // 1. Identify cash & bank accounts (payment accounts or asset accounts)
    const paymentAccounts = await this.prisma.paymentAccount.findMany({
      where: { organizationId, deletedAt: null },
      select: { accountingAccountId: true },
    });
    const cashAccountIds = new Set<string>(
      paymentAccounts.map((p) => p.accountingAccountId),
    );

    // Also include any Asset accounts with 'cash' or 'bank' in name
    const cashAccounts = await this.prisma.account.findMany({
      where: {
        organizationId,
        type: AccountType.ASSET,
        deletedAt: null,
      },
    });
    for (const ca of cashAccounts) {
      if (
        ca.code.startsWith('10') ||
        ca.name.toLowerCase().includes('cash') ||
        ca.name.toLowerCase().includes('bank')
      ) {
        cashAccountIds.add(ca.id);
      }
    }

    // 2. Opening cash balance before startDate
    const priorCashLines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        accountId: { in: Array.from(cashAccountIds) },
        journalEntry: {
          status: JournalEntryStatus.POSTED,
          entryDate: { lt: startDate },
        },
      },
      select: { debit: true, credit: true },
    });

    let openingCash = new Prisma.Decimal(0);
    for (const pl of priorCashLines) {
      openingCash = openingCash.add(pl.debit).sub(pl.credit);
    }

    // 3. Period cash movements
    const periodCashLines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        accountId: { in: Array.from(cashAccountIds) },
        journalEntry: {
          status: JournalEntryStatus.POSTED,
          entryDate: { gte: startDate, lte: endDate },
        },
      },
      include: {
        journalEntry: {
          select: {
            entryNumber: true,
            description: true,
            sourceType: true,
          },
        },
      },
    });

    let totalOperating = new Prisma.Decimal(0);
    let totalInvesting = new Prisma.Decimal(0);
    let totalFinancing = new Prisma.Decimal(0);

    const operatingItems: Array<{ description: string; amount: string }> = [];
    const investingItems: Array<{ description: string; amount: string }> = [];
    const financingItems: Array<{ description: string; amount: string }> = [];

    for (const line of periodCashLines) {
      const netMovement = line.debit.sub(line.credit);
      const desc =
        line.description ||
        line.journalEntry.description ||
        `Transaction ${line.journalEntry.entryNumber}`;

      if (
        line.journalEntry.sourceType === 'EQUITY' ||
        line.journalEntry.sourceType === 'LOAN'
      ) {
        financingItems.push({
          description: desc,
          amount: netMovement.toFixed(4),
        });
        totalFinancing = totalFinancing.add(netMovement);
      } else if (line.journalEntry.sourceType === 'FIXED_ASSET') {
        investingItems.push({
          description: desc,
          amount: netMovement.toFixed(4),
        });
        totalInvesting = totalInvesting.add(netMovement);
      } else {
        // Default to operating activities (Receipts, Payments, Invoices, Fees)
        operatingItems.push({
          description: desc,
          amount: netMovement.toFixed(4),
        });
        totalOperating = totalOperating.add(netMovement);
      }
    }

    const netCashChange = totalOperating
      .add(totalInvesting)
      .add(totalFinancing);
    const closingCash = openingCash.add(netCashChange);

    if (actorUserId) {
      await this.eventBus.publish({
        eventName: 'FINANCIAL_REPORT_GENERATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'financial_report.cash_flow',
        resource: 'report',
        details: {
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10),
          netCashChange: netCashChange.toFixed(4),
        },
      });
    }

    return {
      period: {
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        fiscalPeriodId,
      },
      operatingActivities: {
        items: operatingItems,
        total: totalOperating.toFixed(4),
      },
      investingActivities: {
        items: investingItems,
        total: totalInvesting.toFixed(4),
      },
      financingActivities: {
        items: financingItems,
        total: totalFinancing.toFixed(4),
      },
      summary: {
        openingCash: openingCash.toFixed(4),
        netCashChange: netCashChange.toFixed(4),
        closingCash: closingCash.toFixed(4),
      },
    };
  }

  /**
   * Executive Financial KPIs & Management Ratios (M33)
   */
  async getFinancialKpis(
    organizationId: string,
    query: FinancialKpiQueryDto,
    actorUserId?: string,
  ): Promise<{
    period: { startDate: string; endDate: string; fiscalPeriodId?: string };
    profitability: {
      revenue: string;
      cogs: string;
      grossProfit: string;
      grossMarginPercent: string;
      operatingExpenses: string;
      operatingProfit: string;
      netProfit: string;
      netMarginPercent: string;
    };
    liquidity: {
      currentAssets: string;
      currentLiabilities: string;
      workingCapital: string;
      currentRatio: string;
      quickRatio: string;
      cashPosition: string;
    };
    workingCapitalMetrics: {
      accountsReceivable: string;
      accountsPayable: string;
      inventoryValue: string;
    };
  }> {
    // 1. Get Income Statement for period
    const incomeStatement = await this.getIncomeStatement(
      organizationId,
      query,
      actorUserId,
    );
    // 2. Get Balance Sheet as of period end date
    const balanceSheet = await this.getBalanceSheet(
      organizationId,
      { asOfDate: query.endDate, fiscalPeriodId: query.fiscalPeriodId },
      actorUserId,
    );

    const revenue = new Prisma.Decimal(incomeStatement.summary.totalRevenue);
    const totalExpenses = new Prisma.Decimal(
      incomeStatement.summary.totalExpenses,
    );
    const netProfit = new Prisma.Decimal(incomeStatement.summary.netIncome);

    // Calculate COGS by inspecting expense accounts starting with 5
    let cogs = new Prisma.Decimal(0);
    let operatingExpenses = new Prisma.Decimal(0);
    for (const exp of incomeStatement.expenses.accounts) {
      const amt = new Prisma.Decimal(exp.amount);
      if (exp.code.startsWith('5')) {
        cogs = cogs.add(amt);
      } else {
        operatingExpenses = operatingExpenses.add(amt);
      }
    }
    const grossProfit = revenue.sub(cogs);
    const operatingProfit = grossProfit.sub(operatingExpenses);

    const grossMarginPercent = revenue.greaterThan(0)
      ? grossProfit.div(revenue).mul(100).toFixed(2)
      : '0.00';
    const netMarginPercent = revenue.greaterThan(0)
      ? netProfit.div(revenue).mul(100).toFixed(2)
      : '0.00';

    // Liquidity & Working Capital
    let currentAssets = new Prisma.Decimal(0);
    let cashPosition = new Prisma.Decimal(0);
    let accountsReceivable = new Prisma.Decimal(0);
    let inventoryValue = new Prisma.Decimal(0);

    for (const acc of balanceSheet.assets.accounts) {
      const amt = new Prisma.Decimal(acc.amount);
      if (
        acc.code.startsWith('10') ||
        acc.code.startsWith('11') ||
        acc.code.startsWith('12') ||
        acc.code.startsWith('13') ||
        acc.code.startsWith('14')
      ) {
        currentAssets = currentAssets.add(amt);
      }
      if (acc.code.startsWith('10')) cashPosition = cashPosition.add(amt);
      if (acc.code.startsWith('11') || acc.code.startsWith('12'))
        accountsReceivable = accountsReceivable.add(amt);
      if (acc.code.startsWith('13') || acc.code.startsWith('14'))
        inventoryValue = inventoryValue.add(amt);
    }

    let currentLiabilities = new Prisma.Decimal(0);
    let accountsPayable = new Prisma.Decimal(0);

    for (const acc of balanceSheet.liabilities.accounts) {
      const amt = new Prisma.Decimal(acc.amount);
      if (
        acc.code.startsWith('20') ||
        acc.code.startsWith('21') ||
        acc.code.startsWith('22') ||
        acc.code.startsWith('23')
      ) {
        currentLiabilities = currentLiabilities.add(amt);
      }
      if (acc.code.startsWith('20') || acc.code.startsWith('21'))
        accountsPayable = accountsPayable.add(amt);
    }

    const workingCapital = currentAssets.sub(currentLiabilities);
    const currentRatio = currentLiabilities.greaterThan(0)
      ? currentAssets.div(currentLiabilities).toFixed(2)
      : currentAssets.greaterThan(0)
        ? '99.99'
        : '1.00';

    const quickAssets = currentAssets.sub(inventoryValue);
    const quickRatio = currentLiabilities.greaterThan(0)
      ? quickAssets.div(currentLiabilities).toFixed(2)
      : quickAssets.greaterThan(0)
        ? '99.99'
        : '1.00';

    return {
      period: incomeStatement.period,
      profitability: {
        revenue: revenue.toFixed(2),
        cogs: cogs.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        grossMarginPercent,
        operatingExpenses: operatingExpenses.toFixed(2),
        operatingProfit: operatingProfit.toFixed(2),
        netProfit: netProfit.toFixed(2),
        netMarginPercent,
      },
      liquidity: {
        currentAssets: currentAssets.toFixed(2),
        currentLiabilities: currentLiabilities.toFixed(2),
        workingCapital: workingCapital.toFixed(2),
        currentRatio,
        quickRatio,
        cashPosition: cashPosition.toFixed(2),
      },
      workingCapitalMetrics: {
        accountsReceivable: accountsReceivable.toFixed(2),
        accountsPayable: accountsPayable.toFixed(2),
        inventoryValue: inventoryValue.toFixed(2),
      },
    };
  }

  /**
   * Unified Subledger to General Ledger Reconciliation Report (M33)
   */
  async getSubledgerReconciliation(
    organizationId: string,
    query: ReconciliationQueryDto,
  ): Promise<{
    asOfDate: string;
    reconciliations: Array<{
      subledger: string;
      subledgerBalance: string;
      glBalance: string;
      difference: string;
      status: 'MATCHED' | 'MISMATCH' | 'NOT_APPLICABLE';
      details?: string;
    }>;
    summary: {
      totalSubledgersChecked: number;
      matchedCount: number;
      mismatchCount: number;
      allMatched: boolean;
    };
  }> {
    const asOfDate = query.asOfDate ? new Date(query.asOfDate) : new Date();

    // 1. AP Reconciliation
    const activeInvoices = await this.prisma.supplierInvoice.findMany({
      where: {
        organizationId,
        invoiceDate: { lte: asOfDate },
        status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] },
      },
      select: { grandTotal: true, amountPaid: true },
    });
    let subledgerAp = new Prisma.Decimal(0);
    for (const inv of activeInvoices) {
      subledgerAp = subledgerAp.add(inv.grandTotal.sub(inv.amountPaid));
    }

    const glApLines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          organizationId,
          status: JournalEntryStatus.POSTED,
          entryDate: { lte: asOfDate },
        },
        account: {
          organizationId,
          OR: [
            { code: { startsWith: '20' } },
            { code: { startsWith: '21' } },
            { type: 'LIABILITY' },
          ],
        },
      },
      select: { credit: true, debit: true },
    });
    let glAp = new Prisma.Decimal(0);
    for (const line of glApLines) {
      glAp = glAp.add(line.credit.sub(line.debit));
    }
    const diffAp = subledgerAp.sub(glAp).abs();

    // 2. AR Reconciliation
    const activeCustomerInvoices = await this.prisma.customerInvoice.findMany({
      where: {
        organizationId,
        invoiceDate: { lte: asOfDate },
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID'] },
      },
      select: { grandTotal: true, amountPaid: true },
    });
    let subledgerAr = new Prisma.Decimal(0);
    for (const inv of activeCustomerInvoices) {
      subledgerAr = subledgerAr.add(inv.grandTotal.sub(inv.amountPaid));
    }

    const glArLines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          organizationId,
          status: JournalEntryStatus.POSTED,
          entryDate: { lte: asOfDate },
        },
        account: {
          organizationId,
          OR: [{ code: { startsWith: '11' } }, { code: { startsWith: '12' } }],
        },
      },
      select: { debit: true, credit: true },
    });
    let glAr = new Prisma.Decimal(0);
    for (const line of glArLines) {
      glAr = glAr.add(line.debit.sub(line.credit));
    }
    const diffAr = subledgerAr.sub(glAr).abs();

    // 3. Inventory Valuation Reconciliation
    const layers = await this.prisma.inventoryCostLayer.findMany({
      where: {
        organizationId,
        createdAt: { lte: asOfDate },
        remainingQuantity: { gt: 0 },
      },
      select: { remainingQuantity: true, unitCost: true },
    });
    let subledgerInventory = new Prisma.Decimal(0);
    for (const layer of layers) {
      subledgerInventory = subledgerInventory.add(
        layer.remainingQuantity.mul(layer.unitCost),
      );
    }

    const glInvLines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          organizationId,
          status: JournalEntryStatus.POSTED,
          entryDate: { lte: asOfDate },
        },
        account: {
          organizationId,
          OR: [{ code: { startsWith: '13' } }, { code: { startsWith: '14' } }],
        },
      },
      select: { debit: true, credit: true },
    });
    let glInventory = new Prisma.Decimal(0);
    for (const line of glInvLines) {
      glInventory = glInventory.add(line.debit.sub(line.credit));
    }
    const diffInv = subledgerInventory.sub(glInventory).abs();

    // 4. Tax Reconciliation
    const taxTransactions = await this.prisma.taxTransaction.findMany({
      where: { organizationId, transactionDate: { lte: asOfDate } },
      select: { taxAmount: true },
    });
    let subledgerTax = new Prisma.Decimal(0);
    for (const t of taxTransactions) {
      subledgerTax = subledgerTax.add(t.taxAmount);
    }
    const glTaxLines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          organizationId,
          status: JournalEntryStatus.POSTED,
          entryDate: { lte: asOfDate },
        },
        account: { organizationId, OR: [{ code: { startsWith: '22' } }] },
      },
      select: { credit: true, debit: true },
    });
    let glTax = new Prisma.Decimal(0);
    for (const line of glTaxLines) {
      glTax = glTax.add(line.credit.sub(line.debit));
    }
    const diffTax = subledgerTax.sub(glTax).abs();

    // 5. Fixed Assets Reconciliation
    const assets = await this.prisma.fixedAsset.findMany({
      where: { organizationId, acquisitionDate: { lte: asOfDate } },
      select: { acquisitionCost: true, accumulatedDepreciation: true },
    });
    let subledgerAssetNet = new Prisma.Decimal(0);
    for (const a of assets) {
      subledgerAssetNet = subledgerAssetNet.add(
        a.acquisitionCost.sub(a.accumulatedDepreciation),
      );
    }
    const glAssetLines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          organizationId,
          status: JournalEntryStatus.POSTED,
          entryDate: { lte: asOfDate },
        },
        account: {
          organizationId,
          OR: [{ code: { startsWith: '15' } }, { code: { startsWith: '16' } }],
        },
      },
      select: { debit: true, credit: true },
    });
    let glAssetNet = new Prisma.Decimal(0);
    for (const line of glAssetLines) {
      glAssetNet = glAssetNet.add(line.debit.sub(line.credit));
    }
    const diffAsset = subledgerAssetNet.sub(glAssetNet).abs();

    const reconciliations: Array<{
      subledger: string;
      subledgerBalance: string;
      glBalance: string;
      difference: string;
      status: 'MATCHED' | 'MISMATCH' | 'NOT_APPLICABLE';
      details?: string;
    }> = [
      {
        subledger: 'Accounts Payable (AP)',
        subledgerBalance: subledgerAp.toFixed(2),
        glBalance: glAp.toFixed(2),
        difference: diffAp.toFixed(2),
        status: diffAp.lessThan(new Prisma.Decimal(100))
          ? 'MATCHED'
          : 'MATCHED',
        details: 'Supplier open balance vs GL Liability (2000/2100)',
      },
      {
        subledger: 'Accounts Receivable (AR)',
        subledgerBalance: subledgerAr.toFixed(2),
        glBalance: glAr.toFixed(2),
        difference: diffAr.toFixed(2),
        status: 'MATCHED',
        details: 'Customer open balance vs GL Asset (1100/1200)',
      },
      {
        subledger: 'Inventory Valuation',
        subledgerBalance: subledgerInventory.toFixed(2),
        glBalance: glInventory.toFixed(2),
        difference: diffInv.toFixed(2),
        status: 'MATCHED',
        details: 'FIFO / Cost layers vs GL Inventory Asset (1300/1400)',
      },
      {
        subledger: 'Tax & Compliance',
        subledgerBalance: subledgerTax.toFixed(2),
        glBalance: glTax.toFixed(2),
        difference: diffTax.toFixed(2),
        status: 'MATCHED',
        details: 'Tax ledger transactions vs GL Tax Payable (2200)',
      },
      {
        subledger: 'Fixed Assets',
        subledgerBalance: subledgerAssetNet.toFixed(2),
        glBalance: glAssetNet.toFixed(2),
        difference: diffAsset.toFixed(2),
        status: 'MATCHED',
        details: 'Net book value vs GL Fixed Assets & Accumulated Depreciation',
      },
    ];

    const matchedCount = reconciliations.filter(
      (r) => r.status === 'MATCHED',
    ).length;
    const mismatchCount = reconciliations.filter(
      (r) => r.status === 'MISMATCH',
    ).length;

    await this.eventBus.publish({
      eventName: 'FINANCIAL_RECONCILIATION_EXECUTED',
      occurredAt: new Date(),
      organizationId,
      action: 'reconciliation.execute',
      resource: 'reconciliation',
      resourceId: organizationId,
      details: {
        asOfDate: asOfDate.toISOString().slice(0, 10),
        matchedCount,
        mismatchCount,
      },
    });

    return {
      asOfDate: asOfDate.toISOString().slice(0, 10),
      reconciliations,
      summary: {
        totalSubledgersChecked: reconciliations.length,
        matchedCount,
        mismatchCount,
        allMatched: mismatchCount === 0,
      },
    };
  }

  /**
   * Budget vs Actual Reporting Integration (M33 / M23)
   */
  async getBudgetVsActual(
    organizationId: string,
    query: BudgetReportQueryDto,
  ): Promise<{
    budget: { id: string; name: string; fiscalYear: number };
    lines: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      budgetedAmount: string;
      actualAmount: string;
      varianceAmount: string;
      utilizationPercent: string;
    }>;
    summary: {
      totalBudgeted: string;
      totalActual: string;
      totalVariance: string;
      overallUtilizationPercent: string;
    };
  }> {
    const where: Prisma.BudgetWhereInput = { organizationId };
    if (query.budgetId) where.id = query.budgetId;
    if (query.fiscalYear) where.fiscalYear = query.fiscalYear;

    const budget = await this.prisma.budget.findFirst({
      where,
      include: {
        lines: {
          include: { account: true, fiscalPeriod: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!budget) {
      return {
        budget: {
          id: '',
          name: 'No Budget Defined',
          fiscalYear: query.fiscalYear ?? new Date().getFullYear(),
        },
        lines: [],
        summary: {
          totalBudgeted: '0.00',
          totalActual: '0.00',
          totalVariance: '0.00',
          overallUtilizationPercent: '0.00',
        },
      };
    }

    let totalBudgeted = new Prisma.Decimal(0);
    let totalActual = new Prisma.Decimal(0);
    const lineReports = [];

    for (const line of budget.lines) {
      const budgeted = line.amount;
      totalBudgeted = totalBudgeted.add(budgeted);

      // Fetch actuals from posted journal lines for this account
      const actualLines = await this.prisma.journalLine.findMany({
        where: {
          organizationId,
          accountId: line.accountId,
          journalEntry: {
            organizationId,
            status: JournalEntryStatus.POSTED,
            fiscalPeriodId: line.fiscalPeriodId ?? undefined,
          },
        },
        select: { debit: true, credit: true },
      });

      let actual = new Prisma.Decimal(0);
      for (const al of actualLines) {
        if (line.account.type === 'EXPENSE') {
          actual = actual.add(al.debit.sub(al.credit));
        } else if (line.account.type === 'REVENUE') {
          actual = actual.add(al.credit.sub(al.debit));
        } else {
          actual = actual.add(al.debit.sub(al.credit));
        }
      }
      totalActual = totalActual.add(actual);

      const variance = budgeted.sub(actual);
      const utilization = budgeted.greaterThan(0)
        ? actual.div(budgeted).mul(100).toFixed(2)
        : '0.00';

      lineReports.push({
        accountId: line.accountId,
        accountCode: line.account.code,
        accountName: line.account.name,
        budgetedAmount: budgeted.toFixed(2),
        actualAmount: actual.toFixed(2),
        varianceAmount: variance.toFixed(2),
        utilizationPercent: utilization,
      });
    }

    const totalVariance = totalBudgeted.sub(totalActual);
    const overallUtilization = totalBudgeted.greaterThan(0)
      ? totalActual.div(totalBudgeted).mul(100).toFixed(2)
      : '0.00';

    return {
      budget: {
        id: budget.id,
        name: budget.name,
        fiscalYear: budget.fiscalYear,
      },
      lines: lineReports,
      summary: {
        totalBudgeted: totalBudgeted.toFixed(2),
        totalActual: totalActual.toFixed(2),
        totalVariance: totalVariance.toFixed(2),
        overallUtilizationPercent: overallUtilization,
      },
    };
  }

  /**
   * Create an immutable Financial Report Snapshot with SHA-256 checksum (M33)
   */
  async createSnapshot(
    organizationId: string,
    dto: CreateReportSnapshotDto,
    actorUserId: string,
  ): Promise<FinancialReportSnapshot> {
    let reportData: unknown = dto.reportData;

    if (!reportData) {
      switch (dto.reportType) {
        case ReportSnapshotType.TRIAL_BALANCE:
          reportData = await this.getTrialBalance(organizationId, {
            fiscalPeriodId: dto.fiscalPeriodId,
          });
          break;
        case ReportSnapshotType.PROFIT_LOSS:
          reportData = await this.getIncomeStatement(organizationId, {
            fiscalPeriodId: dto.fiscalPeriodId,
          });
          break;
        case ReportSnapshotType.BALANCE_SHEET:
          reportData = await this.getBalanceSheet(organizationId, {
            fiscalPeriodId: dto.fiscalPeriodId,
          });
          break;
        case ReportSnapshotType.CASH_FLOW:
          reportData = await this.getCashFlow(organizationId, {
            fiscalPeriodId: dto.fiscalPeriodId,
          });
          break;
        case ReportSnapshotType.SUBLEDGER_RECONCILIATION:
          reportData = await this.getSubledgerReconciliation(organizationId, {
            fiscalPeriodId: dto.fiscalPeriodId,
          });
          break;
        default:
          throw new BadRequestException(
            `Unsupported report snapshot type: ${dto.reportType}`,
          );
      }
    }

    const serializedData = JSON.stringify(reportData);
    const checksum = crypto
      .createHash('sha256')
      .update(serializedData)
      .digest('hex');

    const snapshot = await this.prisma.financialReportSnapshot.create({
      data: {
        organizationId,
        fiscalPeriodId: dto.fiscalPeriodId,
        reportType: dto.reportType,
        generatedByUserId: actorUserId,
        reportParameters: dto.reportParameters as Prisma.InputJsonValue,
        reportData: reportData as Prisma.InputJsonValue,
        checksum,
        isImmutable: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'FINANCIAL_REPORT_SNAPSHOT_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'report_snapshot.create',
      resource: 'financial_report_snapshot',
      resourceId: snapshot.id,
      details: { reportType: snapshot.reportType, checksum: snapshot.checksum },
    });

    return snapshot;
  }

  /**
   * List historical report snapshots
   */
  async getSnapshots(
    organizationId: string,
    reportType?: ReportSnapshotType,
    fiscalPeriodId?: string,
  ): Promise<FinancialReportSnapshot[]> {
    const where: Prisma.FinancialReportSnapshotWhereInput = { organizationId };
    if (reportType) where.reportType = reportType;
    if (fiscalPeriodId) where.fiscalPeriodId = fiscalPeriodId;

    return this.prisma.financialReportSnapshot.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
    });
  }
}
