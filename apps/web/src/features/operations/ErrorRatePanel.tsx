import React from "react";

type ErrorEntry = {
  id: string;
  category: string;
  module: string;
  message: string;
  occurredAt: string;
  severity: string;
};

export function ErrorRatePanel({
  errorRate,
  totalErrors,
  criticalErrors,
  recentErrors,
}: {
  errorRate: number;
  totalErrors: number;
  criticalErrors: number;
  recentErrors: ErrorEntry[];
}) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-4">Error Rate</h3>
      <div className="flex items-center space-x-4 mb-4">
        <div className="text-3xl font-bold text-gray-900">{errorRate}%</div>
        <div className="text-sm text-gray-500">
          <div>{totalErrors} total errors</div>
          <div className="text-rose-600">{criticalErrors} critical</div>
        </div>
      </div>
      <div className="space-y-2">
        {recentErrors.length === 0 && <p className="text-sm text-gray-500">No recent errors</p>}
        {recentErrors.map((err) => (
          <div key={err.id} className="text-xs p-2 bg-gray-50 rounded border border-gray-100">
            <span className="font-semibold">{err.category}</span> - {err.message}
          </div>
        ))}
      </div>
    </div>
  );
}
