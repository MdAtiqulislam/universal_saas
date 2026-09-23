"use client";

import React, { useState, useEffect } from "react";
import { securityApi } from "../api/security-api";
import { SecurityDashboardSummary } from "../types/security.types";

export function SecurityDashboard() {
  const [summary, setSummary] = useState<SecurityDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await securityApi.getDashboardSummary();
      setSummary(data);
    } catch (err: any) {
      setError(err.message || "Failed to load security dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        Loading security posture & threat telemetry...
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-6 bg-red-50 text-red-700 rounded-lg border border-red-200">
        <p className="font-semibold">Security Telemetry Error</p>
        <p className="text-sm">{error || "No data returned."}</p>
        <button
          onClick={fetchSummary}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const { kpis, recentEvents } = summary;

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold uppercase text-gray-400">
            Authentication Activity (24h)
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-gray-900">{kpis.totalLoginAttempts24h}</span>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
              {kpis.authSuccessRatePercentage}% Success
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {kpis.successfulLogins24h} passed &bull; {kpis.failedLogins24h} failed
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold uppercase text-gray-400">Active Sessions</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-indigo-600">{kpis.activeSessionsCount}</span>
            <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
              Live Devices
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Monitored multi-tenant session tokens</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold uppercase text-gray-400">Locked Accounts</span>
          <div className="flex items-baseline justify-between mt-2">
            <span
              className={`text-2xl font-bold ${kpis.lockedAccountsCount > 0 ? "text-amber-600" : "text-gray-900"}`}
            >
              {kpis.lockedAccountsCount}
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${kpis.lockedAccountsCount > 0 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}
            >
              {kpis.lockedAccountsCount > 0 ? "Action Required" : "Healthy"}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Brute-force lockout enforcement</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold uppercase text-gray-400">
            High / Critical Alerts (24h)
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span
              className={`text-2xl font-bold ${kpis.highCriticalIncidents24h > 0 ? "text-rose-600" : "text-emerald-600"}`}
            >
              {kpis.highCriticalIncidents24h}
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${kpis.highCriticalIncidents24h > 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}
            >
              {kpis.highCriticalIncidents24h > 0 ? "Elevated Risk" : "Zero Incidents"}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {kpis.rateLimitViolations24h} rate limit threshold hits
          </p>
        </div>
      </div>

      {/* Recent Security Events Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <h3 className="font-semibold text-gray-900">Recent Security Audit Events</h3>
            <p className="text-xs text-gray-500">
              Append-only audit trail of tenant authentication, authorization, and threat activities
            </p>
          </div>
          <button
            onClick={fetchSummary}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 text-gray-600 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">
                    No security events recorded in the current timeframe.
                  </td>
                </tr>
              ) : (
                recentEvents.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-500">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          e.severity === "CRITICAL"
                            ? "bg-rose-100 text-rose-800"
                            : e.severity === "HIGH"
                              ? "bg-orange-100 text-orange-800"
                              : e.severity === "MEDIUM"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {e.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-700">{e.category}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{e.eventType}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {e.actorUser?.email || "Anonymous / System"}
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-mono">
                      {e.ipAddress || "&mdash;"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
