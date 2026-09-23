"use client";

import React from "react";

interface DashboardProps {
  onNavigateTab: (tabKey: string) => void;
  metrics: {
    totalStockUnits: string;
    totalLocations: number;
    openTasksCount: number;
    pendingPutaways: number;
    pendingPicks: number;
    pendingTransfers: number;
    activeQuarantineCount: number;
    accuracyRate: number;
  };
}

export function WarehouseDashboard({ onNavigateTab, metrics }: DashboardProps) {
  const cards = [
    {
      title: "Total Stock Units",
      value: metrics.totalStockUnits,
      subtitle: "Across all active locations",
      color: "border-l-4 border-blue-500",
      actionTab: "stock",
    },
    {
      title: "Active Locations / Bins",
      value: metrics.totalLocations.toString(),
      subtitle: "Configured warehouse storage points",
      color: "border-l-4 border-emerald-500",
      actionTab: "zones",
    },
    {
      title: "Open Warehouse Tasks",
      value: metrics.openTasksCount.toString(),
      subtitle: "Putaway, Pick, Transfer & Count tasks",
      color: "border-l-4 border-amber-500",
      actionTab: "tasks",
    },
    {
      title: "Inventory Accuracy",
      value: `${metrics.accuracyRate.toFixed(1)}%`,
      subtitle: "Cycle count exact match rate",
      color: "border-l-4 border-purple-500",
      actionTab: "counts",
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
        <h3 className="text-lg font-semibold mb-4">Operational Execution Pipelines</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => onNavigateTab("putaway")}
            className="p-4 border rounded-lg bg-muted/20 hover:bg-muted/40 transition cursor-pointer flex items-start gap-3"
          >
            <div>
              <div className="font-semibold text-sm">Inbound Putaway</div>
              <div className="text-xs text-muted-foreground mt-1">
                Receive stock and move to designated warehouse storage bins.
              </div>
              <div className="mt-2 inline-flex text-xs font-semibold text-blue-600 dark:text-blue-400">
                {metrics.pendingPutaways} pending tasks &rarr;
              </div>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab("picks")}
            className="p-4 border rounded-lg bg-muted/20 hover:bg-muted/40 transition cursor-pointer flex items-start gap-3"
          >
            <div>
              <div className="font-semibold text-sm">Outbound Picking & Waves</div>
              <div className="text-xs text-muted-foreground mt-1">
                Pick stock against sales reservations and stage for delivery dispatch.
              </div>
              <div className="mt-2 inline-flex text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {metrics.pendingPicks} pending picks &rarr;
              </div>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab("transfers")}
            className="p-4 border rounded-lg bg-muted/20 hover:bg-muted/40 transition cursor-pointer flex items-start gap-3"
          >
            <div>
              <div className="font-semibold text-sm">Internal Warehouse Transfers</div>
              <div className="text-xs text-muted-foreground mt-1">
                Inter-warehouse and intra-zone relocation requests with 2-step approval.
              </div>
              <div className="mt-2 inline-flex text-xs font-semibold text-purple-600 dark:text-purple-400">
                {metrics.pendingTransfers} active transfers &rarr;
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Control Pipelines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onClick={() => onNavigateTab("quarantine")}
          className="p-5 bg-card border rounded-xl hover:border-amber-500/50 transition cursor-pointer flex items-center justify-between"
        >
          <div>
            <div className="font-semibold">Quarantine & Quality Control</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Inspect suspect goods, manage lot dispositions (Hold, Release, Scrap, Return).
            </div>
          </div>
          <span className="text-sm font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded-full">
            {metrics.activeQuarantineCount} active
          </span>
        </div>

        <div
          onClick={() => onNavigateTab("replenishment")}
          className="p-5 bg-card border rounded-xl hover:border-blue-500/50 transition cursor-pointer flex items-center justify-between"
        >
          <div>
            <div className="font-semibold">Dynamic Bin Replenishment</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Automate stock moves from bulk storage to forward picking faces based on min/max.
            </div>
          </div>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            Manage Rules &rarr;
          </span>
        </div>
      </div>
    </div>
  );
}
