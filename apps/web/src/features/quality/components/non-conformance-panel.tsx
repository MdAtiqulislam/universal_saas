/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { NonConformance } from "../types/quality.types";
import { qualityApi } from "../api/quality-api";

export function NonConformancePanel() {
  const [ncrs, setNcrs] = useState<NonConformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNcr, setSelectedNcr] = useState<NonConformance | null>(null);
  const [containmentText, setContainmentText] = useState("");
  const [rootCauseText, setRootCauseText] = useState("");
  const [dispositionText, setDispositionText] = useState("");
  const [isCapaReq, setIsCapaReq] = useState(false);
  const [actionModal, setActionModal] = useState<
    "contain" | "investigate" | "disposition" | "close" | null
  >(null);

  const loadNcrs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await qualityApi.getNonConformances();
      setNcrs(data);
    } catch (err) {
      console.error("Failed to load NCRs", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNcrs();
  }, [loadNcrs]);

  const handleAction = async () => {
    if (!selectedNcr) return;
    try {
      if (actionModal === "contain") {
        await qualityApi.containNonConformance(selectedNcr.id, containmentText);
      } else if (actionModal === "investigate") {
        await qualityApi.investigateNonConformance(selectedNcr.id, rootCauseText);
      } else if (actionModal === "disposition") {
        await qualityApi.dispositionNonConformance(selectedNcr.id, {
          disposition: dispositionText,
          isCapaRequired: isCapaReq,
        });
      } else if (actionModal === "close") {
        await qualityApi.closeNonConformance(selectedNcr.id);
      }
      setActionModal(null);
      setSelectedNcr(null);
      void loadNcrs();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-500/15 text-red-700 font-bold border border-red-500/30";
      case "HIGH":
        return "bg-amber-500/15 text-amber-700 font-bold border border-amber-500/30";
      case "MEDIUM":
        return "bg-blue-500/15 text-blue-700 font-bold border border-blue-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 border-b text-muted-foreground">
              <tr>
                <th className="p-3">NCR #</th>
                <th className="p-3">Title</th>
                <th className="p-3">Item / SKU</th>
                <th className="p-3">Supplier / Customer</th>
                <th className="p-3 text-right">Qty Affected</th>
                <th className="p-3">Severity</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Loading non-conformance records...
                  </td>
                </tr>
              ) : ncrs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No open non-conformances found.
                  </td>
                </tr>
              ) : (
                ncrs.map((ncr) => (
                  <tr key={ncr.id} className="hover:bg-muted/20 transition">
                    <td className="p-3 font-mono font-medium">{ncr.ncrNumber}</td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">{ncr.title}</div>
                      <div className="text-[11px] text-muted-foreground line-clamp-1">
                        {ncr.description}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {ncr.item?.name} ({ncr.item?.sku})
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {ncr.supplier?.name || ncr.customer?.name || "Internal Production"}
                    </td>
                    <td className="p-3 text-right font-medium">{ncr.quantityAffected}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] ${getSeverityBadge(ncr.severity)}`}
                      >
                        {ncr.severity}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-[10px]">
                      <span className="bg-muted px-2 py-0.5 rounded">{ncr.status}</span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      {ncr.status === "OPEN" && (
                        <button
                          onClick={() => {
                            setSelectedNcr(ncr);
                            setActionModal("contain");
                          }}
                          className="px-2 py-1 text-xs font-medium border rounded hover:bg-muted"
                        >
                          Contain
                        </button>
                      )}
                      {(ncr.status === "CONTAINED" || ncr.status === "OPEN") && (
                        <button
                          onClick={() => {
                            setSelectedNcr(ncr);
                            setActionModal("investigate");
                          }}
                          className="px-2 py-1 text-xs font-medium border rounded hover:bg-muted"
                        >
                          Investigate
                        </button>
                      )}
                      {(ncr.status === "ROOT_CAUSE_IDENTIFIED" || ncr.status === "CONTAINED") && (
                        <button
                          onClick={() => {
                            setSelectedNcr(ncr);
                            setActionModal("disposition");
                          }}
                          className="px-2 py-1 text-xs font-semibold bg-primary text-primary-foreground rounded hover:opacity-90"
                        >
                          Disposition
                        </button>
                      )}
                      {ncr.status !== "CLOSED" && ncr.status !== "CANCELLED" && (
                        <button
                          onClick={() => {
                            setSelectedNcr(ncr);
                            setActionModal("close");
                          }}
                          className="px-2 py-1 text-xs font-medium border rounded hover:bg-muted text-muted-foreground"
                        >
                          Close
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Dialog */}
      {actionModal && selectedNcr && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold">
              NCR Action: {actionModal.toUpperCase()} ({selectedNcr.ncrNumber})
            </h3>

            {actionModal === "contain" && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Immediate Containment Action
                </label>
                <textarea
                  rows={3}
                  value={containmentText}
                  onChange={(e) => setContainmentText(e.target.value)}
                  placeholder="Quarantine isolated lots, halt production line..."
                  className="w-full border rounded-lg p-2.5 text-xs bg-background"
                />
              </div>
            )}

            {actionModal === "investigate" && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Root Cause Investigation Findings
                </label>
                <textarea
                  rows={3}
                  value={rootCauseText}
                  onChange={(e) => setRootCauseText(e.target.value)}
                  placeholder="5-Why / Ishikawa root cause identification..."
                  className="w-full border rounded-lg p-2.5 text-xs bg-background"
                />
              </div>
            )}

            {actionModal === "disposition" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Material Disposition
                  </label>
                  <select
                    value={dispositionText}
                    onChange={(e) => setDispositionText(e.target.value)}
                    className="w-full border rounded-lg p-2 text-xs bg-background"
                  >
                    <option value="">Select Disposition</option>
                    <option value="SCRAP">SCRAP / Destroy</option>
                    <option value="REWORK">Internal Rework</option>
                    <option value="RETURN_TO_SUPPLIER">Return to Supplier (RTV)</option>
                    <option value="ACCEPT_WITH_DEVIATION">Use As-Is (Deviation)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="capaReq"
                    checked={isCapaReq}
                    onChange={(e) => setIsCapaReq(e.target.checked)}
                  />
                  <label htmlFor="capaReq" className="text-xs font-medium cursor-pointer">
                    Escalate to CAPA (Formal Corrective Action)
                  </label>
                </div>
              </div>
            )}

            {actionModal === "close" && (
              <p className="text-xs text-muted-foreground">
                Confirm closing this Non-Conformance report. All required containment and
                dispositions will be marked complete.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActionModal(null)}
                className="px-3 py-1.5 text-xs border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAction()}
                className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90"
              >
                Submit Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
