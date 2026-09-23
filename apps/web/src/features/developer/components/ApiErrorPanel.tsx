"use client";

import React, { useState, useEffect } from "react";
import { DeveloperErrorsData } from "../types";
import { getApiErrors } from "../api/developer-api";

export const ApiErrorPanel: React.FC = () => {
  const [data, setData] = useState<DeveloperErrorsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    getApiErrors(25)
      .then((res) => {
        if (!ignore) {
          setData(res);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          console.error("Failed to load error catalog:", err);
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  if (isLoading) {
    return <div className="py-12 text-center text-xs text-gray-500">Loading error catalog...</div>;
  }

  const taxonomy = data?.taxonomy || {};
  const recentErrors = data?.recentErrors || [];

  return (
    <div className="space-y-6">
      {/* Recent Errors Table */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
          Recent API Errors (Last 25)
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Real-time stream of 4xx client errors and 5xx system faults for your organization.
        </p>

        <div className="mt-4 overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-400">
                  Timestamp
                </th>
                <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-400">Method</th>
                <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-400">Route</th>
                <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-400">
                  API Key
                </th>
                <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-400">
                  Request ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentErrors.map((err) => (
                <tr key={err.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                    {new Date(err.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 font-bold ${
                        err.statusCode >= 500
                          ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}
                    >
                      {err.statusCode}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-bold">{err.method}</td>
                  <td className="px-3 py-2 font-mono text-gray-900 dark:text-gray-100">
                    {err.route}
                  </td>
                  <td className="px-3 py-2">
                    {err.keyPrefix ? (
                      <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px] text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                        {err.keyPrefix}...
                      </code>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-gray-400">{err.requestId}</td>
                </tr>
              ))}
              {recentErrors.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-green-600 font-medium">
                    No recent API errors recorded!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Canonical Error Taxonomy */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
          Canonical API Error Taxonomy
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Standardized error codes returned in the <code>error.code</code> property across all
          public endpoints.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(taxonomy).map(([code, item]) => (
            <div
              key={code}
              className="rounded-md border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between">
                <code className="font-mono text-xs font-bold text-red-600 dark:text-red-400">
                  {code}
                </code>
                <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  HTTP {item.httpStatus}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
