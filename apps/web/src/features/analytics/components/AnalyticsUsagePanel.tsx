import React, { useEffect, useState } from "react";
import { analyticsApi } from "../api/analytics-api";

export const AnalyticsUsagePanel: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi
      .getOperationalReport("overview")
      .then((data) => setOverview(data))
      .catch(() => setOverview(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-xs text-gray-400 py-4">Loading operational telemetry...</div>;
  }

  if (!overview) {
    return <div className="text-xs text-gray-400 py-4">Telemetry unavailable</div>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="border-b border-gray-200 pb-2">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
          Platform Analytics Telemetry
        </h4>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="bg-gray-50 p-2.5 rounded-md border border-gray-100">
          <div className="text-lg font-bold text-gray-900 font-mono">{overview.totalReports}</div>
          <div className="text-[11px] text-gray-500">Saved Reports</div>
        </div>
        <div className="bg-gray-50 p-2.5 rounded-md border border-gray-100">
          <div className="text-lg font-bold text-gray-900 font-mono">
            {overview.totalDashboards}
          </div>
          <div className="text-[11px] text-gray-500">Dashboards</div>
        </div>
        <div className="bg-gray-50 p-2.5 rounded-md border border-gray-100">
          <div className="text-lg font-bold text-gray-900 font-mono">{overview.totalSchedules}</div>
          <div className="text-[11px] text-gray-500">Active Schedules</div>
        </div>
        <div className="bg-gray-50 p-2.5 rounded-md border border-gray-100">
          <div className="text-lg font-bold text-emerald-600 font-mono">
            {overview.totalQueriesInSample}
          </div>
          <div className="text-[11px] text-gray-500">Queries in Sample</div>
        </div>
      </div>
    </div>
  );
};
