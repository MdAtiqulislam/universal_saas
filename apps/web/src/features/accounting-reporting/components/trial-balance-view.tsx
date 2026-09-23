"use client";

import React, { useEffect, useState } from "react";
import { TrialBalanceReport } from "../types/accounting-reporting.types";
import { accountingReportingApi } from "../api/accounting-reporting-api";

export function TrialBalanceView() {
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadTrialBalance();
  }, []);

  async function loadTrialBalance() {
    try {
      setLoading(true);
      setError(null);
      const data = await accountingReportingApi.getTrialBalance();
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load Trial Balance");
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
        <p className="font-medium">Error loading Trial Balance</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={loadTrialBalance}
          className="mt-2 rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const filteredAccounts = report.accounts.filter(
    (acc) =>
      acc.name.toLowerCase().includes(search.toLowerCase()) ||
      acc.code.toLowerCase().includes(search.toLowerCase()) ||
      acc.type.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {/* Header & Balance Status Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Trial Balance</h3>
          <p className="text-xs text-slate-500">
            Period: {report.period.startDate} to {report.period.endDate}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search account code/name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
          />
          <div
            className={`rounded-lg px-3 py-1 text-xs font-semibold ${
              report.summary.isBalanced
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {report.summary.isBalanced ? "✓ Balanced (Debits = Credits)" : "⚠ UNBALANCED"}
          </div>
        </div>
      </div>

      {/* Trial Balance Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 font-semibold text-slate-700">
            <tr>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Opening Debit</th>
              <th className="px-4 py-3 text-right">Opening Credit</th>
              <th className="px-4 py-3 text-right">Period Debit</th>
              <th className="px-4 py-3 text-right">Period Credit</th>
              <th className="px-4 py-3 text-right">Closing Debit</th>
              <th className="px-4 py-3 text-right">Closing Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  No accounts found matching criteria.
                </td>
              </tr>
            ) : (
              filteredAccounts.map((acc) => (
                <tr key={acc.accountId} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    <span className="font-mono text-indigo-600">{acc.code}</span> - {acc.name}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {acc.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    ${Number(acc.openingDebit).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    ${Number(acc.openingCredit).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-indigo-600 font-medium">
                    ${Number(acc.periodDebit).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-indigo-600 font-medium">
                    ${Number(acc.periodCredit).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">
                    ${Number(acc.closingDebit).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">
                    ${Number(acc.closingCredit).toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
            <tr>
              <td colSpan={2} className="px-4 py-3">
                Totals
              </td>
              <td className="px-4 py-3 text-right font-mono">
                ${Number(report.summary.totalOpeningDebit).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right font-mono">
                ${Number(report.summary.totalOpeningCredit).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-indigo-700">
                ${Number(report.summary.totalPeriodDebit).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-indigo-700">
                ${Number(report.summary.totalPeriodCredit).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right font-mono">
                ${Number(report.summary.totalClosingDebit).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right font-mono">
                ${Number(report.summary.totalClosingCredit).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
