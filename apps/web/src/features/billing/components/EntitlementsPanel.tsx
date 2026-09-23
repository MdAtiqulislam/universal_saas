"use client";

import React from "react";
import { EntitlementsSummary } from "../types";

interface Props {
  entitlements: EntitlementsSummary;
}

export const EntitlementsPanel: React.FC<Props> = ({ entitlements }) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Feature Entitlements</h2>
        <p className="text-xs text-slate-500">
          Decoupled permissions and operational capabilities active under the current plan.
        </p>
      </div>

      <div className="mb-4 bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex items-center justify-between">
        <div className="text-xs text-blue-900">
          Active Plan:{" "}
          <strong className="font-semibold">{entitlements.planName || "No Plan"}</strong> (v
          {entitlements.planVersion || 1})
        </div>
        <div className="text-xs text-blue-700 font-medium">
          Total Features Entitled: {entitlements.features.filter((f) => f.enabled).length} /{" "}
          {entitlements.features.length}
        </div>
      </div>

      {entitlements.features.length === 0 ? (
        <div className="text-center py-8 text-xs text-slate-400 border border-dashed rounded-lg">
          No feature entitlements defined for this subscription plan.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-4 text-left">Feature Key</th>
                <th className="py-2.5 px-4 text-left">Capability Name</th>
                <th className="py-2.5 px-4 text-center">Entitlement Status</th>
                <th className="py-2.5 px-4 text-right">Quota / Allocation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {entitlements.features.map((feat) => (
                <tr key={feat.key} className="hover:bg-slate-50/60">
                  <td className="py-3 px-4 font-mono font-medium text-slate-700">{feat.key}</td>
                  <td className="py-3 px-4 text-slate-900 font-medium">{feat.name}</td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        feat.enabled
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "bg-slate-100 text-slate-400 border-slate-200"
                      }`}
                    >
                      {feat.enabled ? "Active" : "Locked"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-slate-600 font-medium">
                    {feat.isUnlimited ? (
                      <span className="text-emerald-600 font-semibold">Unlimited</span>
                    ) : feat.limit !== null && feat.limit !== undefined ? (
                      `${feat.limit.toLocaleString()} units`
                    ) : (
                      "Standard"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
