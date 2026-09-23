"use client";

import React, { useState, useEffect } from "react";
import { warehouseApi } from "../api/warehouse-api";
import { ReplenishmentRule, ReplenishmentTask } from "../types/warehouse.types";

export function ReplenishmentPanel() {
  const [rules, setRules] = useState<ReplenishmentRule[]>([]);
  const [tasks, setTasks] = useState<ReplenishmentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showCreateRuleModal, setShowCreateRuleModal] = useState(false);

  // Create rule form
  const [warehouseId, setWarehouseId] = useState("");
  const [itemId, setItemId] = useState("");
  const [sourceLocationId, setSourceLocationId] = useState("");
  const [destinationLocationId, setDestinationLocationId] = useState("");
  const [minQuantity, setMinQuantity] = useState(10);
  const [maxQuantity, setMaxQuantity] = useState(50);
  const [replenishQuantity, setReplenishQuantity] = useState(40);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [r, t] = await Promise.all([
        warehouseApi.getReplenishmentRules(),
        warehouseApi.getReplenishmentTasks(),
      ]);
      setRules(r);
      setTasks(t);
    } catch (err) {
      console.error("Failed to load replenishment data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerate = async () => {
    if (rules.length === 0) {
      alert("Create at least one replenishment rule first");
      return;
    }
    try {
      setGenerating(true);
      await warehouseApi.generateReplenishmentTasks(rules[0].warehouseId);
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to trigger replenishment evaluation");
    } finally {
      setGenerating(false);
    }
  };

  const handleCompleteTask = async (id: string) => {
    try {
      await warehouseApi.completeReplenishmentTask(id);
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to complete replenishment");
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await warehouseApi.createReplenishmentRule({
        warehouseId,
        itemId,
        sourceLocationId,
        destinationLocationId,
        minQuantity,
        maxQuantity,
        replenishQuantity,
      });
      setShowCreateRuleModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to create replenishment rule");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <h3 className="font-semibold text-base">Forward Pick-Face Replenishment Engine</h3>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData()}
            className="px-3 py-2 border rounded-lg hover:bg-muted text-sm font-medium"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-purple-600 text-white font-medium text-sm rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
          >
            {generating ? "Evaluating..." : "⚡ Trigger Auto-Replenishment"}
          </button>
          <button
            onClick={() => setShowCreateRuleModal(true)}
            className="px-4 py-2 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:bg-primary/90 transition"
          >
            + New Rule
          </button>
        </div>
      </div>

      {/* Rules Section */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
          Active Replenishment Rules ({rules.length})
        </div>
        <div className="border rounded-xl bg-card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted/50 border-b text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Warehouse</th>
                <th className="px-4 py-3 font-semibold">SKU & Item</th>
                <th className="px-4 py-3 font-semibold">Bulk Storage Source</th>
                <th className="px-4 py-3 font-semibold">Pick Face Destination</th>
                <th className="px-4 py-3 font-semibold text-right">Min Qty</th>
                <th className="px-4 py-3 font-semibold text-right">Max Qty</th>
                <th className="px-4 py-3 font-semibold text-right">Replenish Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground text-xs">
                    No replenishment rules defined yet.
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3 font-medium">{r.warehouse.code}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{r.item.sku}</div>
                      <div className="text-xs text-muted-foreground">{r.item.name}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{r.sourceLocation.code}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-primary">
                      {r.destinationLocation.code}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-rose-600 dark:text-rose-400">
                      {r.minQuantity}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{r.maxQuantity}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {r.replenishQuantity}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generated Tasks Section */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
          Replenishment Tasks ({tasks.length})
        </div>
        <div className="border rounded-xl bg-card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted/50 border-b text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Task #</th>
                <th className="px-4 py-3 font-semibold">Item</th>
                <th className="px-4 py-3 font-semibold">Source & Destination</th>
                <th className="px-4 py-3 font-semibold text-right">Quantity</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground text-xs">
                    No active replenishment tasks. Pick faces are well-stocked.
                  </td>
                </tr>
              ) : (
                tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3 font-mono font-bold text-primary">{t.taskNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{t.item.sku}</div>
                      <div className="text-xs text-muted-foreground">{t.item.name}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {t.sourceLocation.code} &rarr;{" "}
                      <span className="font-bold text-primary">{t.destinationLocation.code}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{t.quantity}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          t.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.status === "PENDING" && (
                        <button
                          onClick={() => handleCompleteTask(t.id)}
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 rounded text-xs font-semibold ml-auto"
                        >
                          Execute
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

      {/* Create Rule Modal */}
      {showCreateRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">New Bin Replenishment Rule</h3>
            <form onSubmit={handleCreateRule} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Warehouse Location ID *</label>
                <input
                  type="text"
                  required
                  placeholder="UUID of Warehouse"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Item ID *</label>
                <input
                  type="text"
                  required
                  placeholder="UUID of Item"
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Source Bulk Location ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="UUID of Bulk Storage Location"
                  value={sourceLocationId}
                  onChange={(e) => setSourceLocationId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Destination Pick Face Location ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="UUID of Pick Face Location"
                  value={destinationLocationId}
                  onChange={(e) => setDestinationLocationId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">Min Qty</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Max Qty</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={maxQuantity}
                    onChange={(e) => setMaxQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Replenish Qty</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={replenishQuantity}
                    onChange={(e) => setReplenishQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateRuleModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
