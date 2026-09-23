/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { returnsApi } from "../api/returns-api";
import { ReturnRequest } from "../types/returns.types";

interface ReturnListProps {
  onSelectReturn: (returnId: string) => void;
  onCreateClick: () => void;
}

export const ReturnList: React.FC<ReturnListProps> = ({ onSelectReturn, onCreateClick }) => {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const loadReturns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.returnType = typeFilter;
      if (search) params.search = search;

      const data = await returnsApi.listReturns(params);
      setReturns(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load returns");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, search]);

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Return Requests (RMAs)</h2>
          <p className="text-sm text-slate-500">
            Search, filter, and orchestrate all customer and supplier return workflows.
          </p>
        </div>
        <button
          onClick={onCreateClick}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          + New RMA
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          placeholder="Search by RMA number or notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[240px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">DRAFT</option>
          <option value="SUBMITTED">SUBMITTED</option>
          <option value="UNDER_REVIEW">UNDER REVIEW</option>
          <option value="AUTHORIZED">AUTHORIZED</option>
          <option value="RECEIVED">RECEIVED</option>
          <option value="INSPECTING">INSPECTING</option>
          <option value="DISPOSITION_PENDING">DISPOSITION PENDING</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="CLOSED">CLOSED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-500"
        >
          <option value="">All Return Types</option>
          <option value="CUSTOMER_RETURN">CUSTOMER RETURN</option>
          <option value="SUPPLIER_RETURN">SUPPLIER RETURN</option>
          <option value="INTERNAL_RETURN">INTERNAL RETURN</option>
          <option value="WARRANTY_RETURN">WARRANTY RETURN</option>
          <option value="REPLACEMENT_RETURN">REPLACEMENT RETURN</option>
        </select>

        <button
          onClick={() => {
            setStatusFilter("");
            setTypeFilter("");
            setSearch("");
          }}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Reset Filters
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3">RMA #</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Customer / Supplier</th>
                <th className="px-6 py-3">Reason</th>
                <th className="px-6 py-3">Lines</th>
                <th className="px-6 py-3">Total Value</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Requested At</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-400">
                    Loading return requests...
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-400">
                    No return requests match your criteria.
                  </td>
                </tr>
              ) : (
                returns.map((rma) => {
                  const totalVal = rma.lines.reduce((sum, l) => sum + Number(l.lineAmount || 0), 0);
                  return (
                    <tr key={rma.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-3 font-semibold text-indigo-600">
                        {rma.returnNumber}
                      </td>
                      <td className="px-6 py-3 text-xs">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                          {rma.returnType.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {rma.customer?.name ?? rma.supplier?.name ?? "—"}
                      </td>
                      <td className="px-6 py-3 text-slate-700">{rma.reason.name}</td>
                      <td className="px-6 py-3">{rma.lines.length}</td>
                      <td className="px-6 py-3 font-medium text-slate-900">
                        ${totalVal.toFixed(2)}
                      </td>
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
                          className="rounded border border-indigo-200 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                        >
                          Manage →
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
