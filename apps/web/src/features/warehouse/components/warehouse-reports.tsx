"use client";

import React, { useState, useEffect } from "react";
import { warehouseApi } from "../api/warehouse-api";

export function WarehouseReports() {
  const [activeReport, setActiveReport] = useState<
    | "accuracy"
    | "stock-by-loc"
    | "occupancy"
    | "task-perf"
    | "count-var"
    | "quarantine"
    | "replenish"
    | "transfers"
    | "picking-velocity"
  >("accuracy");

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      let data: any = null;
      switch (activeReport) {
        case "accuracy":
          data = await warehouseApi.getAccuracyRateReport();
          break;
        case "stock-by-loc":
          data = await warehouseApi.getStockByLocationReport();
          break;
        case "occupancy":
          data = await warehouseApi.getLocationOccupancyReport();
          break;
        case "task-perf":
          data = await warehouseApi.getTaskPerformanceReport();
          break;
        case "count-var":
          data = await warehouseApi.getCountVariancesReport();
          break;
        case "quarantine":
          data = await warehouseApi.getQuarantineAgingReport();
          break;
        case "replenish":
          data = await warehouseApi.getReplenishmentHistoryReport();
          break;
        case "transfers":
          data = await warehouseApi.getTransferAnalysisReport();
          break;
        case "picking-velocity":
          data = await warehouseApi.getPickingVelocityReport();
          break;
      }
      setReportData(data);
    } catch (err) {
      console.error("Failed to load report", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeReport]);

  const reportTabs = [
    { key: "accuracy", label: "Inventory Accuracy Rate" },
    { key: "stock-by-loc", label: "Stock by Location" },
    { key: "occupancy", label: "Location Occupancy" },
    { key: "task-perf", label: "Task Performance" },
    { key: "count-var", label: "Count Variances" },
    { key: "quarantine", label: "Quarantine Aging" },
    { key: "replenish", label: "Replenishment History" },
    { key: "transfers", label: "Transfer Volume" },
    { key: "picking-velocity", label: "Picking Velocity" },
  ];

  return (
    <div className="space-y-6">
      {/* Report Switcher Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        {reportTabs.map((t) => {
          const isActive = activeReport === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveReport(t.key as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Report Content View */}
      <div className="border rounded-xl bg-card p-6 min-h-[300px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm">
            Generating report analytics...
          </div>
        ) : !reportData ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No report data available.
          </div>
        ) : (
          <div>
            {activeReport === "accuracy" && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold">Inventory Accuracy & Discrepancy Rate</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-xl bg-muted/10">
                    <div className="text-xs text-muted-foreground">Accuracy Percentage</div>
                    <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {reportData.accuracyRatePercentage}%
                    </div>
                  </div>
                  <div className="p-4 border rounded-xl bg-muted/10">
                    <div className="text-xs text-muted-foreground">Exact Match Count Lines</div>
                    <div className="text-3xl font-bold mt-1">{reportData.exactMatchLines}</div>
                  </div>
                  <div className="p-4 border rounded-xl bg-muted/10">
                    <div className="text-xs text-muted-foreground">Total Lines Counted</div>
                    <div className="text-3xl font-bold mt-1">{reportData.totalLinesCounted}</div>
                  </div>
                </div>
              </div>
            )}

            {activeReport === "stock-by-loc" && Array.isArray(reportData) && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold">Stock Position by Warehouse Location</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="uppercase bg-muted/50 border-b text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Location</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">SKU & Item</th>
                        <th className="px-3 py-2 text-right">On Hand</th>
                        <th className="px-3 py-2 text-right">Reserved</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {reportData.map((r: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-bold">{r.locationCode}</td>
                          <td className="px-3 py-2">{r.locationType}</td>
                          <td className="px-3 py-2 font-medium">
                            {r.itemSku} - {r.itemName}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold">{r.onHand}</td>
                          <td className="px-3 py-2 text-right font-mono text-amber-600">
                            {r.reserved}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeReport === "task-perf" && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold">Warehouse Operational Task Performance</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-xl bg-muted/10 space-y-2">
                    <div className="font-semibold text-sm">Putaway Completion Rate</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {reportData.putawayMetrics?.completionRate?.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {reportData.putawayMetrics?.completed} of {reportData.putawayMetrics?.total}{" "}
                      tasks completed
                    </div>
                  </div>

                  <div className="p-4 border rounded-xl bg-muted/10 space-y-2">
                    <div className="font-semibold text-sm">Picking Fulfillment Rate</div>
                    <div className="text-2xl font-bold text-emerald-600">
                      {reportData.pickingMetrics?.completionRate?.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {reportData.pickingMetrics?.completed} of {reportData.pickingMetrics?.total}{" "}
                      picks completed
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeReport === "count-var" && reportData.summary && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold">Physical Count Discrepancies & Shrinkage</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-xl bg-muted/10">
                    <div className="text-xs text-muted-foreground">Lines with Variances</div>
                    <div className="text-2xl font-bold text-amber-600 mt-1">
                      {reportData.summary.linesWithVariance}
                    </div>
                  </div>
                  <div className="p-4 border rounded-xl bg-muted/10">
                    <div className="text-xs text-muted-foreground">Total Gain Quantity</div>
                    <div className="text-2xl font-bold text-emerald-600 mt-1">
                      +{reportData.summary.totalGainsQuantity}
                    </div>
                  </div>
                  <div className="p-4 border rounded-xl bg-muted/10">
                    <div className="text-xs text-muted-foreground">Total Shrinkage Quantity</div>
                    <div className="text-2xl font-bold text-rose-600 mt-1">
                      -{reportData.summary.totalShrinkageQuantity}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeReport === "quarantine" && reportData.records && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold">Quarantine Lot Aging & Disposition</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-xl bg-muted/10">
                    <div className="text-xs text-muted-foreground">Active Quarantined Lots</div>
                    <div className="text-2xl font-bold text-amber-600 mt-1">
                      {reportData.activeQuarantined}
                    </div>
                  </div>
                  <div className="p-4 border rounded-xl bg-muted/10">
                    <div className="text-xs text-muted-foreground">Released Lots</div>
                    <div className="text-2xl font-bold text-emerald-600 mt-1">
                      {reportData.released}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeReport === "picking-velocity" && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold">Picking Accuracy & Velocity</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-xl bg-muted/10">
                    <div className="text-xs text-muted-foreground">Fulfillment Rate</div>
                    <div className="text-3xl font-bold text-emerald-600 mt-1">
                      {reportData.fulfillmentRatePercentage}%
                    </div>
                  </div>
                  <div className="p-4 border rounded-xl bg-muted/10">
                    <div className="text-xs text-muted-foreground">Fully Picked Lines</div>
                    <div className="text-3xl font-bold mt-1">{reportData.fullyPickedLines}</div>
                  </div>
                  <div className="p-4 border rounded-xl bg-muted/10">
                    <div className="text-xs text-muted-foreground">Total Pick Lines</div>
                    <div className="text-3xl font-bold mt-1">{reportData.totalPickLines}</div>
                  </div>
                </div>
              </div>
            )}

            {(activeReport === "occupancy" ||
              activeReport === "replenish" ||
              activeReport === "transfers") && (
              <pre className="text-xs bg-muted/20 p-4 rounded-lg overflow-x-auto font-mono">
                {JSON.stringify(reportData, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
