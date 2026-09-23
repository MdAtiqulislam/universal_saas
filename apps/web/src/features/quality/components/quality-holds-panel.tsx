/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { QualityHold } from "../types/quality.types";
import { qualityApi } from "../api/quality-api";

export function QualityHoldsPanel() {
  const [holds, setHolds] = useState<QualityHold[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedHoldId, setSelectedHoldId] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadHolds = useCallback(async () => {
    setLoading(true);
    try {
      const data = await qualityApi.getHolds();
      setHolds(data);
    } catch (err) {
      console.error("Failed to load quality holds", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHolds();
  }, [loadHolds]);

  const handleRelease = async () => {
    if (!selectedHoldId) return;
    try {
      await qualityApi.releaseHold(selectedHoldId, {
        releaseNotes,
        dispositionStatus: "RELEASED",
      });
      setIsModalOpen(false);
      setSelectedHoldId(null);
      setReleaseNotes("");
      void loadHolds();
    } catch (err) {
      console.error("Failed to release hold", err);
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
                <th className="p-3">Hold #</th>
                <th className="p-3">Item / SKU</th>
                <th className="p-3">Warehouse / Location</th>
                <th className="p-3 text-right">Hold Qty</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Inspection Lot</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Loading quality holds...
                  </td>
                </tr>
              ) : holds.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No active quality holds found.
                  </td>
                </tr>
              ) : (
                holds.map((h) => (
                  <tr key={h.id} className="hover:bg-muted/20 transition">
                    <td className="p-3 font-mono font-medium">{h.holdNumber}</td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">{h.item?.name}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {h.item?.sku}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {h.warehouse?.code} / {h.location?.code}
                    </td>
                    <td className="p-3 text-right font-medium">{h.holdQuantity}</td>
                    <td className="p-3 text-muted-foreground">{h.reason}</td>
                    <td className="p-3 font-mono">{h.inspectionLot?.lotNumber || "—"}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          h.status === "ACTIVE"
                            ? "bg-red-500/10 text-red-600"
                            : "bg-emerald-500/10 text-emerald-600"
                        }`}
                      >
                        {h.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {h.status === "ACTIVE" && (
                        <button
                          onClick={() => {
                            setSelectedHoldId(h.id);
                            setIsModalOpen(true);
                          }}
                          className="px-3 py-1 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 transition"
                        >
                          Release Hold
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

      {/* Release Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold">Release Inventory Quality Hold</h3>
            <p className="text-xs text-muted-foreground">
              Confirm that stock inspection and non-conformance containment requirements are
              fulfilled before releasing stock to available warehouse bins.
            </p>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Release Authorization Notes
              </label>
              <textarea
                rows={3}
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                placeholder="Reason for release..."
                className="w-full border rounded-lg p-2.5 text-xs bg-background"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 text-xs border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleRelease()}
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Confirm Release
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
