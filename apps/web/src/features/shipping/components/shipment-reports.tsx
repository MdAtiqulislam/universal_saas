"use client";

import React, { useState, useEffect } from "react";
import { shippingApi } from "../api/shipping-api";

interface PerformanceData {
  totalDelivered: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  onTimeRate: number;
  avgDeliveryDays: number;
  shipments: Array<{
    id: string;
    shipmentNumber: string;
    customerName: string;
    carrierName: string | null;
    daysInTransit: number | null;
    isOnTime: boolean | null;
  }>;
}

interface CarrierReportData {
  carrierId: string;
  carrierCode: string;
  carrierName: string;
  carrierType: string;
  totalShipments: number;
  deliveredCount: number;
  failedCount: number;
  returnedCount: number;
  onTimeRate: number;
  totalCost: string;
}

export function ShipmentReports() {
  const [activeTab, setActiveTab] = useState<"performance" | "carriers">("performance");
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [carrierData, setCarrierData] = useState<CarrierReportData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (activeTab === "performance") {
      shippingApi
        .getPerformanceReport()
        .then((data) => {
          if (isMounted) {
            setPerformanceData(data);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error("Failed to load performance report", err);
          if (isMounted) setLoading(false);
        });
    } else {
      shippingApi
        .getCarrierPerformance()
        .then((data) => {
          if (isMounted) {
            setCarrierData(data);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error("Failed to load carrier metrics", err);
          if (isMounted) setLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setActiveTab("performance");
          }}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
            activeTab === "performance"
              ? "bg-blue-600 text-white"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          Delivery Performance
        </button>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setActiveTab("carriers");
          }}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
            activeTab === "carriers"
              ? "bg-blue-600 text-white"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          Carrier Metrics
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-zinc-500">Loading report metrics...</div>
      ) : activeTab === "performance" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white dark:bg-zinc-900 border rounded-xl">
              <p className="text-xs text-zinc-500">Total Delivered Shipments</p>
              <p className="text-2xl font-bold mt-1">{performanceData?.totalDelivered || 0}</p>
            </div>
            <div className="p-4 bg-white dark:bg-zinc-900 border rounded-xl">
              <p className="text-xs text-zinc-500">On-Time Delivery Rate</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600">
                {performanceData?.onTimeRate || 100}%
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-zinc-900 border rounded-xl">
              <p className="text-xs text-zinc-500">Average Transit Duration</p>
              <p className="text-2xl font-bold mt-1">
                {performanceData?.avgDeliveryDays || 0} days
              </p>
            </div>
          </div>

          <div className="overflow-x-auto bg-white dark:bg-zinc-900 border rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Shipment #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Carrier</th>
                  <th className="px-4 py-3">Days in Transit</th>
                  <th className="px-4 py-3 text-right">On-Time?</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {performanceData?.shipments?.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-semibold text-blue-600">{s.shipmentNumber}</td>
                    <td className="px-4 py-3">{s.customerName}</td>
                    <td className="px-4 py-3">{s.carrierName || "—"}</td>
                    <td className="px-4 py-3">
                      {s.daysInTransit !== null ? `${s.daysInTransit} d` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.isOnTime === true ? (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">
                          On-Time
                        </span>
                      ) : s.isOnTime === false ? (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-rose-100 text-rose-800">
                          Late
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-zinc-900 border rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-3">Carrier</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Total Shipments</th>
                <th className="px-4 py-3">Delivered</th>
                <th className="px-4 py-3">Failed / Returned</th>
                <th className="px-4 py-3">On-Time %</th>
                <th className="px-4 py-3 text-right">Total Freight ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {carrierData.map((c) => (
                <tr key={c.carrierId}>
                  <td className="px-4 py-3 font-semibold">
                    {c.carrierName} ({c.carrierCode})
                  </td>
                  <td className="px-4 py-3 text-xs">{c.carrierType}</td>
                  <td className="px-4 py-3">{c.totalShipments}</td>
                  <td className="px-4 py-3 text-emerald-600 font-medium">{c.deliveredCount}</td>
                  <td className="px-4 py-3 text-rose-600 font-medium">
                    {c.failedCount + c.returnedCount}
                  </td>
                  <td className="px-4 py-3 font-semibold">{c.onTimeRate}%</td>
                  <td className="px-4 py-3 text-right font-medium">
                    ${Number(c.totalCost).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
