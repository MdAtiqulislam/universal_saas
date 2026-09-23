"use client";

import React, { useEffect, useState } from "react";
import { BalanceSheetReport } from "../types/accounting-reporting.types";
import { accountingReportingApi } from "../api/accounting-reporting-api";

export function BalanceSheetView() {
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBalanceSheet();
  }, []);

  async function loadBalanceSheet() {
    try {
      setLoading(true);
      setError(null);
      const data = await accountingReportingApi.getBalanceSheet();
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load Balance Sheet");
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
        <p className="font-medium">Error loading Balance Sheet</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={loadBalanceSheet}
          className="mt-2 rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header & Balance Invariant Indicator */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Balance Sheet</h3>
          <p className="text-xs text-slate-500">As of Date: {report.asOfDate}</p>
        </div>
        <div
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            report.summary.isBalanced
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {report.summary.isBalanced
            ? "✓ Assets = Liabilities + Equity (Balanced)"
            : `⚠ Out of balance by $${Number(report.summary.difference).toFixed(2)}`}
        </div>
      </div>

      {/* Assets Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex justify-between border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
          <span>Assets</span>
          <span className="font-mono">${Number(report.assets.total).toFixed(2)}</span>
        </div>
        <div className="mt-3 divide-y divide-slate-100 text-xs">
          {report.assets.accounts.length === 0 ? (
            <p className="py-2 text-slate-400">No asset accounts found.</p>
          ) : (
            report.assets.accounts.map((acc) => (
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

      {/* Liabilities Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex justify-between border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
          <span>Liabilities</span>
          <span className="font-mono">${Number(report.liabilities.total).toFixed(2)}</span>
        </div>
        <div className="mt-3 divide-y divide-slate-100 text-xs">
          {report.liabilities.accounts.length === 0 ? (
            <p className="py-2 text-slate-400">No liability accounts found.</p>
          ) : (
            report.liabilities.accounts.map((acc) => (
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

      {/* Equity Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex justify-between border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
          <span>Equity</span>
          <span className="font-mono">${Number(report.equity.total).toFixed(2)}</span>
        </div>
        <div className="mt-3 divide-y divide-slate-100 text-xs">
          {report.equity.accounts.map((acc) => (
            <div key={acc.accountId} className="flex justify-between py-2 text-slate-600">
              <span>
                <span className="font-mono text-indigo-600">{acc.code}</span> - {acc.name}
              </span>
              <span className="font-mono font-medium text-slate-900">
                ${Number(acc.amount).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="flex justify-between py-2 font-medium text-slate-700">
            <span>Current Period Net Income</span>
            <span className="font-mono font-semibold text-indigo-600">
              ${Number(report.equity.currentPeriodNetIncome).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase">Total Assets</p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900">
            ${Number(report.summary.totalAssets).toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Total Liabilities & Equity
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900">
            ${Number(report.summary.totalLiabilitiesAndEquity).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}
