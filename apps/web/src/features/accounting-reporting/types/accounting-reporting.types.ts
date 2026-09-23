export type FiscalPeriodStatus = "OPEN" | "CLOSING" | "CLOSED";

export type PeriodCloseCheckType =
  | "TRIAL_BALANCE"
  | "UNBALANCED_JOURNALS"
  | "UNPOSTED_TRANSACTIONS"
  | "AP_RECONCILIATION"
  | "AR_RECONCILIATION"
  | "INVENTORY_RECONCILIATION"
  | "TAX_RECONCILIATION"
  | "PAYROLL_RECONCILIATION"
  | "FIXED_ASSET_RECONCILIATION"
  | "COGS_RECONCILIATION"
  | "SUBLEDGER_RECONCILIATION";

export type PeriodCloseCheckStatus = "PASSED" | "WARNING" | "FAILED" | "NOT_APPLICABLE";
export type PeriodCloseRunStatus =
  "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "CLOSED" | "CANCELLED";
export type ReportSnapshotType =
  "TRIAL_BALANCE" | "PROFIT_LOSS" | "BALANCE_SHEET" | "CASH_FLOW" | "SUBLEDGER_RECONCILIATION";

export interface FiscalPeriod {
  id: string;
  organizationId: string;
  name: string;
  fiscalYear?: number;
  periodNumber?: number;
  startDate: string;
  endDate: string;
  status: FiscalPeriodStatus;
  closedAt?: string;
  closedByUserId?: string;
  reopenedAt?: string;
  reopenedByUserId?: string;
  reopenReason?: string;
  closeRunId?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    journalEntries: number;
  };
  closeRuns?: PeriodCloseRun[];
}

export interface PeriodCloseCheck {
  id: string;
  organizationId: string;
  closeRunId: string;
  checkType: PeriodCloseCheckType;
  status: PeriodCloseCheckStatus;
  severity: string;
  message: string;
  affectedCount: number;
  metadata?: Record<string, unknown>;
  evaluatedAt: string;
}

export interface PeriodCloseRun {
  id: string;
  organizationId: string;
  fiscalPeriodId: string;
  initiatedByUserId: string;
  status: PeriodCloseRunStatus;
  startedAt: string;
  completedAt?: string;
  validationSummary?: string;
  failureInformation?: unknown;
  idempotencyKey?: string;
  checks?: PeriodCloseCheck[];
}

export interface PeriodCloseExecutionSummary {
  runId: string;
  fiscalPeriodId: string;
  status: PeriodCloseRunStatus;
  canClose: boolean;
  checks: Array<{
    checkType: PeriodCloseCheckType;
    status: PeriodCloseCheckStatus;
    severity: "BLOCKING" | "WARNING" | "INFO";
    message: string;
    affectedCount: number;
    metadata?: Record<string, unknown>;
  }>;
  summaryMessage: string;
}

export interface TrialBalanceAccountRow {
  accountId: string;
  code: string;
  name: string;
  type: string;
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
    type: string;
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

export interface FinancialKpisReport {
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
}

export interface SubledgerReconciliationReport {
  asOfDate: string;
  reconciliations: Array<{
    subledger: string;
    subledgerBalance: string;
    glBalance: string;
    difference: string;
    status: "MATCHED" | "MISMATCH" | "NOT_APPLICABLE";
    details?: string;
  }>;
  summary: {
    totalSubledgersChecked: number;
    matchedCount: number;
    mismatchCount: number;
    allMatched: boolean;
  };
}

export interface BudgetVsActualReport {
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
}
