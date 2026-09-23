"use client";

import React from "react";
import { Shipment, ShipmentStatus } from "../types/shipping.types";

interface ShipmentListProps {
  shipments: Shipment[];
  loading: boolean;
  onSelectShipment: (shipment: Shipment) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  searchTerm: string;
  onSearchChange: (search: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ShipmentList({
  shipments,
  loading,
  onSelectShipment,
  statusFilter,
  onStatusFilterChange,
  searchTerm,
  onSearchChange,
  page,
  totalPages,
  onPageChange,
}: ShipmentListProps) {
  const getStatusBadge = (status: ShipmentStatus) => {
    switch (status) {
      case "DELIVERED":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
      case "IN_TRANSIT":
      case "DISPATCHED":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
      case "ASSIGNED":
      case "READY":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
      case "FAILED":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
      case "RETURNED":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300";
      case "CANCELLED":
        return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400";
      case "CLOSED":
        return "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-500";
      default:
        return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <input
          type="text"
          placeholder="Search by shipment #, tracking #, reference..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 max-w-md"
        />

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="READY">Ready</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="DISPATCHED">Dispatched</option>
          <option value="IN_TRANSIT">In Transit</option>
          <option value="DELIVERED">Delivered</option>
          <option value="FAILED">Failed</option>
          <option value="RETURNED">Returned</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium">
            <tr>
              <th className="px-4 py-3">Shipment #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Carrier / Tracking</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Planned / Delivery Date</th>
              <th className="px-4 py-3 text-right">Logistics Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Loading shipments...
                </td>
              </tr>
            ) : shipments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No shipments found.
                </td>
              </tr>
            ) : (
              shipments.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => onSelectShipment(s)}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition"
                >
                  <td className="px-4 py-3 font-semibold text-blue-600 dark:text-blue-400">
                    {s.shipmentNumber}
                  </td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                    {s.customer?.name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {s.carrier?.name || "Unassigned"}
                    </div>
                    {s.trackingNumber && (
                      <div className="text-xs text-zinc-400 font-mono">{s.trackingNumber}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded ${getStatusBadge(
                        s.status,
                      )}`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {s.actualDeliveryDate
                      ? `Delivered: ${new Date(s.actualDeliveryDate).toLocaleDateString()}`
                      : s.estimatedDeliveryDate
                        ? `Est: ${new Date(s.estimatedDeliveryDate).toLocaleDateString()}`
                        : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-900 dark:text-zinc-100">
                    ${Number(s.totalLogisticsCost).toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center text-xs text-zinc-500">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="px-3 py-1 rounded border border-zinc-200 dark:border-zinc-800 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="px-3 py-1 rounded border border-zinc-200 dark:border-zinc-800 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
