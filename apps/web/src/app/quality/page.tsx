/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  QualityDashboard,
  InspectionLotsPanel,
  InspectionPlansPanel,
  SamplingPlansPanel,
  QualityHoldsPanel,
  NonConformancePanel,
  CapaPanel,
  SupplierQualityPanel,
  CustomerIssuesPanel,
  QualityReportsPanel,
  QualityConfigPanel,
  qualityApi,
} from "@/features/quality";

export default function QualityPage() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [metrics, setMetrics] = useState({
    totalInspectionLots: 0,
    pendingInspections: 0,
    activeHoldsCount: 0,
    openNcrsCount: 0,
    openCapasCount: 0,
    customerIssuesCount: 0,
    passRate: 100,
  });

  const loadMetrics = useCallback(async () => {
    try {
      const [lots, holds, ncrs, capas, customerIssues, summaryReport] = await Promise.all([
        qualityApi.getInspectionLots().catch(() => []),
        qualityApi.getHolds({ status: "ACTIVE" }).catch(() => []),
        qualityApi.getNonConformances().catch(() => []),
        qualityApi.getCapas().catch(() => []),
        qualityApi.getCustomerIssues().catch(() => []),
        qualityApi.getInspectionSummaryReport().catch(() => ({
          overallPassRate: 100,
        })),
      ]);

      setMetrics({
        totalInspectionLots: Array.isArray(lots) ? lots.length : 0,
        pendingInspections: Array.isArray(lots)
          ? lots.filter((l) => l.status === "PENDING" || l.status === "IN_PROGRESS").length
          : 0,
        activeHoldsCount: Array.isArray(holds) ? holds.length : 0,
        openNcrsCount: Array.isArray(ncrs)
          ? ncrs.filter((n) => n.status !== "CLOSED" && n.status !== "CANCELLED").length
          : 0,
        openCapasCount: Array.isArray(capas)
          ? capas.filter((c) => c.status !== "CLOSED" && c.status !== "CANCELLED").length
          : 0,
        customerIssuesCount: Array.isArray(customerIssues)
          ? customerIssues.filter((i) => i.status !== "RESOLVED" && i.status !== "CLOSED").length
          : 0,
        passRate: summaryReport?.overallPassRate ?? 100,
      });
    } catch (err) {
      console.error("Failed to load quality metrics", err);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const navItems = [
    { key: "dashboard", label: "Dashboard" },
    { key: "inspections", label: "Inspection Lots" },
    { key: "plans", label: "Inspection Plans" },
    { key: "sampling", label: "Sampling Formulas" },
    { key: "holds", label: "Quality Holds" },
    { key: "ncr", label: "Non-Conformance (NCR)" },
    { key: "capa", label: "CAPA Actions" },
    { key: "suppliers", label: "Supplier Quality" },
    { key: "customer-issues", label: "Customer Issues" },
    { key: "reports", label: "Reports" },
    { key: "config", label: "Configuration" },
  ];

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Quality Management & Control
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enterprise inspection execution, statistical sampling, disposition, NCR, and CAPA
            foundation (M31)
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex overflow-x-auto gap-1 border-b pb-2 no-scrollbar">
        {navItems.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="mt-4">
        {activeTab === "dashboard" && (
          <QualityDashboard onNavigateTab={(tab) => setActiveTab(tab)} metrics={metrics} />
        )}
        {activeTab === "inspections" && <InspectionLotsPanel />}
        {activeTab === "plans" && <InspectionPlansPanel />}
        {activeTab === "sampling" && <SamplingPlansPanel />}
        {activeTab === "holds" && <QualityHoldsPanel />}
        {activeTab === "ncr" && <NonConformancePanel />}
        {activeTab === "capa" && <CapaPanel />}
        {activeTab === "suppliers" && <SupplierQualityPanel />}
        {activeTab === "customer-issues" && <CustomerIssuesPanel />}
        {activeTab === "reports" && <QualityReportsPanel />}
        {activeTab === "config" && <QualityConfigPanel />}
      </div>
    </div>
  );
}
