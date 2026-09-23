/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { SamplingPlan } from "../types/quality.types";
import { qualityApi } from "../api/quality-api";

export function SamplingPlansPanel() {
  const [plans, setPlans] = useState<SamplingPlan[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await qualityApi.getSamplingPlans();
      setPlans(data);
    } catch (err) {
      console.error("Failed to load sampling plans", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const getSamplingFormulaDescription = (p: SamplingPlan) => {
    switch (p.samplingType) {
      case "FULL_100_PERCENT":
        return "100% Inspection (Every unit in lot is sampled)";
      case "FIXED_QUANTITY":
        return `Fixed quantity: ${p.fixedSampleQuantity} units per lot`;
      case "PERCENTAGE_BASED":
        return `Percentage rate: ${p.percentageRate}% of lot quantity`;
      case "LOT_SIZE_BASED":
        return "Lot Size Range Lookup table (ISO 2859 / ANSI)";
      default:
        return p.samplingType;
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
                <th className="p-3">Code</th>
                <th className="p-3">Plan Name</th>
                <th className="p-3">Sampling Type</th>
                <th className="p-3">Formula / Sample Size</th>
                <th className="p-3">Associated Plans</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Loading sampling plans...
                  </td>
                </tr>
              ) : plans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No sampling plans found.
                  </td>
                </tr>
              ) : (
                plans.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition">
                    <td className="p-3 font-mono font-medium">{p.code}</td>
                    <td className="p-3 font-medium text-foreground">{p.name}</td>
                    <td className="p-3">
                      <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded">
                        {p.samplingType}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {getSamplingFormulaDescription(p)}
                    </td>
                    <td className="p-3 font-mono">{p._count?.inspectionPlans || 0} plans</td>
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
