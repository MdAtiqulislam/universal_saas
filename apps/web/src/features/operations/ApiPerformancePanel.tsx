import React from "react";

export function ApiPerformancePanel({
  p50,
  p95,
  p99,
  requestRate,
  errorRate,
  slowRequestRate,
}: {
  p50: number;
  p95: number;
  p99: number;
  requestRate: number;
  errorRate: number;
  slowRequestRate: number;
}) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-4">API Performance</h3>
      <table className="w-full text-sm text-left">
        <tbody>
          <tr>
            <td className="py-2 text-gray-600 font-medium">P50 Latency</td>
            <td className="py-2 text-right">{p50} ms</td>
          </tr>
          <tr>
            <td className="py-2 text-gray-600 font-medium">P95 Latency</td>
            <td className={`py-2 text-right ${p95 > 500 ? "text-amber-600 font-bold" : ""}`}>
              {p95} ms
            </td>
          </tr>
          <tr>
            <td className="py-2 text-gray-600 font-medium">P99 Latency</td>
            <td className={`py-2 text-right ${p99 > 1000 ? "text-rose-600 font-bold" : ""}`}>
              {p99} ms
            </td>
          </tr>
          <tr>
            <td className="py-2 text-gray-600 font-medium">Request Rate</td>
            <td className="py-2 text-right">{requestRate} req/s</td>
          </tr>
          <tr>
            <td className="py-2 text-gray-600 font-medium">Error Rate</td>
            <td className="py-2 text-right">{errorRate}%</td>
          </tr>
          <tr>
            <td className="py-2 text-gray-600 font-medium">Slow Requests</td>
            <td className="py-2 text-right">{slowRequestRate}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
