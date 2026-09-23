import React from "react";

export type SloEntry = {
  id: string;
  name: string;
  metricKey: string;
  targetValue: number;
  currentValue: number | null;
  status: "HEALTHY" | "AT_RISK" | "BREACHED";
  breachCount: number;
  unit: string;
};

export function SloDashboard({ slos }: { slos: SloEntry[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Service Level Objectives (SLOs)</h3>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="py-3 px-4 font-semibold text-gray-600">SLO Name</th>
            <th className="py-3 px-4 font-semibold text-gray-600">Target</th>
            <th className="py-3 px-4 font-semibold text-gray-600">Current</th>
            <th className="py-3 px-4 font-semibold text-gray-600">Status</th>
          </tr>
        </thead>
        <tbody>
          {slos.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-gray-500">
                No SLOs defined.
              </td>
            </tr>
          )}
          {slos.map((slo) => (
            <tr key={slo.id} className="border-b border-gray-100">
              <td className="py-3 px-4 font-medium">{slo.name}</td>
              <td className="py-3 px-4">
                {slo.targetValue}
                {slo.unit}
              </td>
              <td className="py-3 px-4">
                {slo.currentValue ?? "-"}
                {slo.unit}
              </td>
              <td className="py-3 px-4">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    slo.status === "HEALTHY"
                      ? "bg-emerald-100 text-emerald-800"
                      : slo.status === "AT_RISK"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {slo.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
