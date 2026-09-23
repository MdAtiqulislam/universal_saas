"use client";

import React, { useState } from "react";
import {
  CrmDashboard,
  CrmLeadList,
  CrmOpportunityKanban,
  CrmQuotationList,
  CrmActivityList,
  CrmCustomer360View,
  CrmReportsView,
} from "@/features/crm";

export default function CrmPage() {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "leads" | "pipeline" | "quotations" | "activities" | "customer-360" | "reports"
  >("dashboard");

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              CRM & Commercial Sales Pipeline
            </h1>
            <p className="text-sm text-slate-500">
              Milestone M35 Customer Relationship, Lead Qualification, Opportunity Forecasting &
              Quotation Governance
            </p>
          </div>

          {/* Main Tabs */}
          <div className="flex flex-wrap space-x-1 rounded-xl bg-slate-200/80 p-1">
            {[
              { id: "dashboard", label: "Telemetry" },
              { id: "leads", label: "Leads & Prospects" },
              { id: "pipeline", label: "Visual Pipeline" },
              { id: "quotations", label: "Quotations" },
              { id: "activities", label: "Activities" },
              { id: "customer-360", label: "Customer 360" },
              { id: "reports", label: "Reports" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Views */}
        {activeTab === "dashboard" && <CrmDashboard />}
        {activeTab === "leads" && <CrmLeadList />}
        {activeTab === "pipeline" && <CrmOpportunityKanban />}
        {activeTab === "quotations" && <CrmQuotationList />}
        {activeTab === "activities" && <CrmActivityList />}
        {activeTab === "customer-360" && <CrmCustomer360View />}
        {activeTab === "reports" && <CrmReportsView />}
      </div>
    </div>
  );
}
