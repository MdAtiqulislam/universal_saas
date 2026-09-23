"use client";

import React, { useEffect, useState } from "react";
import { serviceApi } from "../api/service-api";
import { CustomerAsset } from "../types/service.types";

export function ServiceAssetList() {
  const [assets, setAssets] = useState<CustomerAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<CustomerAsset | null>(null);
  const [history, setHistory] = useState<any | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const data = await serviceApi.listCustomerAssets(search ? { search } : undefined);
      setAssets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewHistory = async (asset: CustomerAsset) => {
    setSelectedAsset(asset);
    try {
      setHistoryLoading(true);
      const data = await serviceApi.getCustomerAssetHistory(asset.id);
      setHistory(data);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by asset number, serial, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadAssets()}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <button
          onClick={loadAssets}
          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
        >
          Search Assets
        </button>
      </div>

      {/* Asset Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Asset Number</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Item & Serial</th>
                <th className="px-6 py-4">Warranty Status</th>
                <th className="px-6 py-4">Service Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading installed assets...
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No customer assets registered yet.
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4 font-semibold text-slate-900">{asset.assetNumber}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{asset.customer?.name}</div>
                      <div className="text-[10px] text-slate-400">{asset.customer?.code}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{asset.item?.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {asset.serialNumber
                          ? `S/N: ${asset.serialNumber}`
                          : `SKU: ${asset.item?.sku}`}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          asset.warrantyStatus === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : asset.warrantyStatus === "EXPIRED"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {asset.warrantyStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          asset.serviceStatus === "OPERATIONAL"
                            ? "bg-blue-100 text-blue-800"
                            : asset.serviceStatus === "UNDER_SERVICE"
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {asset.serviceStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleViewHistory(asset)}
                        className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                      >
                        Service History
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Service History Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Service History — {selectedAsset.assetNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Customer: {selectedAsset.customer?.name} | Item: {selectedAsset.item?.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedAsset(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {historyLoading ? (
              <div className="py-8 text-center text-slate-400">Loading service trajectory...</div>
            ) : history ? (
              <div className="space-y-6 text-xs">
                {/* Warranties */}
                <div>
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Warranty Contracts
                  </h4>
                  {history.warranties?.length > 0 ? (
                    <div className="space-y-2">
                      {history.warranties.map((w: any) => (
                        <div
                          key={w.id}
                          className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex justify-between items-center"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">
                              {w.warrantyPolicy?.name}
                            </span>
                            <span className="ml-2 text-slate-500">
                              ({new Date(w.startDate).toLocaleDateString()} –{" "}
                              {new Date(w.endDate).toLocaleDateString()})
                            </span>
                          </div>
                          <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">
                            {w.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400">No active warranty policies attached.</p>
                  )}
                </div>

                {/* Service Orders */}
                <div>
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Executed Service Orders
                  </h4>
                  {history.orders?.length > 0 ? (
                    <div className="space-y-2">
                      {history.orders.map((o: any) => (
                        <div
                          key={o.id}
                          className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-indigo-700">
                              {o.serviceOrderNumber}
                            </span>
                            <span className="rounded bg-slate-200 px-2 py-0.5 font-semibold text-slate-800">
                              {o.status}
                            </span>
                          </div>
                          <div className="flex gap-4 text-slate-600">
                            <span>Cost: ${Number(o.totalCost).toFixed(2)}</span>
                            <span>Customer Charge: ${Number(o.customerCharge).toFixed(2)}</span>
                            <span>Warranty Cost: ${Number(o.warrantyCost).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400">No past service orders on record.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
