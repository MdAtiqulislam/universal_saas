"use client";

import React, { useState, useEffect } from "react";
import { ApiUsageRecord } from "../types";
import { getApiUsage, exportUsageCsv } from "../api/developer-api";

export const ApiUsagePanel: React.FC = () => {
  const [records, setRecords] = useState<ApiUsageRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [routeFilter, setRouteFilter] = useState("");
  const [responseClassFilter, setResponseClassFilter] = useState("");
  const [daysFilter, setDaysFilter] = useState(30);
  const [reloadKey, setReloadKey] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let ignore = false;
    getApiUsage({
      page,
      limit: 15,
      route: routeFilter || undefined,
      responseClass: responseClassFilter || undefined,
      days: daysFilter,
    })
      .then((res) => {
        if (!ignore) {
          setRecords(res.records);
          setTotalPages(res.totalPages);
          setTotalCount(res.total);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          console.error("Failed to load usage records:", err);
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [page, routeFilter, responseClassFilter, daysFilter, reloadKey]);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const res = await exportUsageCsv({
        days: daysFilter,
        route: routeFilter || undefined,
      });

      // Trigger browser download
      const blob = new Blob([res.csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", res.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Export failed: ${msg}`);
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadgeClass = (status: number) => {
    if (status >= 200 && status < 300) {
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    }
    if (status >= 400 && status < 500) {
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    }
    if (status >= 500) {
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    }
    return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  };

  return (
    <div className="space-y-4">
      {/* Filter and Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Filter by route..."
            value={routeFilter}
            onChange={(e) => {
              setRouteFilter(e.target.value);
              setPage(1);
            }}
            className="rounded border border-gray-300 p-1.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          />

          <select
            value={responseClassFilter}
            onChange={(e) => {
              setResponseClassFilter(e.target.value);
              setPage(1);
            }}
            className="rounded border border-gray-300 p-1.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">All Statuses</option>
            <option value="2xx">2xx Success</option>
            <option value="4xx">4xx Client Error</option>
            <option value="5xx">5xx Server Error</option>
          </select>

          <select
            value={daysFilter}
            onChange={(e) => {
              setDaysFilter(Number(e.target.value));
              setPage(1);
            }}
            className="rounded border border-gray-300 p-1.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>

          <span className="text-xs text-gray-500">{totalCount} total requests</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setReloadKey((k) => k + 1);
            }}
            className="rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
          >
            Refresh
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExport}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>

      {/* Usage Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 text-left text-xs dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">
                Timestamp
              </th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Method</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Route</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Duration</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">API Key</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">
                Request ID
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 font-bold">{r.method}</td>
                <td className="px-4 py-2.5 font-mono text-gray-900 dark:text-gray-100">
                  {r.route}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded px-2 py-0.5 font-bold ${getStatusBadgeClass(r.statusCode)}`}
                  >
                    {r.statusCode}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{r.durationMs}ms</td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  {r.apiKey?.keyPrefix ? (
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      {r.apiKey.keyPrefix}...
                    </code>
                  ) : (
                    <span className="text-gray-400">Session/JWT</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-gray-400">
                  {r.requestId}
                </td>
              </tr>
            ))}
            {!isLoading && records.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  No API usage records found for selected filters
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  Loading telemetry...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-3 text-xs dark:border-gray-700">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-gray-300 px-3 py-1 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
          >
            Previous
          </button>
          <span className="text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded border border-gray-300 px-3 py-1 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
