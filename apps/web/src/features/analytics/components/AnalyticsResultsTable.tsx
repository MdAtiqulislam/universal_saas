import React from "react";
import { AnalyticsQueryResult } from "../types";

interface AnalyticsResultsTableProps {
  result?: AnalyticsQueryResult;
  isLoading?: boolean;
}

export const AnalyticsResultsTable: React.FC<AnalyticsResultsTableProps> = ({
  result,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-lg border border-gray-200">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-sm text-gray-500">Executing analytics query...</span>
      </div>
    );
  }

  if (!result || result.data.length === 0) {
    return (
      <div className="text-center p-12 bg-white rounded-lg border border-gray-200 text-sm text-gray-500">
        No records found matching query criteria.
      </div>
    );
  }

  const columns = Object.keys(result.data[0]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center text-xs text-gray-600">
        <div>
          Showing <span className="font-semibold text-gray-900">{result.data.length}</span> of{" "}
          <span className="font-semibold text-gray-900">{result.meta.totalRows}</span> rows
        </div>
        <div className="text-gray-400">
          Execution latency:{" "}
          <span className="font-mono text-gray-600">{result.meta.executionTimeMs}ms</span>
        </div>
      </div>

      <div className="overflow-x-auto max-h-96">
        <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
          <thead className="bg-gray-50 font-semibold text-gray-700 sticky top-0">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-3 py-2 uppercase tracking-wider font-mono">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {result.data.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-gray-50 transition-colors">
                {columns.map((col) => {
                  const val = row[col];
                  const isCurrency =
                    col.includes("totalRevenue") ||
                    col.includes("Valuation") ||
                    col.includes("Amount");
                  const displayVal =
                    isCurrency && typeof val === "number"
                      ? `$${(val / 100).toFixed(2)}`
                      : val === null || val === undefined
                        ? "-"
                        : String(val);

                  return (
                    <td key={col} className="px-3 py-2 text-gray-800 font-mono whitespace-nowrap">
                      {displayVal}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
