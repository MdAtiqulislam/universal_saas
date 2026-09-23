"use client";
import React, { useState } from "react";
import { SystemHealthPanel } from "./SystemHealthPanel";
import { ApiPerformancePanel } from "./ApiPerformancePanel";
import { ErrorRatePanel } from "./ErrorRatePanel";
import { DatabaseHealthPanel } from "./DatabaseHealthPanel";
import { BackgroundJobsPanel } from "./BackgroundJobsPanel";
import { CacheMetricsPanel } from "./CacheMetricsPanel";
import { SecurityTelemetryPanel } from "./SecurityTelemetryPanel";
import { IncidentList } from "./IncidentList";
import { IncidentDetail } from "./IncidentDetail";
import { AlertRulesPanel } from "./AlertRulesPanel";
import { SloDashboard } from "./SloDashboard";

// Mock hook
function useOperationsData() {
  return {
    kpis: {
      apiAvailability: 99.99,
      requestRate: 1542,
      errorRate: 0.01,
      p95Latency: 230,
      dbStatus: "UP" as const,
      cacheStatus: "UP" as const,
      pendingJobs: 42,
      failedJobs: 0,
      openIncidents: 1,
      triggeredAlerts: 2,
      criticalSecurityEvents: 0,
    },
    systemHealth: {
      database: "UP" as const,
      cache: "UP" as const,
      jobs: "UP" as const,
      overall: "UP" as const,
    },
    apiPerformance: {
      p50: 45,
      p95: 230,
      p99: 450,
      requestRate: 1542,
      errorRate: 0.01,
      slowRequestRate: 0.5,
    },
    errorRate: { errorRate: 0.01, totalErrors: 154, criticalErrors: 2, recentErrors: [] },
    database: { status: "UP" as const, latencyMs: 15, slowQueryCount: 5, connectionErrors: 0 },
    backgroundJobs: {
      queued: 42,
      processing: 12,
      completed: 15420,
      failed: 0,
      retryCount: 3,
      avgDurationMs: 450,
    },
    cacheMetrics: { hitRate: 95.5, missRate: 4.5, size: 1024, invalidations: 50 },
    securityTelemetry: {
      criticalEvents: 0,
      failedLogins: 45,
      lockouts: 2,
      rateLimitViolations: 15,
      suspiciousActivity: 1,
    },
    incidents: [],
    alertRules: [],
    activeAlerts: [],
    slos: [],
  };
}

export function OperationsDashboard() {
  const data = useOperationsData();
  const [activeTab, setActiveTab] = useState("Overview");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const tabs = ["Overview", "Incidents", "Alerts", "SLOs"];

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold uppercase text-gray-400">API Availability</span>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            {data.kpis.apiAvailability}%
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold uppercase text-gray-400">Error Rate</span>
          <div className="text-2xl font-bold text-gray-900 mt-2">{data.kpis.errorRate}%</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold uppercase text-gray-400">P95 Latency</span>
          <div className="text-2xl font-bold text-gray-900 mt-2">{data.kpis.p95Latency}ms</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold uppercase text-gray-400">Open Incidents</span>
          <div className="text-2xl font-bold text-rose-600 mt-2">{data.kpis.openIncidents}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === "Overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SystemHealthPanel {...data.systemHealth} />
            <ApiPerformancePanel {...data.apiPerformance} />
            <ErrorRatePanel {...data.errorRate} />
            <DatabaseHealthPanel {...data.database} />
            <BackgroundJobsPanel {...data.backgroundJobs} />
            <CacheMetricsPanel {...data.cacheMetrics} />
            <SecurityTelemetryPanel {...data.securityTelemetry} />
          </div>
        )}

        {activeTab === "Incidents" && (
          <div>
            <IncidentList incidents={data.incidents} onSelect={setSelectedIncidentId} />
            {selectedIncidentId && (
              <IncidentDetail incident={null} onClose={() => setSelectedIncidentId(null)} />
            )}
          </div>
        )}

        {activeTab === "Alerts" && (
          <AlertRulesPanel rules={data.alertRules} activeAlerts={data.activeAlerts} />
        )}

        {activeTab === "SLOs" && <SloDashboard slos={data.slos} />}
      </div>
    </div>
  );
}
