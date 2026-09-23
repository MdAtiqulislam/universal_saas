/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState } from "react";
import { GeneralLedgerReport } from "../types/accounting-reporting.types";
import { accountingReportingApi } from "../api/accounting-reporting-api";

export function GeneralLedgerView() {
  const [report, setReport] = useState<GeneralLedgerReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountId] = useState("");

  const loadGeneralLedger = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = {};
      if (accountId) params.accountId = accountId;
      const data = await accountingReportingApi.getGeneralLedger(params);
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load General Ledger");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadGeneralLedger();
  }, [loadGeneralLedger]);

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
        <p className="font-medium">Error loading General Ledger</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={loadGeneralLedger}
          className="mt-2 rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Ledger Filter Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">General Ledger Ledger Explorer</h3>
          <p className="text-xs text-slate-500">
            {report.account
              ? `Account: ${report.account.code} - ${report.account.name} (${report.account.type})`
              : "All Accounts Ledger Transactions"}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
            Opening:{" "}
            <span className="font-mono font-bold">${Number(report.openingBalance).toFixed(2)}</span>
          </div>
          <div className="rounded-lg bg-indigo-50 px-3 py-1.5 font-medium text-indigo-700">
            Closing:{" "}
            <span className="font-mono font-bold">${Number(report.closingBalance).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Ledger Lines Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 font-semibold text-slate-700">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Journal #</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3 text-right">Debit</th>
              <th className="px-4 py-3 text-right">Credit</th>
              <th className="px-4 py-3 text-right">Running Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {report.lines.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  No posted journal transactions found for this period.
                </td>
              </tr>
            ) : (
              report.lines.map((line) => (
                <tr key={line.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-slate-500">{line.entryDate}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-indigo-600">
                    {line.entryNumber}
                  </td>
                  <td className="px-4 py-2.5 text-slate-800">{line.description || "—"}</td>
                  <td className="px-4 py-2.5">
                    {line.sourceType ? (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {line.sourceType}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-900">
                    {Number(line.debit) > 0 ? `$${Number(line.debit).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-900">
                    {Number(line.credit) > 0 ? `$${Number(line.credit).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                    ${Number(line.runningBalance).toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
            <tr>
              <td colSpan={4} className="px-4 py-3">
                Total Activity
              </td>
              <td className="px-4 py-3 text-right font-mono">
                ${Number(report.totalDebits).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right font-mono">
                ${Number(report.totalCredits).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right font-mono">
                ${Number(report.closingBalance).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
