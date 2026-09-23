"use client";

import React from "react";
import { BillingQuota, UsageSummaryItem } from "../types";

interface Props {
  quotas: BillingQuota[];
  usageSummary: UsageSummaryItem[];
}

export const UsageQuotasPanel: React.FC<Props> = ({ quotas, usageSummary }) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Usage Metering & Quotas</h2>
        <p className="text-xs text-slate-500">
          Real-time consumption tracking against allocated subscription quotas.
        </p>
      </div>

      {/* Quota Gauges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {quotas.length === 0 ? (
          <div className="col-span-2 text-center py-6 text-xs text-slate-400 border border-dashed rounded-lg">
            No quota limits configured for this tenant. Unlimited usage allowed.
          </div>
        ) : (
          quotas.map((quota) => {
            const isHard = quota.quotaType === "HARD_LIMIT";
            const isWarning = quota.usagePercent >= 75 && quota.usagePercent < 90;
            const isDanger = quota.usagePercent >= 90;

            return (
              <div
                key={quota.metricKey}
                className="border border-slate-200 rounded-xl p-4 bg-slate-50/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-semibold text-xs text-slate-800">{quota.metricKey}</span>
                    <span
                      className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                        isHard
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      {quota.quotaType}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-900">{quota.usagePercent}%</span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 rounded-full h-2 mb-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isDanger ? "bg-rose-600" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, quota.usagePercent)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Used: {quota.currentUsage.toLocaleString()}</span>
                  <span>
                    Limit: {quota.effectiveLimit.toLocaleString()}{" "}
                    {quota.authorizedOverride ? "(Override applied)" : ""}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Historical Consumption Table */}
      <div>
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
          30-Day Aggregated Consumption
        </h3>
        {usageSummary.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400 border border-dashed rounded-lg">
            No consumption recorded in the last 30 days.
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-4 text-left">Metric Identifier</th>
                  <th className="py-2.5 px-4 text-right">Recorded Events</th>
                  <th className="py-2.5 px-4 text-right">Total Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {usageSummary.map((item) => (
                  <tr key={item.metricKey} className="hover:bg-slate-50/60">
                    <td className="py-2 px-4 font-medium text-slate-800">{item.metricKey}</td>
                    <td className="py-2 px-4 text-right text-slate-500">
                      {item._count.id.toLocaleString()}
                    </td>
                    <td className="py-2 px-4 text-right font-bold text-slate-900">
                      {(item._sum.quantity || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
