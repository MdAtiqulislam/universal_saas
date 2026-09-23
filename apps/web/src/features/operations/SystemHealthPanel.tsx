import React from "react";

type HealthStatus = "UP" | "DEGRADED" | "DOWN" | "UNKNOWN";

export function SystemHealthPanel({
  database,
  cache,
  jobs,
  overall,
}: {
  database: HealthStatus;
  cache: HealthStatus;
  jobs: HealthStatus;
  overall: HealthStatus;
}) {
  const getBadgeColor = (status: HealthStatus) => {
    switch (status) {
      case "UP":
        return "bg-emerald-100 text-emerald-800";
      case "DEGRADED":
        return "bg-amber-100 text-amber-800";
      case "DOWN":
        return "bg-rose-100 text-rose-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-4">System Health</h3>
      <div className="space-y-3">
        {[
          { label: "Overall", status: overall },
          { label: "Database", status: database },
          { label: "Cache", status: cache },
          { label: "Background Jobs", status: jobs },
        ].map((item) => (
          <div key={item.label} className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">{item.label}</span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-semibold ${getBadgeColor(item.status)}`}
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
