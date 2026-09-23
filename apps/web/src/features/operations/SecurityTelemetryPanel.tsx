import React from "react";

export function SecurityTelemetryPanel({
  criticalEvents,
  failedLogins,
  lockouts,
  rateLimitViolations,
  suspiciousActivity,
}: {
  criticalEvents: number;
  failedLogins: number;
  lockouts: number;
  rateLimitViolations: number;
  suspiciousActivity: number;
}) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-4">Security Telemetry</h3>
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Critical Events</span>
          <span className={`font-bold ${criticalEvents > 0 ? "text-rose-600" : "text-gray-900"}`}>
            {criticalEvents}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Failed Logins</span>
          <span className="font-medium">{failedLogins}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Lockouts</span>
          <span className="font-medium">{lockouts}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Rate Limit Violations</span>
          <span className="font-medium">{rateLimitViolations}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Suspicious Activity</span>
          <span className="font-medium">{suspiciousActivity}</span>
        </div>
      </div>
    </div>
  );
}
