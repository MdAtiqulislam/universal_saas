/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { SupplierQualitySummaryItem, QualityInspectionLot } from "../types/quality.types";
import { qualityApi } from "../api/quality-api";

interface ScorecardData {
  supplier: { id: string; code: string; name: string };
  summary: SupplierQualitySummaryItem;
  recentLots: QualityInspectionLot[];
}

export function SupplierQualityPanel() {
  const [suppliers, setSuppliers] = useState<SupplierQualitySummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedScorecard, setSelectedScorecard] = useState<ScorecardData | null>(null);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await qualityApi.getSupplierQualitySummary();
      setSuppliers(data);
    } catch (err) {
      console.error("Failed to load supplier quality summaries", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const handleViewScorecard = async (supplierId: string) => {
    try {
      const data = await qualityApi.getSupplierScorecard(supplierId);
      setSelectedScorecard(data);
    } catch (err) {
      console.error("Failed to load scorecard", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Supplier Performance Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 border-b text-muted-foreground">
              <tr>
                <th className="p-3">Supplier</th>
                <th className="p-3 text-right">Total Lots</th>
                <th className="p-3 text-right">Accepted Lots</th>
                <th className="p-3 text-right">Rejected Lots</th>
                <th className="p-3 text-right">Lot Rejection %</th>
                <th className="p-3 text-right">Defect %</th>
                <th className="p-3 text-right">NCRs</th>
                <th className="p-3 text-right">Quality Score</th>
                <th className="p-3 text-right">Scorecard</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    Loading supplier quality metrics...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    No supplier quality data available.
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.supplierId} className="hover:bg-muted/20 transition">
                    <td className="p-3">
                      <div className="font-medium text-foreground">{s.supplierName}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {s.supplierCode}
                      </div>
                    </td>
                    <td className="p-3 text-right font-medium">{s.totalLots}</td>
                    <td className="p-3 text-right text-emerald-600 font-medium">
                      {s.acceptedLots}
                    </td>
                    <td className="p-3 text-right text-red-600 font-medium">{s.rejectedLots}</td>
                    <td className="p-3 text-right font-medium">
                      <span className={s.lotRejectionRate > 5 ? "text-red-600 font-bold" : ""}>
                        {s.lotRejectionRate}%
                      </span>
                    </td>
                    <td className="p-3 text-right font-medium">{s.defectRate}%</td>
                    <td className="p-3 text-right font-medium">{s.ncrCount}</td>
                    <td className="p-3 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-bold text-[11px] ${
                          s.qualityScore >= 90
                            ? "bg-emerald-500/10 text-emerald-600"
                            : s.qualityScore >= 75
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-red-500/10 text-red-600"
                        }`}
                      >
                        {s.qualityScore} / 100
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => void handleViewScorecard(s.supplierId)}
                        className="px-2.5 py-1 text-xs font-medium border rounded hover:bg-muted"
                      >
                        View Scorecard
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scorecard Details Modal */}
      {selectedScorecard && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="text-base font-bold">
                  Supplier Scorecard: {selectedScorecard.supplier?.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Vendor Code: {selectedScorecard.supplier?.code}
                </p>
              </div>
              <button
                onClick={() => setSelectedScorecard(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            {/* Scorecard Metrics Overview */}
            {selectedScorecard.summary && (
              <div className="grid grid-cols-3 gap-3 p-4 bg-muted/20 border rounded-lg">
                <div>
                  <div className="text-[11px] text-muted-foreground">Total Lots Inspected</div>
                  <div className="text-lg font-bold">{selectedScorecard.summary.totalLots}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Rejection Rate</div>
                  <div className="text-lg font-bold text-red-600">
                    {selectedScorecard.summary.lotRejectionRate}%
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Quality Score</div>
                  <div className="text-lg font-bold text-emerald-600">
                    {selectedScorecard.summary.qualityScore} / 100
                  </div>
                </div>
              </div>
            )}

            {/* Recent Inspection History */}
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Recent Inspection Lots
              </h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 text-muted-foreground border-b">
                    <tr>
                      <th className="p-2">Lot #</th>
                      <th className="p-2">Item</th>
                      <th className="p-2">Total Qty</th>
                      <th className="p-2">Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(selectedScorecard.recentLots || []).map((l) => (
                      <tr key={l.id}>
                        <td className="p-2 font-mono">{l.lotNumber}</td>
                        <td className="p-2">{l.item?.name}</td>
                        <td className="p-2">{l.totalQuantity}</td>
                        <td className="p-2 font-semibold text-[10px]">{l.decision || "PENDING"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
