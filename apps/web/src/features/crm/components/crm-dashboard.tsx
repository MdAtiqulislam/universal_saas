"use client";

import React, { useEffect, useState } from "react";
import { crmApi } from "../api/crm-api";
import { PipelineSummary, StageBreakdownItem } from "../types/crm.types";

export const CrmDashboard: React.FC = () => {
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [stages, setStages] = useState<StageBreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumData, stageData] = await Promise.all([
        crmApi.getPipelineSummary(),
        crmApi.getPipelineStages(),
      ]);
      setSummary(sumData);
      setStages(stageData);
    } catch (err: any) {
      setError(err.message || "Failed to load CRM dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Loading commercial pipeline telemetry...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-red-600 bg-red-50 rounded-md">
        <p className="font-semibold">Error Loading CRM Telemetry</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={loadDashboardData}
          className="mt-3 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const p = summary?.pipeline;
  const l = summary?.leads;
  const q = summary?.quotations;

  return (
    <div className="space-y-6">
      {/* KPI Cards Row 1: Pipeline & Deals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500">Active Pipeline Value</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            ${p?.totalOpenValue.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00"}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {p?.totalOpenOpportunities ?? 0} open deals across stages
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500">Weighted Forecast</div>
          <div className="text-2xl font-bold text-indigo-600 mt-2">
            $
            {p?.weightedPipelineValue.toLocaleString(undefined, { minimumFractionDigits: 2 }) ??
              "0.00"}
          </div>
          <div className="text-xs text-gray-500 mt-1">Probability-adjusted revenue</div>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500">Win Rate</div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            {p?.winRatePercentage ?? 0}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {p?.wonOpportunities ?? 0} won / {p?.lostOpportunities ?? 0} lost
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500">Average Sales Cycle</div>
          <div className="text-2xl font-bold text-amber-600 mt-2">
            {p?.averageSalesCycleDays ?? 0} <span className="text-base font-normal">days</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">Lead/Opp to closed won</div>
        </div>
      </div>

      {/* KPI Cards Row 2: Funnel Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Leads Summary */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 text-base mb-3">Leads & Prospects</h3>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-xl font-bold text-blue-700">{l?.new ?? 0}</div>
              <div className="text-xs text-blue-600 font-medium">New</div>
            </div>
            <div className="bg-purple-50 p-3 rounded">
              <div className="text-xl font-bold text-purple-700">{l?.qualified ?? 0}</div>
              <div className="text-xs text-purple-600 font-medium">Qualified</div>
            </div>
            <div className="bg-emerald-50 p-3 rounded">
              <div className="text-xl font-bold text-emerald-700">{l?.converted ?? 0}</div>
              <div className="text-xs text-emerald-600 font-medium">Converted</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-xl font-bold text-gray-700">{l?.total ?? 0}</div>
              <div className="text-xs text-gray-500 font-medium">Total Leads</div>
            </div>
          </div>
        </div>

        {/* Quotation Pipeline */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 text-base mb-3">Quotations & Proposals</h3>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-amber-50 p-3 rounded">
              <div className="text-xl font-bold text-amber-700">{q?.draft ?? 0}</div>
              <div className="text-xs text-amber-600 font-medium">Draft/Sent</div>
            </div>
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-xl font-bold text-blue-700">{q?.approved ?? 0}</div>
              <div className="text-xs text-blue-600 font-medium">Approved</div>
            </div>
            <div className="bg-teal-50 p-3 rounded">
              <div className="text-xl font-bold text-teal-700">{q?.accepted ?? 0}</div>
              <div className="text-xs text-teal-600 font-medium">Accepted</div>
            </div>
            <div className="bg-emerald-50 p-3 rounded">
              <div className="text-xl font-bold text-emerald-700">{q?.converted ?? 0}</div>
              <div className="text-xs text-emerald-600 font-medium">M28 Orders</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stage Breakdown Matrix */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 text-base mb-4">Pipeline Stage Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-3 font-medium">Stage</th>
                <th className="pb-3 font-medium text-center">Deals</th>
                <th className="pb-3 font-medium text-right">Total Pipeline Value</th>
                <th className="pb-3 font-medium text-right">Weighted Forecast</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stages.map((st) => (
                <tr key={st.stage} className="hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-800">{st.stage.replace("_", " ")}</td>
                  <td className="py-3 text-center">{st.count}</td>
                  <td className="py-3 text-right font-semibold">
                    ${st.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 text-right text-indigo-600 font-semibold">
                    ${st.weightedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
