"use client";

import React, { useState } from "react";
import {
  ServiceDashboard,
  ServiceAssetList,
  ServiceRequestList,
  ServiceTicketList,
  ServiceOrderList,
  ServiceWarrantyPanel,
  ServiceReports,
} from "@/features/service";

export default function ServicePage() {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "assets" | "requests" | "tickets" | "orders" | "warranty" | "reports"
  >("dashboard");

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Service Management & After-Sales
            </h1>
            <p className="text-sm text-slate-500">
              Milestone M34 After-Sales Service, Warranty Validation & Field Operations
            </p>
          </div>

          {/* Main Tabs */}
          <div className="flex flex-wrap space-x-1 rounded-xl bg-slate-200/80 p-1">
            {[
              { id: "dashboard", label: "Dashboard" },
              { id: "assets", label: "Installed Base" },
              { id: "requests", label: "Requests" },
              { id: "tickets", label: "Tickets & SLA" },
              { id: "orders", label: "Service Orders" },
              { id: "warranty", label: "Warranty Policies" },
              { id: "reports", label: "Analytics" },
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
        {activeTab === "dashboard" && (
          <ServiceDashboard onNavigateTab={(tab) => setActiveTab(tab as any)} />
        )}

        {activeTab === "assets" && <ServiceAssetList />}

        {activeTab === "requests" && <ServiceRequestList />}

        {activeTab === "tickets" && <ServiceTicketList />}

        {activeTab === "orders" && <ServiceOrderList />}

        {activeTab === "warranty" && <ServiceWarrantyPanel />}

        {activeTab === "reports" && <ServiceReports />}
      </div>
    </div>
  );
}
