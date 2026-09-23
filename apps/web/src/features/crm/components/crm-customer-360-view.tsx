"use client";

import React, { useEffect, useState } from "react";
import { crmApi } from "../api/crm-api";

export const CrmCustomer360View: React.FC = () => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "pipeline" | "orders" | "financials" | "service" | "quality" | "timeline"
  >("pipeline");

  useEffect(() => {
    fetchContactsList();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomer360(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  const fetchContactsList = async () => {
    try {
      const res = await fetch("/api/v1/sales/customers");
      if (res.ok) {
        const custList = await res.json();
        setContacts(custList);
        if (custList.length > 0) {
          setSelectedCustomerId(custList[0].id);
        }
      }
    } catch {
      // Fallback
    }
  };

  const fetchCustomer360 = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await crmApi.getCustomer360(id);
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load Customer 360 view");
    } finally {
      setLoading(false);
    }
  };

  const c = data?.customer;
  const k = data?.kpis;

  return (
    <div className="space-y-6">
      {/* Customer Selector Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h2 className="text-base font-bold text-gray-900">Unified Customer 360 Profile</h2>
          <p className="text-xs text-gray-500">
            Authoritative cross-engine view unifying CRM, sales orders, AR billing, payments,
            shipments, service, and quality
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-600">Select Customer:</label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium max-w-xs"
          >
            {contacts.map((cust) => (
              <option key={cust.id} value={cust.id}>
                {cust.code} — {cust.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-lg">
          Loading Customer 360 telemetry...
        </div>
      ) : error ? (
        <div className="p-6 text-center text-red-600 bg-red-50 rounded-lg">{error}</div>
      ) : !data ? (
        <div className="p-6 text-center text-gray-400 bg-white rounded-lg">
          Please select a customer to view profile.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Customer Overview Profile Card */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-gray-900">{c.name}</h1>
                  <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-semibold">
                    {c.code}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-4">
                  {c.email && <span>✉️ {c.email}</span>}
                  {c.phone && <span>📞 {c.phone}</span>}
                  {c.customerGroup && <span>🏷️ Group: {c.customerGroup.name}</span>}
                </div>
              </div>
            </div>

            {/* KPI Badges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                <div className="text-xs text-emerald-800 font-medium">Lifetime Value (LTV)</div>
                <div className="text-lg font-bold text-emerald-900 mt-1">
                  $
                  {k?.lifetimeValue?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ??
                    "0.00"}
                </div>
              </div>

              <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                <div className="text-xs text-amber-800 font-medium">Outstanding AR Balance</div>
                <div className="text-lg font-bold text-amber-900 mt-1">
                  $
                  {k?.outstandingBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ??
                    "0.00"}
                </div>
              </div>

              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                <div className="text-xs text-indigo-800 font-medium">Active Pipeline Value</div>
                <div className="text-lg font-bold text-indigo-900 mt-1">
                  $
                  {k?.activePipelineValue?.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  }) ?? "0.00"}
                </div>
              </div>

              <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                <div className="text-xs text-purple-800 font-medium">Installed Assets</div>
                <div className="text-lg font-bold text-purple-900 mt-1">
                  {k?.totalInstalledAssetsCount ?? 0} units
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-200 flex gap-4 text-xs font-semibold">
            {[
              { key: "pipeline", label: "Commercial Pipeline" },
              { key: "orders", label: "Sales & Logistics" },
              { key: "financials", label: "Invoices & Payments" },
              { key: "service", label: "Service & Assets" },
              { key: "quality", label: "Returns & Quality" },
              { key: "timeline", label: "Activity Timeline" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`pb-3 px-1 border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 min-h-[300px]">
            {activeTab === "pipeline" && (
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-gray-800">
                  Opportunities ({data.opportunities.length})
                </h3>
                {data.opportunities.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">No opportunities recorded.</div>
                ) : (
                  <div className="divide-y divide-gray-100 text-xs">
                    {data.opportunities.map((opp: any) => (
                      <div key={opp.id} className="py-2.5 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-indigo-600">{opp.opportunityNumber}</span>{" "}
                          — <span className="font-medium text-gray-900">{opp.title}</span>
                          <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-[10px]">
                            {opp.stage}
                          </span>
                        </div>
                        <div className="font-bold text-gray-800">
                          ${Number(opp.estimatedValue).toFixed(2)} ({Number(opp.probability)}%)
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "orders" && (
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-gray-800">
                  M28 Sales Orders ({data.salesOrders.length})
                </h3>
                {data.salesOrders.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">No sales orders found.</div>
                ) : (
                  <div className="divide-y divide-gray-100 text-xs">
                    {data.salesOrders.map((so: any) => (
                      <div key={so.id} className="py-2.5 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-gray-800">{so.orderNumber}</span>
                          <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px]">
                            {so.status}
                          </span>
                        </div>
                        <div className="font-bold text-gray-900">
                          ${Number(so.grandTotal).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "financials" && (
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-gray-800">
                  M14 Customer Invoices ({data.invoices.length})
                </h3>
                {data.invoices.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">No invoices found.</div>
                ) : (
                  <div className="divide-y divide-gray-100 text-xs">
                    {data.invoices.map((inv: any) => (
                      <div key={inv.id} className="py-2.5 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-gray-800">{inv.invoiceNumber}</span>
                          <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-[10px]">
                            {inv.status}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900">
                            ${Number(inv.grandTotal).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-amber-600">
                            Due: ${Number(inv.amountDue).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "service" && (
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-gray-800">
                  Installed Assets & Service Orders
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded border border-gray-200">
                    <h4 className="font-bold text-xs text-gray-700 mb-2">
                      Customer Assets ({data.customerAssets.length})
                    </h4>
                    {data.customerAssets.map((asset: any) => (
                      <div
                        key={asset.id}
                        className="text-xs py-1 border-b border-gray-200 last:border-none"
                      >
                        <span className="font-semibold">{asset.assetNumber}</span> —{" "}
                        {asset.item?.name} (SN: {asset.serialNumber || "N/A"})
                      </div>
                    ))}
                  </div>
                  <div className="p-3 bg-gray-50 rounded border border-gray-200">
                    <h4 className="font-bold text-xs text-gray-700 mb-2">
                      Service Orders ({data.serviceOrders.length})
                    </h4>
                    {data.serviceOrders.map((so: any) => (
                      <div
                        key={so.id}
                        className="text-xs py-1 border-b border-gray-200 last:border-none flex justify-between"
                      >
                        <span>
                          {so.orderNumber} ({so.status})
                        </span>
                        <span className="font-semibold">
                          ${Number(so.grandTotal || 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "quality" && (
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-gray-800">Returns & Quality Incidents</h3>
                <div className="text-xs space-y-2">
                  <div>Returns (RMA): {data.returns.length} records</div>
                  <div>Reported Quality Issues: {data.qualityIssues.length} records</div>
                </div>
              </div>
            )}

            {activeTab === "timeline" && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-gray-800">
                  Touchpoint Activity Timeline
                </h3>
                {data.activities.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">No activity logged.</div>
                ) : (
                  <div className="space-y-2 text-xs">
                    {data.activities.map((act: any) => (
                      <div key={act.id} className="p-2.5 bg-gray-50 rounded border border-gray-200">
                        <div className="font-bold text-gray-800">
                          {act.type}: {act.subject}
                        </div>
                        {act.outcome && (
                          <div className="text-emerald-700 mt-1">Outcome: {act.outcome}</div>
                        )}
                        <div className="text-[10px] text-gray-400 mt-1">
                          {new Date(act.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
