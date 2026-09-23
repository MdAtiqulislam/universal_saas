"use client";

import React from "react";
import { DeveloperKpis, RateLimitVisibility } from "../types";

interface DeveloperKpiRibbonProps {
  kpis: DeveloperKpis;
  rateLimit: RateLimitVisibility;
}

export const DeveloperKpiRibbon: React.FC<DeveloperKpiRibbonProps> = ({ kpis, rateLimit }) => {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {/* 24h Requests */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <span className="text-xs font-semibold text-gray-500">24h Requests</span>
        <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
          {kpis.requests24h.toLocaleString()}
        </div>
        <span className="text-[11px] text-gray-400">
          {kpis.totalRequests.toLocaleString()} total (30d)
        </span>
      </div>

      {/* Success Rate */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <span className="text-xs font-semibold text-gray-500">Success Rate</span>
        <div className="mt-1 text-2xl font-bold text-green-600">{kpis.successRate}%</div>
        <span className="text-[11px] text-gray-400">2xx/3xx HTTP responses</span>
      </div>

      {/* Error Rate */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <span className="text-xs font-semibold text-gray-500">Error Rate</span>
        <div className="mt-1 text-2xl font-bold text-red-600">{kpis.errorRate}%</div>
        <span className="text-[11px] text-gray-400">4xx & 5xx responses</span>
      </div>

      {/* p95 Latency */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <span className="text-xs font-semibold text-gray-500">p95 Latency</span>
        <div className="mt-1 text-2xl font-bold text-amber-600">{kpis.p95Latency}ms</div>
        <span className="text-[11px] text-gray-400">Response time (p95)</span>
      </div>

      {/* Rate Limit Remaining */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <span className="text-xs font-semibold text-gray-500">Rate Limit Quota</span>
        <div className="mt-1 text-2xl font-bold text-blue-600">
          {rateLimit.remaining} / {rateLimit.limit}
        </div>
        <span className="text-[11px] text-gray-400">
          Resets in {Math.round(rateLimit.resetSeconds / 60)}m
        </span>
      </div>

      {/* Active API Keys */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <span className="text-xs font-semibold text-gray-500">Active API Keys</span>
        <div className="mt-1 text-2xl font-bold text-purple-600">{kpis.activeKeysCount}</div>
        <span className="text-[11px] text-gray-400">across {kpis.endpointCount} endpoints</span>
      </div>
    </div>
  );
};
