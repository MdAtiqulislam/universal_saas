"use client";

import React, { useState } from "react";
import { BillingSubscription } from "../types";

interface Props {
  subscription: BillingSubscription | null;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onCancel: (immediately: boolean, reason?: string) => Promise<void>;
  isLoading?: boolean;
}

export const SubscriptionDetailsPanel: React.FC<Props> = ({
  subscription,
  onPause,
  onResume,
  onCancel,
  isLoading = false,
}) => {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelImmediately, setCancelImmediately] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  if (!subscription) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center shadow-sm">
        <h3 className="text-base font-semibold text-slate-900 mb-2">No Active Subscription</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Your organization does not currently have an active commercial subscription. Select a tier
          from the Plan Catalog to activate platform features.
        </p>
      </div>
    );
  }

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await onCancel(cancelImmediately, cancelReason);
      setShowCancelModal(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Subscription Status</h2>
          <p className="text-xs text-slate-500">
            Tenant commercial subscription ID: {subscription.id}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {subscription.status === "ACTIVE" && (
            <button
              type="button"
              disabled={isLoading || isProcessing}
              onClick={onPause}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Pause Subscription
            </button>
          )}

          {subscription.status === "PAUSED" && (
            <button
              type="button"
              disabled={isLoading || isProcessing}
              onClick={onResume}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              Resume Subscription
            </button>
          )}

          {subscription.status !== "CANCELLED" && (
            <button
              type="button"
              disabled={isLoading || isProcessing}
              onClick={() => setShowCancelModal(true)}
              className="px-3 py-1.5 rounded-lg border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
            >
              Cancel Subscription
            </button>
          )}
        </div>
      </div>

      {/* Subscription Key Attributes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 py-6 border-b border-slate-100">
        <div>
          <div className="text-xs font-medium text-slate-400 mb-1">Tier & Version</div>
          <div className="text-sm font-bold text-slate-900">
            {subscription.planVersion.plan.name}
          </div>
          <div className="text-xs text-slate-500">Version {subscription.planVersion.version}</div>
        </div>

        <div>
          <div className="text-xs font-medium text-slate-400 mb-1">Current Period</div>
          <div className="text-sm font-bold text-slate-900">
            {new Date(subscription.currentPeriodStart).toLocaleDateString()} –{" "}
            {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </div>
          <div className="text-xs text-slate-500">
            {subscription.cancelAtPeriodEnd ? "Scheduled cancellation" : "Auto-renews"}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-slate-400 mb-1">Trial Lifecycle</div>
          <div className="text-sm font-bold text-slate-900">
            {subscription.status === "TRIALING" && subscription.trialEnd ? (
              <span className="text-blue-600">
                Ends {new Date(subscription.trialEnd).toLocaleDateString()}
              </span>
            ) : (
              "Standard Billing"
            )}
          </div>
          <div className="text-xs text-slate-500">Scope: {subscription.scope || "PLATFORM"}</div>
        </div>

        <div>
          <div className="text-xs font-medium text-slate-400 mb-1">Payment Interval</div>
          <div className="text-sm font-bold text-slate-900">
            {subscription.price?.interval || "MONTHLY"}
          </div>
          <div className="text-xs text-slate-500">
            Currency: {subscription.price?.currency || "USD"}
          </div>
        </div>
      </div>

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Cancel Commercial Subscription
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Are you sure you want to cancel the subscription for{" "}
              <strong>{subscription.planVersion.plan.name}</strong>?
            </p>

            <form onSubmit={handleCancelSubmit}>
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cancellation Reason (Optional)
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Consolidating vendors, seasonal pause..."
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="mb-6 flex items-start gap-2">
                <input
                  type="checkbox"
                  id="immediately"
                  checked={cancelImmediately}
                  onChange={(e) => setCancelImmediately(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600"
                />
                <label htmlFor="immediately" className="text-xs text-slate-600">
                  Cancel immediately (downgrades features now instead of at the end of the billing
                  period)
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setShowCancelModal(false)}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Keep Subscription
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 shadow-sm"
                >
                  {isProcessing ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
