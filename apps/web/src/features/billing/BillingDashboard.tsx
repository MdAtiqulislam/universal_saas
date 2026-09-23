"use client";

import React, { useState, useEffect, useCallback } from "react";
import { BillingDashboardData, BillingPlan, UsageSummaryItem } from "./types";
import {
  getBillingOverview,
  listPlans,
  getUsageSummary,
  createSubscription,
  upgradeSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
} from "./api/billing-api";

import { BillingKpiRibbon } from "./components/BillingKpiRibbon";
import { PlanCatalogPanel } from "./components/PlanCatalogPanel";
import { SubscriptionDetailsPanel } from "./components/SubscriptionDetailsPanel";
import { UsageQuotasPanel } from "./components/UsageQuotasPanel";
import { InvoiceListPanel } from "./components/InvoiceListPanel";
import { PaymentHistoryPanel } from "./components/PaymentHistoryPanel";
import { EntitlementsPanel } from "./components/EntitlementsPanel";
import { BillingReportsPanel } from "./components/BillingReportsPanel";
import { BillingAdminPanel } from "./components/BillingAdminPanel";

type TabType =
  | "OVERVIEW"
  | "PLANS"
  | "SUBSCRIPTION"
  | "USAGE"
  | "INVOICES"
  | "PAYMENTS"
  | "ENTITLEMENTS"
  | "REPORTS"
  | "ADMIN";

export const BillingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("OVERVIEW");
  const [overview, setOverview] = useState<BillingDashboardData | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [usageSummary, setUsageSummary] = useState<UsageSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [ov, pl, us] = await Promise.all([
        getBillingOverview(),
        listPlans(),
        getUsageSummary(30),
      ]);
      setOverview(ov);
      setPlans(pl);
      setUsageSummary(us);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.all([getBillingOverview(), listPlans(), getUsageSummary(30)])
      .then(([ov, pl, us]) => {
        if (!ignore) {
          setOverview(ov);
          setPlans(pl);
          setUsageSummary(us);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : String(err);
          setErrorMessage(msg);
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleSelectPlan = async (planVersionId: string, priceId?: string) => {
    try {
      if (overview?.subscription) {
        // Upgrade / Downgrade existing subscription
        await upgradeSubscription({
          newPlanVersionId: planVersionId,
          newPriceId: priceId,
        });
        setActionNotice("Plan upgraded successfully with proration adjustment.");
      } else {
        // Create new subscription
        await createSubscription({
          planVersionId,
          priceId,
        });
        setActionNotice("Subscription activated successfully.");
      }
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    }
  };

  const handleCancelSubscription = async (immediately: boolean, reason?: string) => {
    try {
      await cancelSubscription({ immediately, reason });
      setActionNotice(
        immediately
          ? "Subscription cancelled immediately."
          : "Subscription scheduled to cancel at end of billing period.",
      );
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    }
  };

  const handlePauseSubscription = async () => {
    try {
      await pauseSubscription();
      setActionNotice("Subscription paused successfully.");
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    }
  };

  const handleResumeSubscription = async () => {
    try {
      await resumeSubscription();
      setActionNotice("Subscription resumed successfully.");
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    }
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "OVERVIEW", label: "Overview" },
    { id: "PLANS", label: "Plans & Pricing" },
    { id: "SUBSCRIPTION", label: "Subscription" },
    { id: "USAGE", label: "Usage & Quotas" },
    { id: "INVOICES", label: "Invoices" },
    { id: "PAYMENTS", label: "Transactions" },
    { id: "ENTITLEMENTS", label: "Entitlements" },
    { id: "REPORTS", label: "Reports" },
    { id: "ADMIN", label: "Billing Admin" },
  ];

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
          <span className="text-xs text-slate-500">Loading billing dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Billing & Subscriptions
          </h1>
          <p className="text-xs text-slate-500">
            Enterprise monetization, plan contracts, usage metering, and financial reconciliation.
          </p>
        </div>
      </div>

      {/* Action Notice Alert */}
      {actionNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-xs flex justify-between items-center">
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-emerald-700 font-bold hover:text-emerald-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg text-xs flex justify-between items-center">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 font-bold hover:text-rose-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top KPI Ribbon */}
      {overview && (
        <BillingKpiRibbon
          subscription={overview.subscription}
          entitlements={overview.entitlements}
          financials={overview.financials}
        />
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-2.5 px-4 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Panels */}
      {activeTab === "OVERVIEW" && overview && (
        <div className="space-y-6">
          <SubscriptionDetailsPanel
            subscription={overview.subscription}
            onPause={handlePauseSubscription}
            onResume={handleResumeSubscription}
            onCancel={handleCancelSubscription}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UsageQuotasPanel quotas={overview.entitlements.quotas} usageSummary={usageSummary} />
            <InvoiceListPanel invoices={overview.recentInvoices} />
          </div>
        </div>
      )}

      {activeTab === "PLANS" && (
        <PlanCatalogPanel
          plans={plans}
          subscription={overview?.subscription || null}
          onSelectPlan={handleSelectPlan}
        />
      )}

      {activeTab === "SUBSCRIPTION" && overview && (
        <SubscriptionDetailsPanel
          subscription={overview.subscription}
          onPause={handlePauseSubscription}
          onResume={handleResumeSubscription}
          onCancel={handleCancelSubscription}
        />
      )}

      {activeTab === "USAGE" && overview && (
        <UsageQuotasPanel quotas={overview.entitlements.quotas} usageSummary={usageSummary} />
      )}

      {activeTab === "INVOICES" && overview && (
        <InvoiceListPanel invoices={overview.recentInvoices} />
      )}

      {activeTab === "PAYMENTS" && overview && (
        <PaymentHistoryPanel payments={overview.recentPayments} />
      )}

      {activeTab === "ENTITLEMENTS" && overview && (
        <EntitlementsPanel entitlements={overview.entitlements} />
      )}

      {activeTab === "REPORTS" && <BillingReportsPanel />}

      {activeTab === "ADMIN" && overview && (
        <BillingAdminPanel credits={[]} availableCredit={overview.financials.availableCredit} />
      )}
    </div>
  );
};
