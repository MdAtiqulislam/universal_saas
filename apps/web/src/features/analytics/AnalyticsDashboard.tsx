import React, { useState, useEffect } from "react";
import {
  AnalyticsDefinition,
  SavedReport,
  ReportSchedule,
  Dashboard,
  AnalyticsQuery,
  AnalyticsQueryResult,
} from "./types";
import { analyticsApi } from "./api/analytics-api";
import { AnalyticsExplorer } from "./components/AnalyticsExplorer";
import { SavedReportsPanel } from "./components/SavedReportsPanel";
import { ReportSchedulePanel } from "./components/ReportSchedulePanel";
import { DashboardGrid } from "./components/DashboardGrid";
import { AnalyticsUsagePanel } from "./components/AnalyticsUsagePanel";

export const AnalyticsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"explorer" | "reports" | "dashboards" | "telemetry">(
    "explorer",
  );
  const [definitions, setDefinitions] = useState<AnalyticsDefinition[]>([]);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [defsData, reportsData, schedulesData, dashboardsData] = await Promise.all([
        analyticsApi.listDefinitions().catch(() => []),
        analyticsApi
          .listSavedReports()
          .then((r) => r.reports)
          .catch(() => []),
        analyticsApi.listSchedules().catch(() => []),
        analyticsApi
          .listDashboards()
          .then((d) => d.dashboards)
          .catch(() => []),
      ]);
      setDefinitions(defsData);
      setReports(reportsData);
      setSchedules(schedulesData);
      setDashboards(dashboardsData);
      if (dashboardsData.length > 0) {
        setCurrentDashboard(dashboardsData[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleExecuteQuery = async (query: AnalyticsQuery): Promise<AnalyticsQueryResult> => {
    return analyticsApi.executeQuery(query);
  };

  const handleExportQuery = async (query: AnalyticsQuery, format: "CSV" | "JSON") => {
    const blob = await analyticsApi.exportQuery(query, format);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics_export_${Date.now()}.${format.toLowerCase()}`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSaveReport = async (query: AnalyticsQuery, name: string) => {
    await analyticsApi.createSavedReport({
      definitionKey: query.definitionKey,
      name,
      dimensions: query.dimensions,
      measures: query.measures,
      filterAst: query.filterAst,
      timeDimension: query.timeDimension,
      timeGranularity: query.timeGranularity,
    });
    const updated = await analyticsApi.listSavedReports();
    setReports(updated.reports);
  };

  const handleDeleteReport = async (id: string) => {
    await analyticsApi.deleteSavedReport(id);
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  const handleCreateSchedule = async (
    savedReportId: string,
    frequency: "DAILY" | "WEEKLY" | "MONTHLY",
  ) => {
    await analyticsApi.createSchedule({ savedReportId, frequency });
    const updated = await analyticsApi.listSchedules();
    setSchedules(updated);
  };

  const handleDeleteSchedule = async (id: string) => {
    await analyticsApi.deleteSchedule(id);
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            Analytics & Business Intelligence
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Enterprise multi-tenant query engine, saved reports, automated schedules, and dashboards
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-gray-100 p-1 rounded-lg text-xs font-medium text-gray-600">
          <button
            type="button"
            onClick={() => setActiveTab("explorer")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === "explorer" ? "bg-white text-gray-900 shadow-sm" : "hover:text-gray-900"
            }`}
          >
            Query Explorer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("reports")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === "reports" ? "bg-white text-gray-900 shadow-sm" : "hover:text-gray-900"
            }`}
          >
            Saved Reports ({reports.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dashboards")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === "dashboards"
                ? "bg-white text-gray-900 shadow-sm"
                : "hover:text-gray-900"
            }`}
          >
            Dashboards ({dashboards.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("telemetry")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === "telemetry" ? "bg-white text-gray-900 shadow-sm" : "hover:text-gray-900"
            }`}
          >
            Telemetry & Audit
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-xs text-gray-500 mt-3">
            Loading analytics definitions and resources...
          </p>
        </div>
      ) : (
        <>
          {activeTab === "explorer" && (
            <AnalyticsExplorer
              definitions={definitions}
              onExecuteQuery={handleExecuteQuery}
              onExportQuery={handleExportQuery}
              onSaveReport={handleSaveReport}
            />
          )}

          {activeTab === "reports" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SavedReportsPanel
                reports={reports}
                onSelectReport={() => setActiveTab("explorer")}
                onDeleteReport={handleDeleteReport}
              />
              <ReportSchedulePanel
                schedules={schedules}
                reports={reports}
                onCreateSchedule={handleCreateSchedule}
                onDeleteSchedule={handleDeleteSchedule}
              />
            </div>
          )}

          {activeTab === "dashboards" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-900">
                  {currentDashboard?.name || "Default Dashboard"}
                </h3>
                <span className="text-xs text-gray-500">
                  Visibility: {currentDashboard?.visibility || "PRIVATE"}
                </span>
              </div>
              <DashboardGrid widgets={currentDashboard?.widgets || []} />
            </div>
          )}

          {activeTab === "telemetry" && <AnalyticsUsagePanel />}
        </>
      )}
    </div>
  );
};
