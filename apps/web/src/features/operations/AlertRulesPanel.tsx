import React from "react";

export type AlertRule = {
  id: string;
  name: string;
  metricKey: string;
  threshold: number;
  severity: "INFO" | "WARNING" | "CRITICAL";
  status: "ACTIVE" | "INACTIVE";
};
export type AlertEvent = {
  id: string;
  alertRuleId: string;
  status: "TRIGGERED" | "ACKNOWLEDGED" | "RESOLVED";
  triggeredAt: string;
  triggeredValue: number;
};

export function AlertRulesPanel({
  rules,
  activeAlerts,
}: {
  rules: AlertRule[];
  activeAlerts: AlertEvent[];
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4">Active Alerts</h3>
        {activeAlerts.length === 0 ? (
          <p className="text-sm text-gray-500">No active alerts.</p>
        ) : (
          <ul className="space-y-2">
            {activeAlerts.map((alert) => (
              <li
                key={alert.id}
                className="p-3 bg-rose-50 border border-rose-100 rounded text-sm text-rose-800"
              >
                Rule ID {alert.alertRuleId} triggered at{" "}
                {new Date(alert.triggeredAt).toLocaleString()} with value {alert.triggeredValue}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Alert Rules</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-2 px-4">Name</th>
              <th className="py-2 px-4">Metric</th>
              <th className="py-2 px-4">Threshold</th>
              <th className="py-2 px-4">Severity</th>
              <th className="py-2 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-t border-gray-100">
                <td className="py-2 px-4">{rule.name}</td>
                <td className="py-2 px-4 text-gray-500">{rule.metricKey}</td>
                <td className="py-2 px-4">{rule.threshold}</td>
                <td className="py-2 px-4">{rule.severity}</td>
                <td className="py-2 px-4">{rule.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
