"use client";

import React, { useEffect, useState } from "react";
import { serviceApi } from "../api/service-api";
import { WarrantyPolicy } from "../types/service.types";

export function ServiceWarrantyPanel() {
  const [policies, setPolicies] = useState<WarrantyPolicy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      const data = await serviceApi.listWarrantyPolicies();
      setPolicies(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-slate-900">Warranty Policy Configuration</h3>
          <p className="text-xs text-slate-500">
            Coverage policies, duration, labor/parts eligibility & terms
          </p>
        </div>
        <button
          onClick={loadPolicies}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          Refresh
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">
            Loading warranty policies...
          </div>
        ) : policies.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">
            No warranty policies configured.
          </div>
        ) : (
          policies.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                    {p.code}
                  </span>
                  <h4 className="mt-2 text-sm font-bold text-slate-900">{p.name}</h4>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    p.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {p.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex justify-between">
                  <span>Duration:</span>
                  <span className="font-semibold text-slate-800">{p.durationMonths} Months</span>
                </div>
                <div className="flex justify-between">
                  <span>Coverage Type:</span>
                  <span className="font-semibold text-slate-800">{p.coverageType}</span>
                </div>
                <div className="flex justify-between">
                  <span>Parts Covered:</span>
                  <span
                    className={p.partsCovered ? "font-bold text-emerald-600" : "text-slate-400"}
                  >
                    {p.partsCovered ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Labor Covered:</span>
                  <span
                    className={p.laborCovered ? "font-bold text-emerald-600" : "text-slate-400"}
                  >
                    {p.laborCovered ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Quality Pass Req:</span>
                  <span
                    className={
                      p.inspectionRequired ? "font-bold text-indigo-600" : "text-slate-400"
                    }
                  >
                    {p.inspectionRequired ? "Required" : "Optional"}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
