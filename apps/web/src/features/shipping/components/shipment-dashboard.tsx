"use client";

import React from "react";
import { ShipmentSummaryReport } from "../types/shipping.types";

interface ShipmentDashboardProps {
  summary: ShipmentSummaryReport | null;
  loading: boolean;
  onFilterStatus?: (status: string) => void;
}

export function ShipmentDashboard({ summary, loading, onFilterStatus }: ShipmentDashboardProps) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-pulse">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Total Shipments",
      value: summary.totalShipments,
      color: "text-zinc-900 dark:text-zinc-100",
      status: "",
    },
    {
      label: "In Transit",
      value: summary.inTransitCount,
      color: "text-blue-600 dark:text-blue-400",
      status: "IN_TRANSIT",
    },
    {
      label: "Delivered",
      value: summary.deliveredCount,
      color: "text-emerald-600 dark:text-emerald-400",
      status: "DELIVERED",
    },
    {
      label: "Ready / Assigned",
      value: summary.readyCount + summary.assignedCount,
      color: "text-amber-600 dark:text-amber-400",
      status: "ASSIGNED",
    },
    {
      label: "Failed Attempts",
      value: summary.failedCount,
      color: "text-rose-600 dark:text-rose-400",
      status: "FAILED",
    },
    {
      label: "Returned",
      value: summary.returnedCount,
      color: "text-purple-600 dark:text-purple-400",
      status: "RETURNED",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onFilterStatus?.(card.status)}
            className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm text-left hover:border-zinc-300 dark:hover:border-zinc-700 transition"
          >
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            On-Time Delivery Rate
          </p>
          <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            {summary.onTimeDeliveryRate}%
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            Total Logistics Cost
          </p>
          <p className="text-2xl font-bold mt-1 text-zinc-900 dark:text-zinc-100">
            $
            {Number(summary.totalLogisticsCost).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            Freight & Insurance
          </p>
          <p className="text-sm font-semibold mt-2 text-zinc-700 dark:text-zinc-300">
            Freight: ${Number(summary.totalShippingCost).toFixed(2)} | Ins: $
            {Number(summary.totalInsuranceCost).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}
