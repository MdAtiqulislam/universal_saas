"use client";

import React, { useEffect, useState } from "react";
import { SubledgerReconciliationReport } from "../types/accounting-reporting.types";
import { accountingReportingApi } from "../api/accounting-reporting-api";

export function SubledgerReconciliationView() {
  const [report, setReport] = useState<SubledgerReconciliationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReconciliation();
  }, []);

  async function loadReconciliation() {
    try {
      setLoading(true);
      setError(null);
      const data = await accountingReportingApi.getSubledgerReconciliation();
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load Reconciliation report");
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
        <p className="font-medium">Error loading Subledger Reconciliation</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={loadReconciliation}
          className="mt-2 rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">
            Subledger to General Ledger Reconciliation
          </h3>
          <p className="text-xs text-slate-500">As of Date: {report.asOfDate}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadReconciliation}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            ↻ Re-evaluate Subledgers
          </button>
          <span
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
              report.summary.allMatched
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {report.summary.allMatched
              ? `✓ All ${report.summary.matchedCount} Subledgers Reconciled`
              : `⚠ ${report.summary.mismatchCount} Discrepancies Detected`}
          </span>
        </div>
      </div>

      {/* Reconciliation Matrix Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 font-semibold text-slate-700">
            <tr>
              <th className="px-4 py-3">Subledger Module</th>
              <th className="px-4 py-3">Mapping / Details</th>
              <th className="px-4 py-3 text-right">Subledger Balance</th>
              <th className="px-4 py-3 text-right">GL Account Balance</th>
              <th className="px-4 py-3 text-right">Variance / Difference</th>
              <th className="px-4 py-3 text-center">Reconciliation Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {report.reconciliations.map((rec, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-900">{rec.subledger}</td>
                <td className="px-4 py-3 text-slate-500">{rec.details || "—"}</td>
                <td className="px-4 py-3 text-right font-mono font-medium text-slate-900">
                  $
                  {Number(rec.subledgerBalance).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium text-slate-900">
                  ${Number(rec.glBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold">
                  <span
                    className={Number(rec.difference) === 0 ? "text-slate-500" : "text-amber-600"}
                  >
                    $
                    {Number(rec.difference).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      rec.status === "MATCHED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {rec.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
