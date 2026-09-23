"use client";

import React, { useEffect, useState } from "react";
import { serviceApi } from "../api/service-api";
import { ServiceSummaryReport } from "../types/service.types";

export function ServiceDashboard({ onNavigateTab }: { onNavigateTab: (tab: string) => void }) {
  const [summary, setSummary] = useState<ServiceSummaryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const data = await serviceApi.getSummary();
      setSummary(data);
    } catch (err: any) {
      setError(err.message || "Failed to load service dashboard summary");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl bg-white p-8 shadow-sm">
        <div className="flex items-center space-x-3 text-slate-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
          <span className="text-sm font-medium">Loading after-sales service metrics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-semibold">Unable to load dashboard data</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Level KPIs */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <dt className="truncate text-xs font-semibold uppercase tracking-wider text-slate-500">
            Open Support Tickets
          </dt>
          <dd className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
            {summary?.tickets.open || 0}
          </dd>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="text-slate-500">Total: {summary?.tickets.total || 0}</span>
            <button
              onClick={() => onNavigateTab("tickets")}
              className="font-medium text-indigo-600 hover:text-indigo-800"
            >
              View tickets &rarr;
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <dt className="truncate text-xs font-semibold uppercase tracking-wider text-slate-500">
            Active Service Orders
          </dt>
          <dd className="mt-2 text-3xl font-extrabold tracking-tight text-indigo-600">
            {summary?.serviceOrders.active || 0}
          </dd>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Completed: {summary?.serviceOrders.completed || 0}
            </span>
            <button
              onClick={() => onNavigateTab("orders")}
              className="font-medium text-indigo-600 hover:text-indigo-800"
            >
              View orders &rarr;
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <dt className="truncate text-xs font-semibold uppercase tracking-wider text-slate-500">
            SLA Breached
          </dt>
          <dd className="mt-2 text-3xl font-extrabold tracking-tight text-rose-600">
            {summary?.tickets.breached || 0}
          </dd>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="text-slate-500">Target compliance: &gt;95%</span>
            <button
              onClick={() => onNavigateTab("reports")}
              className="font-medium text-indigo-600 hover:text-indigo-800"
            >
              SLA details &rarr;
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <dt className="truncate text-xs font-semibold uppercase tracking-wider text-slate-500">
            Installed Base Assets
          </dt>
          <dd className="mt-2 text-3xl font-extrabold tracking-tight text-emerald-600">
            {summary?.installedBase.totalCustomerAssets || 0}
          </dd>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="text-slate-500">Customer equipment registry</span>
            <button
              onClick={() => onNavigateTab("assets")}
              className="font-medium text-indigo-600 hover:text-indigo-800"
            >
              Asset registry &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Quick Action Matrix */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900">Warranty vs Billable Repairs</h3>
          <p className="mt-1 text-xs text-slate-500">Distribution of executed service orders</p>
          <div className="mt-6 space-y-4">
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>Warranty Covered Work</span>
                <span>{summary?.serviceOrders.warranty || 0} orders</span>
              </div>
              <div className="mt-2 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full"
                  style={{
                    width: `${
                      summary?.serviceOrders.total
                        ? (
                            (summary.serviceOrders.warranty / summary.serviceOrders.total) *
                            100
                          ).toFixed(0)
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>Chargeable / Billable Work</span>
                <span>{summary?.serviceOrders.chargeable || 0} orders</span>
              </div>
              <div className="mt-2 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${
                      summary?.serviceOrders.total
                        ? (
                            (summary.serviceOrders.chargeable / summary.serviceOrders.total) *
                            100
                          ).toFixed(0)
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900">Operational Directives</h3>
          <p className="mt-1 text-xs text-slate-500">
            Core workflows for technician & support staff
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2">
            <button
              onClick={() => onNavigateTab("requests")}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
            >
              <span>Intake & Triage Requests</span>
              <span className="rounded bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-700">
                Triage
              </span>
            </button>
            <button
              onClick={() => onNavigateTab("tickets")}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
            >
              <span>Assign Technicians & Diagnose</span>
              <span className="rounded bg-slate-200 px-2 py-0.5 font-semibold text-slate-700">
                Assign
              </span>
            </button>
            <button
              onClick={() => onNavigateTab("orders")}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
            >
              <span>Execute Orders, Parts & Labor</span>
              <span className="rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                Execute
              </span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900">Authoritative Integrations</h3>
          <p className="mt-1 text-xs text-slate-500">Cross-domain architectural linkages</p>
          <ul className="mt-4 space-y-2 text-xs text-slate-600">
            <li className="flex items-center space-x-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              <span>
                <strong>M12 GL:</strong> Automatic warranty expense posting
              </span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
              <span>
                <strong>M14 AR:</strong> 1-click customer invoice generation
              </span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
              <span>
                <strong>M09 & M30:</strong> Real-time parts reservation & return
              </span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>
              <span>
                <strong>M31 QA:</strong> Mandatory post-service quality check
              </span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
              <span>
                <strong>M32 RMA:</strong> Seamless conversion from return disposition
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
