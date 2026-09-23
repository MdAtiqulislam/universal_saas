/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CAPA } from "../types/quality.types";
import { qualityApi } from "../api/quality-api";

export function CapaPanel() {
  const [capas, setCapas] = useState<CAPA[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCapa, setSelectedCapa] = useState<CAPA | null>(null);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [effectivenessReview, setEffectivenessReview] = useState("");
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);

  const loadCapas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await qualityApi.getCapas();
      setCapas(data);
    } catch (err) {
      console.error("Failed to load CAPAs", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCapas();
  }, [loadCapas]);

  const handleStart = async (id: string) => {
    try {
      await qualityApi.startCapa(id);
      void loadCapas();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to start CAPA");
    }
  };

  const handleVerify = async () => {
    if (!selectedCapa) return;
    try {
      await qualityApi.verifyCapa(selectedCapa.id, {
        verificationNotes,
        effectivenessReview,
      });
      setIsVerifyModalOpen(false);
      setSelectedCapa(null);
      setVerificationNotes("");
      setEffectivenessReview("");
      void loadCapas();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to verify CAPA");
    }
  };

  const handleClose = async (id: string) => {
    try {
      await qualityApi.closeCapa(id);
      void loadCapas();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to close CAPA");
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
                <th className="p-3">CAPA #</th>
                <th className="p-3">Title</th>
                <th className="p-3">Source NCR</th>
                <th className="p-3">Root Cause</th>
                <th className="p-3">Corrective & Preventive Action</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Loading CAPA records...
                  </td>
                </tr>
              ) : capas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No CAPA records found.
                  </td>
                </tr>
              ) : (
                capas.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition">
                    <td className="p-3 font-mono font-medium">{c.capaNumber}</td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">{c.title}</div>
                      <div className="text-[11px] text-muted-foreground line-clamp-1">
                        {c.description}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">
                      {c.nonConformance?.ncrNumber || "—"}
                    </td>
                    <td className="p-3 text-muted-foreground line-clamp-2">
                      {c.rootCauseAnalysis || "Under analysis"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      <div className="line-clamp-1 font-medium">{c.correctiveAction || "—"}</div>
                      <div className="line-clamp-1 text-[11px]">{c.preventiveAction || "—"}</div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.status === "VERIFIED"
                            ? "bg-blue-500/10 text-blue-600"
                            : c.status === "CLOSED"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      {c.status === "OPEN" && (
                        <button
                          onClick={() => void handleStart(c.id)}
                          className="px-2.5 py-1 text-xs font-semibold bg-primary text-primary-foreground rounded hover:opacity-90"
                        >
                          Start Execution
                        </button>
                      )}
                      {(c.status === "IN_PROGRESS" || c.status === "PENDING_VERIFICATION") && (
                        <button
                          onClick={() => {
                            setSelectedCapa(c);
                            setIsVerifyModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Verify & Audit
                        </button>
                      )}
                      {c.status === "VERIFIED" && (
                        <button
                          onClick={() => void handleClose(c.id)}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700"
                        >
                          Close CAPA
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

      {/* Verify Modal */}
      {isVerifyModalOpen && selectedCapa && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold">
              Verify CAPA Effectiveness ({selectedCapa.capaNumber})
            </h3>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Verification Audit Notes
              </label>
              <textarea
                rows={3}
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="Details of audit check, re-inspection, or process confirmation..."
                className="w-full border rounded-lg p-2.5 text-xs bg-background"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Effectiveness Review
              </label>
              <textarea
                rows={2}
                value={effectivenessReview}
                onChange={(e) => setEffectivenessReview(e.target.value)}
                placeholder="Confirmed zero recurrence in subsequent 30 days..."
                className="w-full border rounded-lg p-2.5 text-xs bg-background"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsVerifyModalOpen(false)}
                className="px-3 py-1.5 text-xs border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleVerify()}
                className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90"
              >
                Record Verification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
