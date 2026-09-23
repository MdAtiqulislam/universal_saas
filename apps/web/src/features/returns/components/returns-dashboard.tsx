/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { returnsApi } from "../api/returns-api";
import { ReturnRequest } from "../types/returns.types";

interface SummaryData {
  totalRmas: number;
  statusCounts: {
    draft: number;
    authorized: number;
    received: number;
    inspecting: number;
    resolved: number;
    closed: number;
    rejected: number;
  };
  quantities: {
    requested: number;
    authorized: number;
    received: number;
    inspected: number;
    accepted: number;
    rejected: number;
  };
  totalFinancialValue: number;
}

interface ReturnsDashboardProps {
  onSelectReturn: (returnId: string) => void;
  onCreateClick: () => void;
}

export const ReturnsDashboard: React.FC<ReturnsDashboardProps> = ({
  onSelectReturn,
  onCreateClick,
}) => {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [recentReturns, setRecentReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [summaryRes, returnsRes] = await Promise.all([
        returnsApi.getReport("summary") as Promise<SummaryData>,
        returnsApi.listReturns(),
      ]);
      setSummary(summaryRes);
      setRecentReturns(returnsRes.slice(0, 8));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-slate-500">Loading returns dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
        Error loading returns data: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Returns & RMA Overview</h2>
          <p className="text-sm text-slate-500">
            Reverse logistics orchestration, authorizations, receiving, inspection, and resolutions.
          </p>
        </div>
        <button
          onClick={onCreateClick}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          + Create Return Request (RMA)
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">Total RMAs</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900">
              {summary?.totalRmas ?? 0}
            </span>
            <span className="text-xs text-indigo-600 font-medium">All Time</span>
          </div>
          <div className="mt-3 flex gap-2 text-xs text-slate-500">
            <span>Draft: {summary?.statusCounts.draft ?? 0}</span>
            <span>•</span>
            <span>Auth: {summary?.statusCounts.authorized ?? 0}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Receiving & Inspecting
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-amber-600">
              {(summary?.statusCounts.received ?? 0) + (summary?.statusCounts.inspecting ?? 0)}
            </span>
            <span className="text-xs text-amber-600 font-medium">In Progress</span>
          </div>
          <div className="mt-3 flex gap-2 text-xs text-slate-500">
            <span>Received: {summary?.statusCounts.received ?? 0}</span>
            <span>•</span>
            <span>Inspecting: {summary?.statusCounts.inspecting ?? 0}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">Resolved & Closed</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-emerald-600">
              {(summary?.statusCounts.resolved ?? 0) + (summary?.statusCounts.closed ?? 0)}
            </span>
            <span className="text-xs text-emerald-600 font-medium">Completed</span>
          </div>
          <div className="mt-3 flex gap-2 text-xs text-slate-500">
            <span>Resolved: {summary?.statusCounts.resolved ?? 0}</span>
            <span>•</span>
            <span>Closed: {summary?.statusCounts.closed ?? 0}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Total Financial Value
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900">
              $
              {(summary?.totalFinancialValue ?? 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-xs text-slate-500 font-medium">USD</span>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Accepted Qty: {summary?.quantities.accepted ?? 0} units
          </div>
        </div>
      </div>

      {/* Recent Returns Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">Recent Return Requests (RMAs)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3">RMA Number</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Customer / Supplier</th>
                <th className="px-6 py-3">Reason</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Requested Date</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentReturns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No return requests found. Click &quot;Create Return Request&quot; to get
                    started.
                  </td>
                </tr>
              ) : (
                recentReturns.map((rma) => (
                  <tr key={rma.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-3 font-semibold text-indigo-600">{rma.returnNumber}</td>
                    <td className="px-6 py-3 text-xs">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                        {rma.returnType.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-3">{rma.customer?.name ?? rma.supplier?.name ?? "—"}</td>
                    <td className="px-6 py-3 text-slate-700">{rma.reason.name}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          rma.status === "CLOSED" || rma.status === "RESOLVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : rma.status === "REJECTED" ||
                                rma.status === "CANCELLED" ||
                                rma.status === "VOIDED"
                              ? "bg-red-100 text-red-800"
                              : rma.status === "AUTHORIZED" || rma.status === "RECEIVED"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {rma.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-500">
                      {new Date(rma.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => onSelectReturn(rma.id)}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        View Details →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
