/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { InspectionPlan } from "../types/quality.types";
import { qualityApi } from "../api/quality-api";

export function InspectionPlansPanel() {
  const [plans, setPlans] = useState<InspectionPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await qualityApi.getInspectionPlans({
        search: search || undefined,
      });
      setPlans(data);
    } catch (err) {
      console.error("Failed to load inspection plans", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const handleActivate = async (id: string) => {
    try {
      await qualityApi.activateInspectionPlan(id);
      void loadPlans();
    } catch (err) {
      console.error("Failed to activate plan", err);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await qualityApi.deactivateInspectionPlan(id);
      void loadPlans();
    } catch (err) {
      console.error("Failed to deactivate plan", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Actions */}
      <div className="flex justify-between items-center gap-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search plan number, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void loadPlans()}
            className="w-72 px-3 py-1.5 text-xs border rounded-lg bg-background"
          />
          <button
            onClick={() => void loadPlans()}
            className="px-3 py-1.5 text-xs font-medium border rounded-lg hover:bg-muted"
          >
            Search
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 border-b text-muted-foreground">
              <tr>
                <th className="p-3">Plan #</th>
                <th className="p-3">Version</th>
                <th className="p-3">Plan Name</th>
                <th className="p-3">Inspection Type</th>
                <th className="p-3">Item / SKU</th>
                <th className="p-3">Characteristics</th>
                <th className="p-3">Sampling Policy</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    Loading inspection plans...
                  </td>
                </tr>
              ) : plans.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    No inspection plans found.
                  </td>
                </tr>
              ) : (
                plans.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition">
                    <td className="p-3 font-mono font-medium">{p.planNumber}</td>
                    <td className="p-3 font-mono">v{p.version}</td>
                    <td className="p-3 font-medium text-foreground">{p.name}</td>
                    <td className="p-3">
                      <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded">
                        {p.inspectionType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {p.item?.name} ({p.item?.sku})
                    </td>
                    <td className="p-3 font-mono font-medium">
                      {p.characteristics?.length || 0} specs
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {p.samplingPlan ? p.samplingPlan.name : "100% Inspection (Default)"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.isActive
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {p.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {p.isActive ? (
                        <button
                          onClick={() => void handleDeactivate(p.id)}
                          className="px-2.5 py-1 text-xs border rounded hover:bg-muted text-muted-foreground"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => void handleActivate(p.id)}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700"
                        >
                          Activate
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
    </div>
  );
}
