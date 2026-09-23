"use client";

import React, { useState, useEffect } from "react";
import { securityApi } from "../api/security-api";

const REPORT_DEFINITIONS = [
  { id: "auth-activity", name: "1. Authentication Activity Report" },
  { id: "failed-logins", name: "2. Failed Login & Brute Force Report" },
  { id: "active-sessions", name: "3. Active Session Report" },
  { id: "privileged-actions", name: "4. Privileged Action Report" },
  { id: "auth-failures", name: "5. Authorization Failure Report" },
  { id: "tenant-events", name: "6. Tenant Security Events Report" },
  { id: "rate-limits", name: "7. API Rate Limit Violation Report" },
  { id: "suspicious-activity", name: "8. Suspicious Activity Report" },
  { id: "incident-timeline", name: "9. Security Incident Timeline" },
  { id: "admin-changes", name: "10. Administrative Change Report" },
];

export function SecurityReports() {
  const [selectedReport, setSelectedReport] = useState("auth-activity");
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await securityApi.getReport(selectedReport);
      setReportData(data);
    } catch {
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedReport]);

  return (
    <div className="space-y-6">
      {/* Report Selector Header */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">
            Select Security Compliance Report:
          </label>
          <select
            value={selectedReport}
            onChange={(e) => setSelectedReport(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800 font-medium min-w-[280px]"
          >
            {REPORT_DEFINITIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchReport}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
        >
          Generate Report
        </button>
      </div>

      {/* Report Content View */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        {loading ? (
          <div className="py-12 text-center text-gray-500">
            Generating compliance report metrics...
          </div>
        ) : !reportData ? (
          <div className="py-12 text-center text-gray-400">No report data generated.</div>
        ) : (
          <div className="space-y-4">
            <div className="border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm">{reportData.reportName}</h3>
              <p className="text-xs text-gray-500">
                Tenant-isolated compliance dataset & telemetry
              </p>
            </div>

            {reportData.summary && (
              <div className="p-4 bg-gray-50 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                {Object.entries(reportData.summary).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-gray-500 uppercase text-[10px] font-bold block">{k}</span>
                    <span className="text-gray-900 font-bold text-sm">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 bg-gray-900 text-emerald-400 rounded-lg text-xs font-mono max-h-96 overflow-y-auto">
              <pre>{JSON.stringify(reportData, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
