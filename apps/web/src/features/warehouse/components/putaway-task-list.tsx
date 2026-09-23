"use client";

import React, { useState, useEffect } from "react";
import { warehouseApi } from "../api/warehouse-api";
import { PutawayTask } from "../types/warehouse.types";

export function PutawayTaskList() {
  const [tasks, setTasks] = useState<PutawayTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<PutawayTask | null>(null);
  const [targetLocationId, setTargetLocationId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await warehouseApi.getPutawayTasks({ search: search || undefined });
      setTasks(res.data);
    } catch (err) {
      console.error("Failed to load putaway tasks", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleStart = async (id: string) => {
    try {
      await warehouseApi.startPutawayTask(id);
      fetchTasks();
    } catch (err: any) {
      alert(err.message || "Failed to start putaway");
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    try {
      setSubmitting(true);
      await warehouseApi.completePutawayTask(selectedTask.id, {
        targetLocationId: targetLocationId || undefined,
      });
      setSelectedTask(null);
      setTargetLocationId("");
      fetchTasks();
    } catch (err: any) {
      alert(err.message || "Failed to complete putaway");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this putaway task?")) return;
    try {
      await warehouseApi.cancelPutawayTask(id);
      fetchTasks();
    } catch (err: any) {
      alert(err.message || "Failed to cancel putaway");
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search putaway tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <button
          onClick={() => fetchTasks()}
          className="px-3 py-2 border rounded-lg hover:bg-muted text-sm font-medium"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Task List */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-muted/50 border-b text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Task Number</th>
              <th className="px-4 py-3 font-semibold">Source Location</th>
              <th className="px-4 py-3 font-semibold">Destination Location</th>
              <th className="px-4 py-3 font-semibold">Lines</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading putaway tasks...
                </td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No putaway tasks found.
                </td>
              </tr>
            ) : (
              tasks.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 transition">
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-primary">{t.taskNumber}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.sourceDocumentType
                        ? `${t.sourceDocumentType} #${t.sourceDocumentId || ""}`
                        : "Manual"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{t.sourceLocation.code}</div>
                    <div className="text-xs text-muted-foreground">{t.sourceLocation.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">
                      {t.targetLocation?.code || "Assigned per line"}
                    </div>
                    <div className="text-xs text-muted-foreground">{t.targetLocation?.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold">{t.lines?.length || 0}</span> item line(s)
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        t.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : t.status === "IN_PROGRESS"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                            : t.status === "CANCELLED"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {(t.status === "PENDING" || t.status === "ASSIGNED") && (
                        <button
                          onClick={() => handleStart(t.id)}
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 rounded text-xs font-semibold"
                        >
                          Start
                        </button>
                      )}
                      {t.status === "IN_PROGRESS" && (
                        <button
                          onClick={() => setSelectedTask(t)}
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 rounded text-xs font-semibold"
                        >
                          Complete
                        </button>
                      )}
                      {t.status !== "COMPLETED" && t.status !== "CANCELLED" && (
                        <button
                          onClick={() => handleCancel(t.id)}
                          className="px-2 py-1 hover:bg-muted text-rose-600 rounded text-xs"
                          title="Cancel Task"
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

      {/* Complete Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">Complete Putaway Task {selectedTask.taskNumber}</h3>
            <p className="text-xs text-muted-foreground">
              Confirm target location bin to finalize inventory transfer from receiving area.
            </p>

            <form onSubmit={handleComplete} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Target Storage Location ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="UUID of destination location / bin"
                  value={targetLocationId}
                  onChange={(e) => setTargetLocationId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                />
              </div>

              <div className="border rounded-lg p-3 bg-muted/20 space-y-2">
                <div className="text-xs font-bold text-muted-foreground uppercase">
                  Items in Putaway
                </div>
                {selectedTask.lines.map((l) => (
                  <div
                    key={l.id}
                    className="flex justify-between text-xs py-1 border-b last:border-0"
                  >
                    <div>
                      <span className="font-semibold">{l.item.sku}</span> - {l.item.name}
                    </div>
                    <span className="font-mono font-bold text-primary">{l.quantity} units</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? "Transferring..." : "Execute Putaway"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
