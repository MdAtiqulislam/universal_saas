"use client";

import React, { useState, useEffect } from "react";
import { warehouseApi } from "../api/warehouse-api";
import { PickTask } from "../types/warehouse.types";

export function PickTaskList() {
  const [picks, setPicks] = useState<PickTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPick, setSelectedPick] = useState<PickTask | null>(null);
  const [pickQuantities, setPickQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const fetchPicks = async () => {
    try {
      setLoading(true);
      const res = await warehouseApi.getPicks({ search: search || undefined });
      setPicks(res.data);
    } catch (err) {
      console.error("Failed to load picks", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPicks();
  }, []);

  const handleStart = async (id: string) => {
    try {
      await warehouseApi.startPick(id);
      fetchPicks();
    } catch (err: any) {
      alert(err.message || "Failed to start pick");
    }
  };

  const openExecuteModal = (pick: PickTask) => {
    setSelectedPick(pick);
    const initialQty: Record<string, number> = {};
    for (const line of pick.lines) {
      const remaining = Number(line.requestedQuantity) - Number(line.pickedQuantity);
      initialQty[line.id] = remaining > 0 ? remaining : 0;
    }
    setPickQuantities(initialQty);
  };

  const handleExecutePick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPick) return;

    try {
      setSubmitting(true);
      const lines = Object.entries(pickQuantities).map(([lineId, pickedQuantity]) => ({
        lineId,
        pickedQuantity,
      }));

      await warehouseApi.executePick(selectedPick.id, { lines });
      setSelectedPick(null);
      fetchPicks();
    } catch (err: any) {
      alert(err.message || "Failed to execute pick");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this pick task?")) return;
    try {
      await warehouseApi.cancelPick(id);
      fetchPicks();
    } catch (err: any) {
      alert(err.message || "Failed to cancel pick");
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search pick tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <button
          onClick={() => fetchPicks()}
          className="px-3 py-2 border rounded-lg hover:bg-muted text-sm font-medium"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Picks Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-muted/50 border-b text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Pick Task #</th>
              <th className="px-4 py-3 font-semibold">Order Reference</th>
              <th className="px-4 py-3 font-semibold">Warehouse</th>
              <th className="px-4 py-3 font-semibold">Pick Lines Progress</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading pick tasks...
                </td>
              </tr>
            ) : picks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No outbound pick tasks found.
                </td>
              </tr>
            ) : (
              picks.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition">
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-primary">{p.taskNumber}</div>
                    <div className="text-xs text-muted-foreground">Priority: {p.priority}</div>
                  </td>
                  <td className="px-4 py-3">
                    {p.salesOrder ? (
                      <div className="font-semibold text-foreground">
                        SO: {p.salesOrder.orderNumber}
                      </div>
                    ) : p.deliveryOrder ? (
                      <div className="font-semibold text-foreground">
                        DO: {p.deliveryOrder.deliveryNumber}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Manual Pick</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{p.warehouse.code}</div>
                    <div className="text-xs text-muted-foreground">{p.warehouse.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {p.lines.map((l) => (
                        <div key={l.id} className="text-xs flex items-center justify-between gap-2">
                          <span className="font-semibold">{l.item.sku}</span>
                          <span className="font-mono">
                            {l.pickedQuantity} / {l.requestedQuantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        p.status === "PICKED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : p.status === "PARTIALLY_PICKED"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                            : p.status === "IN_PROGRESS"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                              : p.status === "CANCELLED"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {(p.status === "PENDING" || p.status === "ASSIGNED") && (
                        <button
                          onClick={() => handleStart(p.id)}
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 rounded text-xs font-semibold"
                        >
                          Start
                        </button>
                      )}
                      {(p.status === "IN_PROGRESS" || p.status === "PARTIALLY_PICKED") && (
                        <button
                          onClick={() => openExecuteModal(p)}
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 rounded text-xs font-semibold"
                        >
                          Pick
                        </button>
                      )}
                      {p.status !== "PICKED" && p.status !== "CANCELLED" && (
                        <button
                          onClick={() => handleCancel(p.id)}
                          className="px-2 py-1 hover:bg-muted text-rose-600 rounded text-xs"
                          title="Cancel Pick"
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

      {/* Execute Pick Modal */}
      {selectedPick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">Execute Pick Task {selectedPick.taskNumber}</h3>
            <p className="text-xs text-muted-foreground">
              Confirm picked quantities from designated warehouse bins to move into staging area.
            </p>

            <form onSubmit={handleExecutePick} className="space-y-3">
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {selectedPick.lines.map((l) => (
                  <div key={l.id} className="p-3 border rounded-lg bg-muted/20 space-y-2">
                    <div className="flex justify-between text-xs">
                      <div>
                        <span className="font-bold">{l.item.sku}</span> - {l.item.name}
                        <div className="text-muted-foreground">Bin: {l.sourceLocation.code}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground">Req: {l.requestedQuantity}</span>
                        <div className="text-primary font-bold">Picked: {l.pickedQuantity}</div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Pick Quantity This Session
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={Number(l.requestedQuantity) - Number(l.pickedQuantity)}
                        step="0.0001"
                        value={pickQuantities[l.id] || 0}
                        onChange={(e) =>
                          setPickQuantities({
                            ...pickQuantities,
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
                  onClick={() => setSelectedPick(null)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? "Staging Pick..." : "Confirm Pick & Stage"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
