"use client";

import React, { useEffect, useState } from "react";
import { crmApi } from "../api/crm-api";

const REPORTS = [
  { key: "funnel", label: "1. Lead Funnel Report" },
  { key: "lead-sources", label: "2. Lead Source Performance" },
  { key: "pipeline", label: "3. Opportunity Pipeline Report" },
  { key: "weighted-forecast", label: "4. Weighted Pipeline Forecast" },
  { key: "aging", label: "5. Opportunity Aging Analysis" },
  { key: "win-loss", label: "6. Win / Loss Analysis" },
  { key: "sales-reps", label: "7. Sales Rep Performance" },
  { key: "sales-cycle", label: "8. Sales Cycle Duration" },
  { key: "quotation-conversion", label: "9. Quotation Conversion Rate" },
  { key: "customer-acquisition", label: "10. Customer Acquisition Report" },
  { key: "revenue-forecast", label: "11. Monthly Revenue Forecast" },
  { key: "activities", label: "12. Customer 360 Activity Log" },
];

export const CrmReportsView: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState("funnel");
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReport(selectedReport);
  }, [selectedReport]);

  const fetchReport = async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await crmApi.getReport(key);
      setReportData(data);
    } catch (err: any) {
      setError(err.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Report Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h2 className="text-base font-bold text-gray-900">
            CRM Commercial Intelligence & Reports
          </h2>
          <p className="text-xs text-gray-500">
            Real-time analytics across lead conversion, pipeline weighting, rep KPIs, and revenue
            forecasting
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedReport}
            onChange={(e) => setSelectedReport(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 bg-white"
          >
            {REPORTS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => fetchReport(selectedReport)}
            className="px-3 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Run Report
          </button>
        </div>
      </div>

      {/* Report Display */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 min-h-[400px]">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Calculating commercial report...</div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 bg-red-50 rounded-lg">{error}</div>
        ) : !reportData ? (
          <div className="p-8 text-center text-gray-400">Select a report to generate insights.</div>
        ) : (
          <div>
            {/* Custom Report Renderer based on selected key */}
            {selectedReport === "funnel" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <h3 className="font-bold text-sm text-gray-800">Lead Conversion Funnel</h3>
                  <span className="text-xs font-bold text-emerald-600">
                    Overall Conversion Rate: {reportData.conversionRate}%
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-3 text-center">
                  {reportData.funnel?.map((f: any) => (
                    <div key={f.stage} className="p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="text-lg font-bold text-indigo-700">{f.count}</div>
                      <div className="text-xs font-medium text-gray-800 mt-1">{f.stage}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {f.percentage}% of leads
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedReport === "win-loss" && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-gray-50 rounded border border-gray-200">
                    <div className="text-lg font-bold text-gray-900">{reportData.totalClosed}</div>
                    <div className="text-xs text-gray-500">Total Closed Deals</div>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded border border-emerald-200">
                    <div className="text-lg font-bold text-emerald-700">
                      {reportData.wonCount} (${reportData.wonValue})
                    </div>
                    <div className="text-xs text-emerald-800 font-medium">Won Opportunities</div>
                  </div>
                  <div className="p-3 bg-red-50 rounded border border-red-200">
                    <div className="text-lg font-bold text-red-700">
                      {reportData.lostCount} (${reportData.lostValue})
                    </div>
                    <div className="text-xs text-red-800 font-medium">Lost Opportunities</div>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded border border-indigo-200">
                    <div className="text-lg font-bold text-indigo-700">
                      {reportData.winRatePercentage}%
                    </div>
                    <div className="text-xs text-indigo-800 font-medium">Win Rate</div>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="font-semibold text-xs text-gray-700 mb-2">
                    Lost Deal Reasons Breakdown
                  </h4>
                  <table className="w-full text-left text-xs border border-gray-200 rounded">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                      <tr>
                        <th className="p-2">Reason</th>
                        <th className="p-2 text-center">Lost Count</th>
                        <th className="p-2 text-right">Share of Losses</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reportData.lostReasons?.map((r: any) => (
                        <tr key={r.reason}>
                          <td className="p-2 font-medium">{r.reason}</td>
                          <td className="p-2 text-center">{r.count}</td>
                          <td className="p-2 text-right">{r.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Generic Json view for other detailed reports */}
            {selectedReport !== "funnel" && selectedReport !== "win-loss" && (
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-gray-800 mb-2">
                  {REPORTS.find((r) => r.key === selectedReport)?.label}
                </h3>
                <pre className="bg-gray-50 p-4 rounded text-xs text-gray-700 overflow-x-auto border border-gray-200 font-mono">
                  {JSON.stringify(reportData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
