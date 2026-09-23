"use client";

import React, { useState } from "react";
import {
  FinancialDashboard,
  TrialBalanceView,
  GeneralLedgerView,
  ProfitLossView,
  BalanceSheetView,
  CashFlowView,
  SubledgerReconciliationView,
  PeriodCloseManagement,
} from "@/features/accounting-reporting";

export default function FinancialReportingPage() {
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "trial-balance"
    | "general-ledger"
    | "profit-loss"
    | "balance-sheet"
    | "cash-flow"
    | "reconciliation"
    | "period-close"
  >("dashboard");

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Financial Reporting & Period Close
            </h1>
            <p className="text-sm text-slate-500">
              Milestone M33 Authoritative Financial Statements, Subledger Reconciliation & Period
              Control
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-1 rounded-xl bg-slate-200/80 p-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "dashboard"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Dashboard & KPIs
            </button>
            <button
              onClick={() => setActiveTab("trial-balance")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "trial-balance"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Trial Balance
            </button>
            <button
              onClick={() => setActiveTab("general-ledger")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "general-ledger"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              General Ledger
            </button>
            <button
              onClick={() => setActiveTab("profit-loss")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "profit-loss"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Profit & Loss
            </button>
            <button
              onClick={() => setActiveTab("balance-sheet")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "balance-sheet"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Balance Sheet
            </button>
            <button
              onClick={() => setActiveTab("cash-flow")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "cash-flow"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Cash Flow
            </button>
            <button
              onClick={() => setActiveTab("reconciliation")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "reconciliation"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Reconciliation
            </button>
            <button
              onClick={() => setActiveTab("period-close")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "period-close"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Period Close
            </button>
          </div>
        </div>

        {/* Tab Views */}
        {activeTab === "dashboard" && (
          <FinancialDashboard
            onSelectTab={(tab) => setActiveTab(tab as unknown as typeof activeTab)}
          />
        )}
        {activeTab === "trial-balance" && <TrialBalanceView />}
        {activeTab === "general-ledger" && <GeneralLedgerView />}
        {activeTab === "profit-loss" && <ProfitLossView />}
        {activeTab === "balance-sheet" && <BalanceSheetView />}
        {activeTab === "cash-flow" && <CashFlowView />}
        {activeTab === "reconciliation" && <SubledgerReconciliationView />}
        {activeTab === "period-close" && <PeriodCloseManagement />}
      </div>
    </div>
  );
}
