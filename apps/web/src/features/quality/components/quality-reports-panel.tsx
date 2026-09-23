/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { qualityApi } from "../api/quality-api";

interface SummaryReport {
  overallPassRate: number;
  totalLots: number;
  acceptedLots: number;
  rejectedLots: number;
  totalInspectedQuantity: number;
  totalPassedQuantity: number;
  totalFailedQuantity: number;
  pendingLots: number;
}

interface PassFailItem {
  itemId: string;
  itemSku: string;
  itemName: string;
  totalLots: number;
  passedLots: number;
  failedLots: number;
  totalInspectedQty: number;
  passRate: number;
}

interface LotAgingReport {
  totalOpenLots: number;
  buckets: Record<string, { count: number; lots: unknown[] }>;
}

interface HoldsReport {
  activeHoldsCount: number;
  activeHeldQuantity: number;
  holds: Array<{
    id: string;
    holdNumber: string;
    item?: { name: string };
    warehouse?: { code: string };
    location?: { code: string };
    holdQuantity: number | string;
    reason: string;
    status: string;
  }>;
}

interface TrendItem {
  month: string;
  totalLots: number;
  passedLots: number;
  failedLots: number;
  passRate: number;
}

export function QualityReportsPanel() {
  const [activeReport, setActiveReport] = useState<string>("summary");
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const reportTabs = [
    { key: "summary", label: "1. Inspection Summary" },
    { key: "pass-fail", label: "2. Pass / Fail Rates" },
    { key: "lot-aging", label: "3. Inspection Lot Aging" },
    { key: "holds", label: "4. Quality Holds" },
    { key: "quarantine-aging", label: "5. Quarantine Aging" },
    { key: "ncr", label: "6. Non-Conformance" },
    { key: "ncr-aging", label: "7. NCR Aging" },
    { key: "capa", label: "8. CAPA Status" },
    { key: "supplier", label: "9. Supplier Quality" },
    { key: "customer", label: "10. Customer Issues" },
    { key: "rework-scrap", label: "11. Rework & Scrap" },
    { key: "trends", label: "12. Quality Trends" },
  ];

  const loadReportData = useCallback(async (reportKey: string) => {
    setLoading(true);
    setData(null);
    try {
      let res: unknown = null;
      switch (reportKey) {
        case "summary":
          res = await qualityApi.getInspectionSummaryReport();
          break;
        case "pass-fail":
          res = await qualityApi.getPassFailReport();
          break;
        case "lot-aging":
          res = await qualityApi.getLotAgingReport();
          break;
        case "holds":
          res = await qualityApi.getHoldReport();
          break;
        case "quarantine-aging":
          res = await qualityApi.getQuarantineAgingReport();
          break;
        case "ncr":
          res = await qualityApi.getNonConformanceReport();
          break;
        case "ncr-aging":
          res = await qualityApi.getNcrAgingReport();
          break;
        case "capa":
          res = await qualityApi.getCapaReport();
          break;
        case "supplier":
          res = await qualityApi.getSupplierQualityReport();
          break;
        case "customer":
          res = await qualityApi.getCustomerQualityReport();
          break;
        case "rework-scrap":
          res = await qualityApi.getReworkScrapReport();
          break;
        case "trends":
          res = await qualityApi.getQualityTrendsReport();
          break;
      }
      setData(res);
    } catch (err) {
      console.error("Failed to load report data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReportData(activeReport);
  }, [activeReport, loadReportData]);

  const summaryData = data as SummaryReport | null;
  const passFailData = data as PassFailItem[] | null;
  const lotAgingData = data as LotAgingReport | null;
  const holdsData = data as HoldsReport | null;
  const trendData = data as TrendItem[] | null;

  return (
    <div className="space-y-6">
      {/* Report Selection Tabs */}
      <div className="flex overflow-x-auto gap-1 border-b pb-2 no-scrollbar">
        {reportTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveReport(tab.key)}
            className={`px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition ${
              activeReport === tab.key
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Content View */}
      <div className="bg-card border rounded-xl p-6 min-h-[400px]">
        {loading ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            Generating real-time quality report data...
          </div>
        ) : !data ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            No data available for this report.
          </div>
        ) : (
          <div>
            {/* 1. Summary */}
            {activeReport === "summary" && summaryData && (
              <div className="space-y-6">
                <h3 className="text-base font-bold">Quality Inspection Executive Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted/20 border rounded-lg">
                    <div className="text-xs text-muted-foreground">Overall Pass Rate</div>
                    <div className="text-2xl font-bold text-emerald-600">
                      {summaryData.overallPassRate}%
                    </div>
                  </div>
                  <div className="p-4 bg-muted/20 border rounded-lg">
                    <div className="text-xs text-muted-foreground">Total Inspection Lots</div>
                    <div className="text-2xl font-bold">{summaryData.totalLots}</div>
                  </div>
                  <div className="p-4 bg-muted/20 border rounded-lg">
                    <div className="text-xs text-muted-foreground">Accepted Lots</div>
                    <div className="text-2xl font-bold text-emerald-600">
                      {summaryData.acceptedLots}
                    </div>
                  </div>
                  <div className="p-4 bg-muted/20 border rounded-lg">
                    <div className="text-xs text-muted-foreground">Rejected / Failed Lots</div>
                    <div className="text-2xl font-bold text-red-600">
                      {summaryData.rejectedLots}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted/10 border rounded-lg">
                    <div className="text-xs text-muted-foreground">Total Inspected Qty</div>
                    <div className="text-xl font-semibold">
                      {summaryData.totalInspectedQuantity}
                    </div>
                  </div>
                  <div className="p-4 bg-muted/10 border rounded-lg">
                    <div className="text-xs text-muted-foreground">Total Passed Qty</div>
                    <div className="text-xl font-semibold text-emerald-600">
                      {summaryData.totalPassedQuantity}
                    </div>
                  </div>
                  <div className="p-4 bg-muted/10 border rounded-lg">
                    <div className="text-xs text-muted-foreground">Total Failed Qty</div>
                    <div className="text-xl font-semibold text-red-600">
                      {summaryData.totalFailedQuantity}
                    </div>
                  </div>
                  <div className="p-4 bg-muted/10 border rounded-lg">
                    <div className="text-xs text-muted-foreground">Pending Lots</div>
                    <div className="text-xl font-semibold text-amber-600">
                      {summaryData.pendingLots}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Pass / Fail Rates */}
            {activeReport === "pass-fail" && passFailData && (
              <div className="space-y-4">
                <h3 className="text-base font-bold">Inspection Pass / Fail Rates by Item</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 border-b text-muted-foreground">
                      <tr>
                        <th className="p-3">Item / SKU</th>
                        <th className="p-3 text-right">Total Lots</th>
                        <th className="p-3 text-right">Passed Lots</th>
                        <th className="p-3 text-right">Failed Lots</th>
                        <th className="p-3 text-right">Total Inspected Qty</th>
                        <th className="p-3 text-right">Pass Rate %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {passFailData.map((row) => (
                        <tr key={row.itemId}>
                          <td className="p-3">
                            <div className="font-medium">{row.itemName}</div>
                            <div className="text-[11px] font-mono text-muted-foreground">
                              {row.itemSku}
                            </div>
                          </td>
                          <td className="p-3 text-right font-medium">{row.totalLots}</td>
                          <td className="p-3 text-right text-emerald-600 font-medium">
                            {row.passedLots}
                          </td>
                          <td className="p-3 text-right text-red-600 font-medium">
                            {row.failedLots}
                          </td>
                          <td className="p-3 text-right">{row.totalInspectedQty}</td>
                          <td className="p-3 text-right font-bold text-emerald-600">
                            {row.passRate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. Lot Aging */}
            {activeReport === "lot-aging" && lotAgingData && (
              <div className="space-y-6">
                <h3 className="text-base font-bold">
                  Open Inspection Lot Aging (Total Open: {lotAgingData.totalOpenLots})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {Object.entries(lotAgingData.buckets || {}).map(([bKey, bVal]) => (
                    <div key={bKey} className="p-4 bg-muted/20 border rounded-lg">
                      <div className="text-xs text-muted-foreground font-semibold">{bKey}</div>
                      <div className="text-2xl font-bold mt-1">{bVal.count} lots</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Holds */}
            {activeReport === "holds" && holdsData && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-bold">Active Quality Holds & Quantities</h3>
                  <span className="text-xs font-semibold px-2 py-1 bg-red-500/10 text-red-600 rounded">
                    Total Active: {holdsData.activeHoldsCount} ({holdsData.activeHeldQuantity}{" "}
                    units)
                  </span>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 border-b text-muted-foreground">
                      <tr>
                        <th className="p-3">Hold #</th>
                        <th className="p-3">Item</th>
                        <th className="p-3">Warehouse / Location</th>
                        <th className="p-3 text-right">Hold Qty</th>
                        <th className="p-3">Reason</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(holdsData.holds || []).map((h) => (
                        <tr key={h.id}>
                          <td className="p-3 font-mono">{h.holdNumber}</td>
                          <td className="p-3">{h.item?.name}</td>
                          <td className="p-3">
                            {h.warehouse?.code} / {h.location?.code}
                          </td>
                          <td className="p-3 text-right font-medium">{h.holdQuantity}</td>
                          <td className="p-3">{h.reason}</td>
                          <td className="p-3 font-bold text-[10px]">{h.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 12. Quality Trends */}
            {activeReport === "trends" && trendData && (
              <div className="space-y-4">
                <h3 className="text-base font-bold">Monthly Quality Pass Rate Trends</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 border-b text-muted-foreground">
                      <tr>
                        <th className="p-3">Period (YYYY-MM)</th>
                        <th className="p-3 text-right">Total Lots</th>
                        <th className="p-3 text-right">Passed Lots</th>
                        <th className="p-3 text-right">Failed Lots</th>
                        <th className="p-3 text-right">Pass Rate %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {trendData.map((t) => (
                        <tr key={t.month}>
                          <td className="p-3 font-mono font-medium">{t.month}</td>
                          <td className="p-3 text-right font-medium">{t.totalLots}</td>
                          <td className="p-3 text-right text-emerald-600 font-medium">
                            {t.passedLots}
                          </td>
                          <td className="p-3 text-right text-red-600 font-medium">
                            {t.failedLots}
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-600">
                            {t.passRate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Fallback JSON Viewer for Other Reports */}
            {activeReport !== "summary" &&
              activeReport !== "pass-fail" &&
              activeReport !== "lot-aging" &&
              activeReport !== "holds" &&
              activeReport !== "trends" && (
                <div className="space-y-4">
                  <h3 className="text-base font-bold capitalize">
                    {activeReport.replace(/-/g, " ")} Intelligence Report
                  </h3>
                  <div className="bg-muted/20 border rounded-lg p-4 font-mono text-xs overflow-x-auto max-h-96">
                    <pre>{JSON.stringify(data, null, 2)}</pre>
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
