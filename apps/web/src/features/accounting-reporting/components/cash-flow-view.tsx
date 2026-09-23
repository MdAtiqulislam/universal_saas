"use client";

import React, { useEffect, useState } from "react";
import { CashFlowReport } from "../types/accounting-reporting.types";
import { accountingReportingApi } from "../api/accounting-reporting-api";

export function CashFlowView() {
  const [report, setReport] = useState<CashFlowReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCashFlow();
  }, []);

  async function loadCashFlow() {
    try {
      setLoading(true);
      setError(null);
      const data = await accountingReportingApi.getCashFlow();
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load Cash Flow statement");
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
        <p className="font-medium">Error loading Cash Flow statement</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={loadCashFlow}
          className="mt-2 rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Statement of Cash Flows</h3>
          <p className="text-xs text-slate-500">
            Period: {report.period.startDate} to {report.period.endDate}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Closing Cash</p>
          <p className="text-xl font-bold text-indigo-600">
            $
            {Number(report.summary.closingCash).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      {/* Opening Cash */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex justify-between text-sm font-semibold text-slate-800">
          <span>Opening Cash & Cash Equivalents</span>
          <span className="font-mono">${Number(report.summary.openingCash).toFixed(2)}</span>
        </div>
      </div>

      {/* Operating Activities */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex justify-between border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
          <span>Cash Flows from Operating Activities</span>
          <span className="font-mono">${Number(report.operatingActivities.total).toFixed(2)}</span>
        </div>
        <div className="mt-3 divide-y divide-slate-100 text-xs">
          {report.operatingActivities.items.length === 0 ? (
            <p className="py-2 text-slate-400">No operating cash movements in period.</p>
          ) : (
            report.operatingActivities.items.map((item, idx) => (
              <div key={idx} className="flex justify-between py-2 text-slate-600">
                <span>{item.description}</span>
                <span className="font-mono font-medium text-slate-900">
                  ${Number(item.amount).toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Investing Activities */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex justify-between border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
          <span>Cash Flows from Investing Activities</span>
          <span className="font-mono">${Number(report.investingActivities.total).toFixed(2)}</span>
        </div>
        <div className="mt-3 divide-y divide-slate-100 text-xs">
          {report.investingActivities.items.length === 0 ? (
            <p className="py-2 text-slate-400">No investing cash movements in period.</p>
          ) : (
            report.investingActivities.items.map((item, idx) => (
              <div key={idx} className="flex justify-between py-2 text-slate-600">
                <span>{item.description}</span>
                <span className="font-mono font-medium text-slate-900">
                  ${Number(item.amount).toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Financing Activities */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex justify-between border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
          <span>Cash Flows from Financing Activities</span>
          <span className="font-mono">${Number(report.financingActivities.total).toFixed(2)}</span>
        </div>
        <div className="mt-3 divide-y divide-slate-100 text-xs">
          {report.financingActivities.items.length === 0 ? (
            <p className="py-2 text-slate-400">No financing cash movements in period.</p>
          ) : (
            report.financingActivities.items.map((item, idx) => (
              <div key={idx} className="flex justify-between py-2 text-slate-600">
                <span>{item.description}</span>
                <span className="font-mono font-medium text-slate-900">
                  ${Number(item.amount).toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-slate-300 bg-slate-50 p-5 font-semibold text-slate-900 shadow-sm">
        <div className="flex justify-between text-sm">
          <span>Net Change in Cash</span>
          <span
            className={`font-mono ${Number(report.summary.netCashChange) >= 0 ? "text-emerald-700" : "text-red-700"}`}
          >
            ${Number(report.summary.netCashChange).toFixed(2)}
          </span>
        </div>
        <div className="mt-3 flex justify-between border-t-2 border-slate-300 pt-3 text-base font-bold">
          <span>Closing Cash & Cash Equivalents</span>
          <span className="font-mono text-indigo-700">
            ${Number(report.summary.closingCash).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
