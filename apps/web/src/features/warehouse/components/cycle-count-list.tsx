"use client";

import React, { useState, useEffect } from "react";
import { warehouseApi } from "../api/warehouse-api";
import { CycleCount } from "../types/warehouse.types";

export function CycleCountList() {
  const [counts, setCounts] = useState<CycleCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCount, setSelectedCount] = useState<CycleCount | null>(null);
  const [recordedValues, setRecordedValues] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const fetchCounts = async () => {
    try {
      setLoading(true);
      const res = await warehouseApi.getCounts({ search: search || undefined });
      setCounts(res.data);
    } catch (err) {
      console.error("Failed to load cycle counts", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  const handleStart = async (id: string) => {
    try {
      await warehouseApi.startCount(id);
      fetchCounts();
    } catch (err: any) {
      alert(err.message || "Failed to start count");
    }
  };

  const openRecordModal = (cc: CycleCount) => {
    setSelectedCount(cc);
    const initialValues: Record<string, number> = {};
    for (const l of cc.lines) {
      initialValues[l.id] = l.countedQuantity ? Number(l.countedQuantity) : 0;
    }
    setRecordedValues(initialValues);
  };

  const handleRecordCounts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCount) return;

    try {
      setSubmitting(true);
      const lines = Object.entries(recordedValues).map(([lineId, countedQuantity]) => ({
        lineId,
        countedQuantity,
      }));

      await warehouseApi.recordCount(selectedCount.id, lines);
      setSelectedCount(null);
      fetchCounts();
    } catch (err: any) {
      alert(err.message || "Failed to record counts");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (id: string) => {
    try {
      await warehouseApi.reviewCount(id);
      fetchCounts();
    } catch (err: any) {
      alert(err.message || "Failed to review count");
    }
  };

  const handlePost = async (id: string) => {
    if (
      !confirm("Post approved cycle count variances to authoritative general inventory balances?")
    )
      return;
    try {
      await warehouseApi.postCount(id);
      fetchCounts();
    } catch (err: any) {
      alert(err.message || "Failed to post inventory adjustments");
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search cycle counts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <button
          onClick={() => fetchCounts()}
          className="px-3 py-2 border rounded-lg hover:bg-muted text-sm font-medium"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Counts Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-muted/50 border-b text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Count Plan #</th>
              <th className="px-4 py-3 font-semibold">Warehouse / Zone</th>
              <th className="px-4 py-3 font-semibold">Blind Count</th>
              <th className="px-4 py-3 font-semibold">Lines Checked</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading cycle counts...
                </td>
              </tr>
            ) : counts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No cycle counts created.
                </td>
              </tr>
            ) : (
              counts.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition">
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-primary">{c.countNumber}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.description || "Routine count"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{c.warehouse.code}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.zone?.name || "All Warehouse Bins"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c.isBlind ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 font-semibold">
                        Blind Count
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Standard</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold">{c.lines?.length || 0} line(s)</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        c.status === "POSTED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : c.status === "REVIEWED"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                            : c.status === "COUNTED"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                              : c.status === "IN_PROGRESS"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {(c.status === "DRAFT" || c.status === "SCHEDULED") && (
                        <button
                          onClick={() => handleStart(c.id)}
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 rounded text-xs font-semibold"
                        >
                          Start
                        </button>
                      )}
                      {(c.status === "IN_PROGRESS" || c.status === "COUNTED") && (
                        <button
                          onClick={() => openRecordModal(c)}
                          className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 rounded text-xs font-semibold"
                        >
                          Record
                        </button>
                      )}
                      {c.status === "COUNTED" && (
                        <button
                          onClick={() => handleReview(c.id)}
                          className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 rounded text-xs font-semibold"
                        >
                          Review
                        </button>
                      )}
                      {c.status === "REVIEWED" && (
                        <button
                          onClick={() => handlePost(c.id)}
                          className="px-2.5 py-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded text-xs font-semibold"
                        >
                          Post Adjustments
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Record Counts Modal */}
      {selectedCount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-xl w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">
              Record Physical Counts - {selectedCount.countNumber}
            </h3>
            <p className="text-xs text-muted-foreground">
              {selectedCount.isBlind
                ? "Blind count enabled: System on-hand quantities are masked to ensure auditing fidelity."
                : "Enter physical count results for each line."}
            </p>

            <form onSubmit={handleRecordCounts} className="space-y-3">
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {selectedCount.lines.map((l) => (
                  <div key={l.id} className="p-3 border rounded-lg bg-muted/20 space-y-2">
                    <div className="flex justify-between text-xs">
                      <div>
                        <span className="font-bold">{l.item.sku}</span> - {l.item.name}
                        <div className="text-muted-foreground">Location: {l.location.code}</div>
                      </div>
                      {!selectedCount.isBlind && (
                        <div className="text-right font-mono text-muted-foreground">
                          System: {l.systemQuantity}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Physical Count Result
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        required
                        value={recordedValues[l.id] ?? ""}
                        onChange={(e) =>
                          setRecordedValues({
                            ...recordedValues,
                            [l.id]: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background font-mono font-bold"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedCount(null)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Count Results"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
