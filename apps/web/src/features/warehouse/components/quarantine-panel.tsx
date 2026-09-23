"use client";

import React, { useState, useEffect } from "react";
import { warehouseApi } from "../api/warehouse-api";
import { QuarantineRecord } from "../types/warehouse.types";

export function QuarantinePanel() {
  const [records, setRecords] = useState<QuarantineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<QuarantineRecord | null>(null);
  const [inspectModal, setInspectModal] = useState(false);
  const [releaseModal, setReleaseModal] = useState(false);

  // Inspection state
  const [status, setStatus] = useState<"RELEASED" | "HELD" | "SCRAPPED" | "RETURNED">("RELEASED");
  const [disposition, setDisposition] = useState("RELEASE");
  const [dispositionNotes, setDispositionNotes] = useState("");

  // Release state
  const [targetLocationId, setTargetLocationId] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const fetchQuarantines = async () => {
    try {
      setLoading(true);
      const res = await warehouseApi.getQuarantines({ search: search || undefined });
      setRecords(res);
    } catch (err) {
      console.error("Failed to load quarantines", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuarantines();
  }, []);

  const handleInspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    try {
      setSubmitting(true);
      await warehouseApi.inspectQuarantine(selectedRecord.id, {
        status,
        disposition,
        dispositionNotes,
      });
      setInspectModal(false);
      setSelectedRecord(null);
      fetchQuarantines();
    } catch (err: any) {
      alert(err.message || "Failed to inspect quarantine");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    try {
      setSubmitting(true);
      await warehouseApi.releaseQuarantine(selectedRecord.id, {
        targetLocationId: targetLocationId || undefined,
        notes: releaseNotes || undefined,
      });
      setReleaseModal(false);
      setSelectedRecord(null);
      fetchQuarantines();
    } catch (err: any) {
      alert(err.message || "Failed to release quarantine");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search quarantine lots..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <button
          onClick={() => fetchQuarantines()}
          className="px-3 py-2 border rounded-lg hover:bg-muted text-sm font-medium"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Quarantines Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-muted/50 border-b text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Quarantine #</th>
              <th className="px-4 py-3 font-semibold">Item SKU & Name</th>
              <th className="px-4 py-3 font-semibold">Location</th>
              <th className="px-4 py-3 font-semibold text-right">Quarantined Qty</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Loading quarantine records...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No quarantined lots found. All items in storage are verified.
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition">
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      {r.quarantineNumber}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{r.item.sku}</div>
                    <div className="text-xs text-muted-foreground">{r.item.name}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">{r.location.code}</td>
                  <td className="px-4 py-3 text-right font-bold text-rose-600 dark:text-rose-400">
                    {r.quantity}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                    {r.reason}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        r.status === "RELEASED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : r.status === "UNDER_INSPECTION"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                            : r.status === "HELD"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                              : r.status === "SCRAPPED" || r.status === "RETURNED"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {(r.status === "QUARANTINED" || r.status === "UNDER_INSPECTION") && (
                        <button
                          onClick={() => {
                            setSelectedRecord(r);
                            setInspectModal(true);
                          }}
                          className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 rounded text-xs font-semibold"
                        >
                          Inspect
                        </button>
                      )}
                      {r.status !== "RELEASED" &&
                        r.status !== "SCRAPPED" &&
                        r.status !== "RETURNED" && (
                          <button
                            onClick={() => {
                              setSelectedRecord(r);
                              setReleaseModal(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 rounded text-xs font-semibold"
                          >
                            Release
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

      {/* Inspect Modal */}
      {inspectModal && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">
              Inspect Quarantine Lot {selectedRecord.quarantineNumber}
            </h3>
            <form onSubmit={handleInspect} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Status Transition *</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                >
                  <option value="UNDER_INSPECTION">UNDER_INSPECTION</option>
                  <option value="RELEASED">RELEASED</option>
                  <option value="HELD">HELD</option>
                  <option value="SCRAPPED">SCRAPPED</option>
                  <option value="RETURNED">RETURNED</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Disposition Decision *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RELEASE_TO_STORAGE, CONDITIONAL_PASS, SCRAP_LOT"
                  value={disposition}
                  onChange={(e) => setDisposition(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Inspection Notes</label>
                <textarea
                  rows={3}
                  placeholder="Lab test results, QA comments..."
                  value={dispositionNotes}
                  onChange={(e) => setDispositionNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setInspectModal(false);
                    setSelectedRecord(null);
                  }}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
                >
                  {submitting ? "Recording..." : "Record Inspection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Release Modal */}
      {releaseModal && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">Release Lot {selectedRecord.quarantineNumber}</h3>
            <p className="text-xs text-muted-foreground">
              Releasing this lot restores {selectedRecord.quantity} units of{" "}
              {selectedRecord.item.sku} to active available inventory.
            </p>

            <form onSubmit={handleRelease} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Release Notes</label>
                <textarea
                  rows={2}
                  placeholder="Release approval reference..."
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setReleaseModal(false);
                    setSelectedRecord(null);
                  }}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? "Releasing..." : "Confirm Release"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
