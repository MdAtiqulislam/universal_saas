/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { returnsApi } from "../api/returns-api";

type ReportType =
  | "summary"
  | "customer"
  | "supplier"
  | "reasons"
  | "dispositions"
  | "financial-impact"
  | "aging"
  | "quality"
  | "trends";

export const ReturnsReports: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>("summary");
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await returnsApi.getReport(reportType);
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [reportType]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const reportTabs: Array<{ id: ReportType; label: string }> = [
    { id: "summary", label: "1. Summary" },
    { id: "customer", label: "2. Customer Returns" },
    { id: "supplier", label: "3. Supplier Returns" },
    { id: "reasons", label: "4. Reason Analysis" },
    { id: "dispositions", label: "5. Dispositions" },
    { id: "financial-impact", label: "6. Financial Impact" },
    { id: "aging", label: "7. RMA Aging" },
    { id: "quality", label: "8. Quality Linked" },
    { id: "trends", label: "9. Trend Analysis" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Returns & RMA Intelligence Reports</h2>
        <p className="text-sm text-slate-500">
          Reverse logistics analytics, financial recovery, aging metrics, and defect causation.
        </p>
      </div>

      {/* Report Nav */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {reportTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setReportType(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              reportType === t.id
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg bg-red-50 p-4 text-xs text-red-600">{error}</div>}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-sm text-slate-500">Generating report...</div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* Render formatted JSON or structured cards */}
          <pre className="max-h-[600px] overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-emerald-400 font-mono">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
