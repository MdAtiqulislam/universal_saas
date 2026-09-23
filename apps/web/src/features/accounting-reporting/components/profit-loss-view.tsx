"use client";

import React, { useEffect, useState } from "react";
import { IncomeStatementReport } from "../types/accounting-reporting.types";
import { accountingReportingApi } from "../api/accounting-reporting-api";

export function ProfitLossView() {
  const [report, setReport] = useState<IncomeStatementReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfitLoss();
  }, []);

  async function loadProfitLoss() {
    try {
      setLoading(true);
      setError(null);
      const data = await accountingReportingApi.getProfitLoss();
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load Profit & Loss statement");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-medium">Error loading Profit & Loss</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={loadProfitLoss}
          className="mt-2 rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const netIncomeNum = Number(report.summary.netIncome);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">
            Profit & Loss Statement (Income Statement)
          </h3>
          <p className="text-xs text-slate-500">
            For Period: {report.period.startDate} to {report.period.endDate}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Net Income</p>
          <p
            className={`text-xl font-bold ${netIncomeNum >= 0 ? "text-emerald-600" : "text-red-600"}`}
          >
            $
            {netIncomeNum.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      {/* Revenue Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex justify-between border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
          <span>Operating Revenue</span>
          <span className="font-mono">${Number(report.revenue.total).toFixed(2)}</span>
        </div>
        <div className="mt-3 divide-y divide-slate-100 text-xs">
          {report.revenue.accounts.length === 0 ? (
            <p className="py-2 text-slate-400">No revenue recorded for period.</p>
          ) : (
            report.revenue.accounts.map((acc) => (
              <div key={acc.accountId} className="flex justify-between py-2 text-slate-600">
                <span>
                  <span className="font-mono text-indigo-600">{acc.code}</span> - {acc.name}
                </span>
                <span className="font-mono font-medium text-slate-900">
                  ${Number(acc.amount).toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Expenses Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex justify-between border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
          <span>Operating Expenses</span>
          <span className="font-mono">${Number(report.expenses.total).toFixed(2)}</span>
        </div>
        <div className="mt-3 divide-y divide-slate-100 text-xs">
          {report.expenses.accounts.length === 0 ? (
            <p className="py-2 text-slate-400">No expenses recorded for period.</p>
          ) : (
            report.expenses.accounts.map((acc) => (
              <div key={acc.accountId} className="flex justify-between py-2 text-slate-600">
                <span>
                  <span className="font-mono text-indigo-600">{acc.code}</span> - {acc.name}
                </span>
                <span className="font-mono font-medium text-slate-900">
                  ${Number(acc.amount).toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Net Summary */}
      <div className="rounded-xl border border-slate-300 bg-slate-50 p-5 font-semibold text-slate-900 shadow-sm">
        <div className="flex justify-between text-sm">
          <span>Total Revenue</span>
          <span className="font-mono text-emerald-700">
            ${Number(report.summary.totalRevenue).toFixed(2)}
          </span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span>Total Expenses</span>
          <span className="font-mono text-red-700">
            -${Number(report.summary.totalExpenses).toFixed(2)}
          </span>
        </div>
        <div className="mt-4 flex justify-between border-t-2 border-slate-300 pt-3 text-base font-bold">
          <span>Net Profit / (Loss)</span>
          <span className={`font-mono ${netIncomeNum >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            ${netIncomeNum.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
