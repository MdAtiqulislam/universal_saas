import {
  FiscalPeriod,
  PeriodCloseRun,
  PeriodCloseCheck,
  PeriodCloseExecutionSummary,
  TrialBalanceReport,
  GeneralLedgerReport,
  BalanceSheetReport,
  IncomeStatementReport,
  CashFlowReport,
  FinancialKpisReport,
  SubledgerReconciliationReport,
  BudgetVsActualReport,
} from "../types/accounting-reporting.types";

const REPORTS_BASE = "/api/v1/accounting/reports";
const PERIODS_BASE = "/api/v1/accounting/fiscal-periods";

export const accountingReportingApi = {
  // Financial Statements & Reports
  async getTrialBalance(params?: Record<string, string>): Promise<TrialBalanceReport> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${REPORTS_BASE}/trial-balance${query}`);
    if (!res.ok) throw new Error("Failed to fetch Trial Balance report");
    return res.json();
  },

  async getGeneralLedger(params?: Record<string, string>): Promise<GeneralLedgerReport> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${REPORTS_BASE}/general-ledger${query}`);
    if (!res.ok) throw new Error("Failed to fetch General Ledger report");
    return res.json();
  },

  async getBalanceSheet(params?: Record<string, string>): Promise<BalanceSheetReport> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${REPORTS_BASE}/balance-sheet${query}`);
    if (!res.ok) throw new Error("Failed to fetch Balance Sheet report");
    return res.json();
  },

  async getIncomeStatement(params?: Record<string, string>): Promise<IncomeStatementReport> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${REPORTS_BASE}/income-statement${query}`);
    if (!res.ok) throw new Error("Failed to fetch Income Statement report");
    return res.json();
  },

  async getProfitLoss(params?: Record<string, string>): Promise<IncomeStatementReport> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${REPORTS_BASE}/profit-loss${query}`);
    if (!res.ok) throw new Error("Failed to fetch Profit & Loss report");
    return res.json();
  },

  async getCashFlow(params?: Record<string, string>): Promise<CashFlowReport> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${REPORTS_BASE}/cash-flow${query}`);
    if (!res.ok) throw new Error("Failed to fetch Cash Flow report");
    return res.json();
  },

  async getFinancialKpis(params?: Record<string, string>): Promise<FinancialKpisReport> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${REPORTS_BASE}/financial-kpis${query}`);
    if (!res.ok) throw new Error("Failed to fetch Financial KPIs");
    return res.json();
  },

  async getSubledgerReconciliation(
    params?: Record<string, string>,
  ): Promise<SubledgerReconciliationReport> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${REPORTS_BASE}/reconciliation${query}`);
    if (!res.ok) throw new Error("Failed to fetch Subledger Reconciliation report");
    return res.json();
  },

  async getBudgetVsActual(params?: Record<string, string>): Promise<BudgetVsActualReport> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${REPORTS_BASE}/budget-vs-actual${query}`);
    if (!res.ok) throw new Error("Failed to fetch Budget vs Actual report");
    return res.json();
  },

  // Accounting Periods Management
  async listPeriods(
    params?: Record<string, string>,
  ): Promise<{ periods: FiscalPeriod[]; total: number }> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${PERIODS_BASE}${query}`);
    if (!res.ok) throw new Error("Failed to fetch accounting periods");
    return res.json();
  },

  async getPeriod(id: string): Promise<FiscalPeriod> {
    const res = await fetch(`${PERIODS_BASE}/${id}`);
    if (!res.ok) throw new Error("Failed to fetch accounting period details");
    return res.json();
  },

  async createPeriod(payload: {
    name: string;
    startDate: string;
    endDate: string;
    fiscalYear?: number;
    periodNumber?: number;
  }): Promise<FiscalPeriod> {
    const res = await fetch(PERIODS_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to create period" }));
      throw new Error(err.message || "Failed to create period");
    }
    return res.json();
  },

  async startClose(id: string): Promise<FiscalPeriod> {
    const res = await fetch(`${PERIODS_BASE}/${id}/start-close`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to start period close");
    return res.json();
  },

  async validateClose(id: string): Promise<PeriodCloseExecutionSummary> {
    const res = await fetch(`${PERIODS_BASE}/${id}/validate-close`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to run period close validation");
    return res.json();
  },

  async closePeriod(id: string): Promise<FiscalPeriod> {
    const res = await fetch(`${PERIODS_BASE}/${id}/close`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to close accounting period" }));
      throw new Error(err.message || "Failed to close accounting period");
    }
    return res.json();
  },

  async reopenPeriod(id: string, payload: { reason: string }): Promise<FiscalPeriod> {
    const res = await fetch(`${PERIODS_BASE}/${id}/reopen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to reopen accounting period" }));
      throw new Error(err.message || "Failed to reopen accounting period");
    }
    return res.json();
  },

  async getCloseRuns(periodId: string): Promise<PeriodCloseRun[]> {
    const res = await fetch(`${PERIODS_BASE}/${periodId}/close-runs`);
    if (!res.ok) throw new Error("Failed to fetch period close runs");
    return res.json();
  },

  async getCloseChecks(runId: string): Promise<PeriodCloseCheck[]> {
    const res = await fetch(`${PERIODS_BASE}/close-runs/${runId}/checks`);
    if (!res.ok) throw new Error("Failed to fetch period close checks");
    return res.json();
  },
};
