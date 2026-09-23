"use client";

import React from "react";

interface DashboardProps {
  onNavigateTab: (tabKey: string) => void;
  metrics: {
    totalInspectionLots: number;
    pendingInspections: number;
    activeHoldsCount: number;
    openNcrsCount: number;
    openCapasCount: number;
    customerIssuesCount: number;
    passRate: number;
  };
}

export function QualityDashboard({ onNavigateTab, metrics }: DashboardProps) {
  const cards = [
    {
      title: "Pass Rate",
      value: `${metrics.passRate.toFixed(1)}%`,
      subtitle: "Inspection items passed specification",
      color: "border-l-4 border-emerald-500",
      actionTab: "reports",
    },
    {
      title: "Pending Inspections",
      value: metrics.pendingInspections.toString(),
      subtitle: "Awaiting QC execution & decision",
      color: "border-l-4 border-amber-500",
      actionTab: "inspections",
    },
    {
      title: "Active Quality Holds",
      value: metrics.activeHoldsCount.toString(),
      subtitle: "Stock quarantined or locked",
      color: "border-l-4 border-red-500",
      actionTab: "holds",
    },
    {
      title: "Open Non-Conformances",
      value: metrics.openNcrsCount.toString(),
      subtitle: "NCRs requiring disposition",
      color: "border-l-4 border-purple-500",
      actionTab: "ncr",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.title}
            onClick={() => onNavigateTab(c.actionTab)}
            className={`p-5 bg-card border rounded-xl shadow-xs hover:border-primary/50 transition-all cursor-pointer flex flex-col justify-between ${c.color}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{c.title}</span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight">{c.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.subtitle}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Operational Flow Quick Actions */}
      <div className="bg-card border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Quality & Inspection Execution Pipelines</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => onNavigateTab("inspections")}
            className="p-4 border rounded-lg bg-muted/20 hover:bg-muted/40 transition cursor-pointer flex items-start gap-3"
          >
            <div>
              <div className="font-semibold text-sm">Inspection Lots & Execution</div>
              <div className="text-xs text-muted-foreground mt-1">
                Record sample measurements, pass/fail checks, and authoritative decisions.
              </div>
              <div className="mt-2 inline-flex text-xs font-semibold text-blue-600 dark:text-blue-400">
                {metrics.pendingInspections} pending lots &rarr;
              </div>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab("ncr")}
            className="p-4 border rounded-lg bg-muted/20 hover:bg-muted/40 transition cursor-pointer flex items-start gap-3"
          >
            <div>
              <div className="font-semibold text-sm">Non-Conformance & Containment</div>
              <div className="text-xs text-muted-foreground mt-1">
                Manage root cause analysis, immediate containment, and material disposition.
              </div>
              <div className="mt-2 inline-flex text-xs font-semibold text-purple-600 dark:text-purple-400">
                {metrics.openNcrsCount} active NCRs &rarr;
              </div>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab("capa")}
            className="p-4 border rounded-lg bg-muted/20 hover:bg-muted/40 transition cursor-pointer flex items-start gap-3"
          >
            <div>
              <div className="font-semibold text-sm">CAPA Investigations & Verification</div>
              <div className="text-xs text-muted-foreground mt-1">
                Corrective and preventive action plans with effectiveness verification.
              </div>
              <div className="mt-2 inline-flex text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {metrics.openCapasCount} open CAPAs &rarr;
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold">Quality Master Controls</h3>
            <span className="text-xs text-muted-foreground">Governing Policies</span>
          </div>
          <div className="space-y-3">
            <div
              onClick={() => onNavigateTab("plans")}
              className="p-3 border rounded-lg hover:bg-muted/30 cursor-pointer flex justify-between items-center"
            >
              <div>
                <div className="font-medium text-sm">Inspection Plans & Characteristics</div>
                <div className="text-xs text-muted-foreground">
                  Define version-controlled inspection parameters, tolerances, and specs.
                </div>
              </div>
              <span className="text-xs text-muted-foreground">&rarr;</span>
            </div>

            <div
              onClick={() => onNavigateTab("sampling")}
              className="p-3 border rounded-lg hover:bg-muted/30 cursor-pointer flex justify-between items-center"
            >
              <div>
                <div className="font-medium text-sm">Statistical Sampling Plans</div>
                <div className="text-xs text-muted-foreground">
                  Configure 100%, fixed, percentage, and lot-size based sampling formulas.
                </div>
              </div>
              <span className="text-xs text-muted-foreground">&rarr;</span>
            </div>

            <div
              onClick={() => onNavigateTab("config")}
              className="p-3 border rounded-lg hover:bg-muted/30 cursor-pointer flex justify-between items-center"
            >
              <div>
                <div className="font-medium text-sm">Quality Settings & Automation</div>
                <div className="text-xs text-muted-foreground">
                  Auto-lot creation triggers and default hold enforcement policies.
                </div>
              </div>
              <span className="text-xs text-muted-foreground">&rarr;</span>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold">Quality Intelligence & Audits</h3>
            <span className="text-xs text-muted-foreground">External & Internal</span>
          </div>
          <div className="space-y-3">
            <div
              onClick={() => onNavigateTab("suppliers")}
              className="p-3 border rounded-lg hover:bg-muted/30 cursor-pointer flex justify-between items-center"
            >
              <div>
                <div className="font-medium text-sm">Supplier Quality Scorecards</div>
                <div className="text-xs text-muted-foreground">
                  Incoming material defect rates, rejection history, and ratings.
                </div>
              </div>
              <span className="text-xs text-muted-foreground">&rarr;</span>
            </div>

            <div
              onClick={() => onNavigateTab("customer-issues")}
              className="p-3 border rounded-lg hover:bg-muted/30 cursor-pointer flex justify-between items-center"
            >
              <div>
                <div className="font-medium text-sm">Customer Quality & RMAs</div>
                <div className="text-xs text-muted-foreground">
                  Customer reported issues, warranty defects, and field resolution.
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {metrics.customerIssuesCount} issues &rarr;
              </span>
            </div>

            <div
              onClick={() => onNavigateTab("reports")}
              className="p-3 border rounded-lg hover:bg-muted/30 cursor-pointer flex justify-between items-center"
            >
              <div>
                <div className="font-medium text-sm">Comprehensive Quality Reports</div>
                <div className="text-xs text-muted-foreground">
                  12 executive and operational quality intelligence views.
                </div>
              </div>
              <span className="text-xs text-muted-foreground">&rarr;</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
