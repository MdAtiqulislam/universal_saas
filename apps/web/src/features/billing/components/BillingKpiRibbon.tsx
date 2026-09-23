"use client";

import React from "react";
import { BillingSubscription, EntitlementsSummary } from "../types";

interface Props {
  subscription: BillingSubscription | null;
  entitlements: EntitlementsSummary;
  financials: {
    availableCredit: number;
    totalOutstandingAmount: number;
    currency: string;
  };
}

export const BillingKpiRibbon: React.FC<Props> = ({ subscription, entitlements, financials }) => {
  const formatMoney = (cents: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(cents / 100);
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "TRIALING":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "PAST_DUE":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "PAUSED":
        return "bg-gray-100 text-gray-800 border-gray-300";
      case "CANCELLED":
      case "EXPIRED":
        return "bg-rose-100 text-rose-800 border-rose-300";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  // Check overall quota status
  const maxQuotaPercent = entitlements.quotas.reduce((max, q) => Math.max(max, q.usagePercent), 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {/* Active Plan Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Current Plan
        </div>
        <div className="text-xl font-bold text-slate-900 truncate">
          {subscription ? subscription.planVersion.plan.name : "No Active Plan"}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusBadge(
              subscription?.status,
            )}`}
          >
            {subscription?.status || "INACTIVE"}
          </span>
          {subscription?.planVersion?.version && (
            <span className="text-xs text-slate-400">v{subscription.planVersion.version}</span>
          )}
        </div>
      </div>

      {/* Renewal / Expiry Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
          {subscription?.status === "TRIALING" ? "Trial Ends" : "Next Renewal"}
        </div>
        <div className="text-xl font-bold text-slate-900">
          {subscription?.currentPeriodEnd
            ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
            : "—"}
        </div>
        <div className="mt-2 text-xs text-slate-500">
          {subscription?.cancelAtPeriodEnd ? (
            <span className="text-amber-600 font-medium">Cancels at period end</span>
          ) : (
            <span>Auto-renews at interval</span>
          )}
        </div>
      </div>

      {/* Outstanding Balance Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Unpaid Balance
        </div>
        <div
          className={`text-xl font-bold ${
            financials.totalOutstandingAmount > 0 ? "text-amber-600" : "text-slate-900"
          }`}
        >
          {formatMoney(financials.totalOutstandingAmount, financials.currency)}
        </div>
        <div className="mt-2 text-xs text-slate-500">
          {financials.totalOutstandingAmount > 0
            ? "Action required on open invoices"
            : "All invoices settled"}
        </div>
      </div>

      {/* Available Credit Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Available Credit
        </div>
        <div className="text-xl font-bold text-emerald-600">
          {formatMoney(financials.availableCredit, financials.currency)}
        </div>
        <div className="mt-2 text-xs text-slate-500">Auto-applied to next invoice</div>
      </div>

      {/* Highest Quota Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Peak Quota Usage
        </div>
        <div
          className={`text-xl font-bold ${
            maxQuotaPercent >= 90
              ? "text-rose-600"
              : maxQuotaPercent >= 75
                ? "text-amber-600"
                : "text-slate-900"
          }`}
        >
          {maxQuotaPercent}%
        </div>
        <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full ${
              maxQuotaPercent >= 90
                ? "bg-rose-500"
                : maxQuotaPercent >= 75
                  ? "bg-amber-500"
                  : "bg-emerald-500"
            }`}
            style={{ width: `${Math.min(100, maxQuotaPercent)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
