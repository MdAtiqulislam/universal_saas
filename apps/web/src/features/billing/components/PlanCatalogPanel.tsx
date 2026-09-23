"use client";

import React, { useState } from "react";
import { BillingPlan, BillingSubscription } from "../types";

interface Props {
  plans: BillingPlan[];
  subscription: BillingSubscription | null;
  onSelectPlan: (planVersionId: string, priceId?: string) => Promise<void>;
  isLoading?: boolean;
}

export const PlanCatalogPanel: React.FC<Props> = ({
  plans,
  subscription,
  onSelectPlan,
  isLoading = false,
}) => {
  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [selectedPlanVersionId, setSelectedPlanVersionId] = useState<string | null>(null);

  const formatMoney = (cents: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const handleAction = async (versionId: string, priceId?: string) => {
    setSelectedPlanVersionId(versionId);
    try {
      await onSelectPlan(versionId, priceId);
    } finally {
      setSelectedPlanVersionId(null);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Subscription Plans</h2>
          <p className="text-sm text-slate-500">
            Select the tier that aligns with your organization&apos;s operational scale.
          </p>
        </div>

        {/* Monthly / Yearly Toggle */}
        <div className="inline-flex bg-slate-100 p-1 rounded-lg border border-slate-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setBillingInterval("MONTHLY")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              billingInterval === "MONTHLY"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval("YEARLY")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              billingInterval === "YEARLY"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Annual (Save 15%)
          </button>
        </div>
      </div>

      {/* Plan Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const publishedVersion = plan.versions?.find((v) => v.isPublished) || plan.versions?.[0];
          const price = publishedVersion?.prices?.find((p) => p.interval === billingInterval);
          const isCurrent =
            subscription?.planVersion?.plan?.id === plan.id ||
            subscription?.planVersionId === publishedVersion?.id;

          return (
            <div
              key={plan.id}
              className={`rounded-xl border p-6 flex flex-col justify-between transition-all ${
                isCurrent
                  ? "border-blue-600 bg-blue-50/20 shadow-md ring-1 ring-blue-600"
                  : "border-slate-200 bg-white hover:border-slate-300 shadow-sm"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                  {isCurrent && (
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Current
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 mb-4 min-h-[32px]">
                  {plan.description || "Comprehensive operational modules for teams."}
                </p>

                <div className="mb-6">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {price ? formatMoney(price.unitAmount, price.currency) : "$0"}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {" "}
                    / {billingInterval === "MONTHLY" ? "month" : "year"}
                  </span>
                </div>

                {/* Features list */}
                <div className="border-t border-slate-100 pt-4 mb-6">
                  <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
                    Included Capabilities
                  </div>
                  <ul className="space-y-2">
                    {publishedVersion?.features?.map((f) => (
                      <li key={f.id} className="flex items-start text-xs text-slate-600 gap-2">
                        <svg
                          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                            f.enabled ? "text-emerald-500" : "text-slate-300"
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span>
                          <strong className="font-semibold text-slate-800">
                            {f.feature?.name}
                          </strong>
                          {f.isUnlimited ? (
                            <span className="text-emerald-600 font-medium"> (Unlimited)</span>
                          ) : f.numericLimit ? (
                            <span> (Up to {f.numericLimit.toLocaleString()})</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div>
                <button
                  type="button"
                  disabled={isCurrent || isLoading || !publishedVersion}
                  onClick={() => publishedVersion && handleAction(publishedVersion.id, price?.id)}
                  className={`w-full py-2 px-4 rounded-lg font-semibold text-xs tracking-wide transition-all ${
                    isCurrent
                      ? "bg-slate-100 text-slate-400 cursor-default"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow"
                  } ${
                    selectedPlanVersionId === publishedVersion?.id ? "opacity-60 cursor-wait" : ""
                  }`}
                >
                  {isCurrent
                    ? "Active Plan"
                    : selectedPlanVersionId === publishedVersion?.id
                      ? "Processing..."
                      : "Select Plan"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
