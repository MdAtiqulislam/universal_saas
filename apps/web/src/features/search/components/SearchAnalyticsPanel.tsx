"use client";

import React from "react";
import { SearchAnalyticsSummary } from "../types";

interface SearchAnalyticsPanelProps {
  analytics: SearchAnalyticsSummary;
}

export const SearchAnalyticsPanel: React.FC<SearchAnalyticsPanelProps> = ({ analytics }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Search Analytics</h3>
        <p className="text-xs text-gray-500">
          Telemetry on user discovery patterns, response times, and zero-result queries
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="text-xs font-medium text-gray-500">Searches Today</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {analytics.totalSearchesToday.toLocaleString()}
          </div>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="text-xs font-medium text-gray-500">Avg Execution Time</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{analytics.avgDurationMs} ms</div>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="text-xs font-medium text-gray-500">Distinct Scopes Used</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {Object.keys(analytics.searchesByScope).length}
          </div>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="text-xs font-medium text-gray-500">Zero-Result Queries</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {analytics.zeroResultQueries.length}
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Queries */}
        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm space-y-3">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Most Popular Queries
          </h4>
          <div className="divide-y divide-gray-100 text-xs">
            {analytics.topQueries.map((q, idx) => (
              <div key={idx} className="py-2 flex items-center justify-between">
                <span className="text-gray-800 font-medium">{q.query}</span>
                <span className="text-gray-500">{q.count} searches</span>
              </div>
            ))}
          </div>
        </div>

        {/* Zero Results Queries */}
        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm space-y-3">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Zero-Result Queries (Discovery Gaps)
          </h4>
          <div className="divide-y divide-gray-100 text-xs">
            {analytics.zeroResultQueries.map((zq, idx) => (
              <div key={idx} className="py-2 flex items-center justify-between">
                <span className="text-gray-800 font-medium">{zq.query}</span>
                <span className="text-amber-600 font-medium">{zq.count} missed</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
