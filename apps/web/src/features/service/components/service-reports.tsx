"use client";

import React, { useEffect, useState } from "react";
import { serviceApi } from "../api/service-api";

export function ServiceReports() {
  const [activeReport, setActiveReport] = useState<
    "sla" | "techs" | "warranty" | "profit" | "parts"
  >("sla");
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [activeReport]);

  const loadReport = async () => {
    try {
      setLoading(true);
      if (activeReport === "sla") {
        const data = await serviceApi.getSlaReport();
        setReportData(data);
      } else if (activeReport === "techs") {
        const data = await serviceApi.getTechniciansReport();
        setReportData(data);
      } else if (activeReport === "warranty") {
        const data = await serviceApi.getWarrantyCostReport();
        setReportData(data);
      } else if (activeReport === "profit") {
        const data = await serviceApi.getProfitabilityReport();
        setReportData(data);
      } else if (activeReport === "parts") {
        const data = await serviceApi.getPartsConsumptionReport();
        setReportData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: "sla", label: "SLA Compliance" },
          { id: "techs", label: "Technician Performance" },
          { id: "warranty", label: "Warranty Costs" },
          { id: "profit", label: "Service Profitability" },
          { id: "parts", label: "Parts Consumption" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as any)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              activeReport === tab.id
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading report metrics...</div>
        ) : (
          <div className="space-y-6">
            {activeReport === "sla" && reportData && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">
                      SLA Compliance
                    </span>
                    <p className="mt-1 text-2xl font-extrabold text-emerald-600">
                      {reportData.slaComplianceRate}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">
                      Avg Resolution Time
                    </span>
                    <p className="mt-1 text-2xl font-extrabold text-indigo-600">
                      {reportData.averageResolutionHours} Hours
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">
                      Breached Tickets
                    </span>
                    <p className="mt-1 text-2xl font-extrabold text-rose-600">
                      {reportData.breached}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeReport === "warranty" && reportData && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">
                    Warranty Claims
                  </span>
                  <p className="mt-1 text-2xl font-extrabold text-slate-900">
                    {reportData.totalWarrantyClaims}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">
                    Parts Warranty Cost
                  </span>
                  <p className="mt-1 text-2xl font-extrabold text-indigo-600">
                    ${reportData.partsWarrantyCost?.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">
                    Total Warranty Expense
                  </span>
                  <p className="mt-1 text-2xl font-extrabold text-purple-600">
                    ${reportData.totalWarrantyExpense?.toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            {activeReport === "profit" && reportData && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">
                    Service Revenue
                  </span>
                  <p className="mt-1 text-2xl font-extrabold text-emerald-600">
                    ${reportData.serviceRevenue?.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">
                    Total Service Cost
                  </span>
                  <p className="mt-1 text-2xl font-extrabold text-slate-900">
                    ${reportData.totalCost?.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">
                    Net Margin (%)
                  </span>
                  <p className="mt-1 text-2xl font-extrabold text-indigo-600">
                    {reportData.marginPercentage}%
                  </p>
                </div>
              </div>
            )}

            {activeReport === "techs" && Array.isArray(reportData) && (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-100 bg-slate-50 font-bold uppercase text-slate-500 text-[11px]">
                  <tr>
                    <th className="p-3">Technician</th>
                    <th className="p-3">Assigned Jobs</th>
                    <th className="p-3">Completed Jobs</th>
                    <th className="p-3">Billable Hours</th>
                    <th className="p-3">Actual Hours</th>
                    <th className="p-3">FTF Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.map((t: any) => (
                    <tr key={t.technicianId} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">{t.technicianName}</td>
                      <td className="p-3">{t.assignedJobs}</td>
                      <td className="p-3 font-semibold text-emerald-600">{t.completedJobs}</td>
                      <td className="p-3">{t.billableHours}h</td>
                      <td className="p-3">{t.actualHours}h</td>
                      <td className="p-3 font-bold text-indigo-600">{t.firstTimeFixRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeReport === "parts" && Array.isArray(reportData) && (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-100 bg-slate-50 font-bold uppercase text-slate-500 text-[11px]">
                  <tr>
                    <th className="p-3">Item / SKU</th>
                    <th className="p-3">Issued</th>
                    <th className="p-3">Returned</th>
                    <th className="p-3">Net Consumed</th>
                    <th className="p-3">Total Cost</th>
                    <th className="p-3">Warranty vs Chargeable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.map((p: any) => (
                    <tr key={p.itemId} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">
                        {p.name} <span className="text-[10px] text-slate-400">({p.sku})</span>
                      </td>
                      <td className="p-3">{p.quantityIssued}</td>
                      <td className="p-3 text-amber-600">{p.quantityReturned}</td>
                      <td className="p-3 font-bold text-slate-900">{p.netQuantity}</td>
                      <td className="p-3">${p.totalCost.toFixed(2)}</td>
                      <td className="p-3">
                        <span className="text-purple-600 font-semibold">
                          ${p.warrantyCost.toFixed(2)} W
                        </span>{" "}
                        /{" "}
                        <span className="text-emerald-600 font-semibold">
                          ${p.chargeableRevenue.toFixed(2)} C
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
