"use client";

import React, { useState, useEffect } from "react";
import { WorkflowOverviewReport } from "./types";
import {
  getOverviewReport,
  getSuccessFailureReport,
  getPerformanceReport,
} from "./api/workflows-api";

interface SuccessFailureReport {
  breakdown?: {
    completed?: number;
    failed?: number;
    waiting?: number;
    running?: number;
    cancelled?: number;
  };
}

interface PerformanceReport {
  p50DurationMs?: number;
  p95DurationMs?: number;
  p99DurationMs?: number;
  avgDurationMs?: number;
  sampleCount?: number;
}

export const WorkflowReportsPanel: React.FC = () => {
  const [overview, setOverview] = useState<WorkflowOverviewReport | null>(null);
  const [successReport, setSuccessReport] = useState<SuccessFailureReport | null>(null);
  const [perfReport, setPerfReport] = useState<PerformanceReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      getOverviewReport({ days }),
      getSuccessFailureReport({ days }),
      getPerformanceReport({ days }),
    ])
      .then(([ov, sf, pf]) => {
        if (!ignore) {
          setOverview(ov);
          setSuccessReport(sf as SuccessFailureReport);
          setPerfReport(pf as PerformanceReport);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          console.error("Failed to load reports:", err);
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [days]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Workflow Telemetry & Operations Reports
          </h3>
          <p className="text-xs text-gray-500">
            Tenant execution metrics, SLA compliance, and failure telemetry
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-xs text-gray-500">Time Range:</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded border border-gray-300 p-1.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-gray-500">
          Loading operational reports...
        </div>
      ) : (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <span className="text-xs font-semibold text-gray-500">Definitions</span>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {overview?.totalDefinitions || 0}
              </div>
              <span className="text-[11px] text-green-600">
                {overview?.activeDefinitions || 0} active
              </span>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <span className="text-xs font-semibold text-gray-500">Total Executions</span>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {overview?.totalExecutions || 0}
              </div>
              <span className="text-[11px] text-gray-400">in period</span>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <span className="text-xs font-semibold text-gray-500">Success Rate</span>
              <div className="mt-1 text-2xl font-bold text-green-600">
                {overview?.successRate ?? 100}%
              </div>
              <span className="text-[11px] text-gray-400">
                {overview?.completedExecutions || 0} passed
              </span>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <span className="text-xs font-semibold text-gray-500">Failures</span>
              <div className="mt-1 text-2xl font-bold text-red-600">
                {overview?.failedExecutions || 0}
              </div>
              <span className="text-[11px] text-gray-400">interventions</span>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <span className="text-xs font-semibold text-gray-500">Pending Approvals</span>
              <div className="mt-1 text-2xl font-bold text-purple-600">
                {overview?.pendingApprovals || 0}
              </div>
              <span className="text-[11px] text-gray-400">in queue</span>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <span className="text-xs font-semibold text-gray-500">Active Schedules</span>
              <div className="mt-1 text-2xl font-bold text-blue-600">
                {overview?.activeSchedules || 0}
              </div>
              <span className="text-[11px] text-gray-400">recurring jobs</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Status Breakdown */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h4 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
                Execution Status Distribution
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">COMPLETED</span>
                  <span className="font-semibold text-green-600">
                    {successReport?.breakdown?.completed || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">FAILED</span>
                  <span className="font-semibold text-red-600">
                    {successReport?.breakdown?.failed || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">WAITING (APPROVAL)</span>
                  <span className="font-semibold text-purple-600">
                    {successReport?.breakdown?.waiting || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">RUNNING</span>
                  <span className="font-semibold text-blue-600">
                    {successReport?.breakdown?.running || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">CANCELLED</span>
                  <span className="font-semibold text-gray-500">
                    {successReport?.breakdown?.cancelled || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Performance Percentiles */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h4 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
                Execution Duration Latency
              </h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded bg-gray-50 p-3 dark:bg-gray-900">
                  <div className="text-xs text-gray-500">P50 (Median)</div>
                  <div className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
                    {perfReport?.p50DurationMs || 0}ms
                  </div>
                </div>
                <div className="rounded bg-gray-50 p-3 dark:bg-gray-900">
                  <div className="text-xs text-gray-500">P95 Latency</div>
                  <div className="mt-1 text-lg font-bold text-amber-600">
                    {perfReport?.p95DurationMs || 0}ms
                  </div>
                </div>
                <div className="rounded bg-gray-50 p-3 dark:bg-gray-900">
                  <div className="text-xs text-gray-500">P99 Latency</div>
                  <div className="mt-1 text-lg font-bold text-red-600">
                    {perfReport?.p99DurationMs || 0}ms
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t pt-3 text-xs text-gray-500 dark:border-gray-700 flex justify-between">
                <span>Average: {perfReport?.avgDurationMs || 0}ms</span>
                <span>Sample Count: {perfReport?.sampleCount || 0} executions</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
