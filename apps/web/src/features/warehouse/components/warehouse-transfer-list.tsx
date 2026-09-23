"use client";

import React, { useState, useEffect } from "react";
import { warehouseApi } from "../api/warehouse-api";
import { WarehouseTransfer } from "../types/warehouse.types";

export function WarehouseTransferList() {
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const res = await warehouseApi.getTransfers({ search: search || undefined });
      setTransfers(res.data);
    } catch (err) {
      console.error("Failed to load transfers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const handleSubmit = async (id: string) => {
    try {
      await warehouseApi.submitTransfer(id);
      fetchTransfers();
    } catch (err: any) {
      alert(err.message || "Failed to submit transfer");
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await warehouseApi.approveTransfer(id);
      fetchTransfers();
    } catch (err: any) {
      alert(err.message || "Failed to approve transfer");
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingId) return;
    try {
      setSubmitting(true);
      await warehouseApi.rejectTransfer(rejectingId, rejectionReason);
      setRejectingId(null);
      setRejectionReason("");
      fetchTransfers();
    } catch (err: any) {
      alert(err.message || "Failed to reject transfer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStart = async (id: string) => {
    try {
      await warehouseApi.startTransfer(id);
      fetchTransfers();
    } catch (err: any) {
      alert(err.message || "Failed to start transfer");
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await warehouseApi.completeTransfer(id);
      fetchTransfers();
    } catch (err: any) {
      alert(err.message || "Failed to complete transfer");
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this transfer request?")) return;
    try {
      await warehouseApi.cancelTransfer(id);
      fetchTransfers();
    } catch (err: any) {
      alert(err.message || "Failed to cancel transfer");
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search transfer requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <button
          onClick={() => fetchTransfers()}
          className="px-3 py-2 border rounded-lg hover:bg-muted text-sm font-medium"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Transfers Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-muted/50 border-b text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Transfer #</th>
              <th className="px-4 py-3 font-semibold">Source Warehouse</th>
              <th className="px-4 py-3 font-semibold">Destination Warehouse</th>
              <th className="px-4 py-3 font-semibold">Lines</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading warehouse transfers...
                </td>
              </tr>
            ) : transfers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No internal transfer requests found.
                </td>
              </tr>
            ) : (
              transfers.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 transition">
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-primary">{t.transferNumber}</div>
                    <div className="text-xs text-muted-foreground">{t.reason || "Relocation"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{t.sourceWarehouse.code}</div>
                    <div className="text-xs text-muted-foreground">{t.sourceWarehouse.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{t.destinationWarehouse.code}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.destinationWarehouse.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold">{t.lines?.length || 0}</span> item(s)
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        t.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : t.status === "APPROVED"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                            : t.status === "IN_PROGRESS"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                              : t.status === "REJECTED" || t.status === "CANCELLED"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {t.status === "DRAFT" && (
                        <button
                          onClick={() => handleSubmit(t.id)}
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 rounded text-xs font-semibold"
                        >
                          Submit
                        </button>
                      )}
                      {t.status === "SUBMITTED" && (
                        <>
                          <button
                            onClick={() => handleApprove(t.id)}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 rounded text-xs font-semibold"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectingId(t.id)}
                            className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 rounded text-xs font-semibold"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {t.status === "APPROVED" && (
                        <button
                          onClick={() => handleStart(t.id)}
                          className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 rounded text-xs font-semibold"
                        >
                          Start
                        </button>
                      )}
                      {t.status === "IN_PROGRESS" && (
                        <button
                          onClick={() => handleComplete(t.id)}
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 rounded text-xs font-semibold"
                        >
                          Complete
                        </button>
                      )}
                      {t.status !== "COMPLETED" &&
                        t.status !== "CANCELLED" &&
                        t.status !== "REJECTED" && (
                          <button
                            onClick={() => handleCancel(t.id)}
                            className="px-2 py-1 hover:bg-muted text-rose-600 rounded text-xs"
                            title="Cancel Transfer"
                          >
                            Cancel
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

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">Reject Warehouse Transfer</h3>
            <form onSubmit={handleReject} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Rejection Reason *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Specify why this transfer is rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingId(null);
                    setRejectionReason("");
                  }}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
                >
                  {submitting ? "Rejecting..." : "Reject Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
