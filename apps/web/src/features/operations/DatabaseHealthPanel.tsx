import React from "react";

export function DatabaseHealthPanel({
  status,
  latencyMs,
  slowQueryCount,
  connectionErrors,
}: {
  status: "UP" | "DEGRADED" | "DOWN" | "UNKNOWN";
  latencyMs?: number;
  slowQueryCount?: number;
  connectionErrors?: number;
}) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-4">Database Health</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-500 uppercase">Status</div>
          <div className="font-semibold">{status}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Latency</div>
          <div className="font-semibold">{latencyMs ?? "-"} ms</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Slow Queries</div>
          <div className="font-semibold">{slowQueryCount ?? "-"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Conn Errors</div>
          <div className="font-semibold">{connectionErrors ?? "-"}</div>
        </div>
      </div>
    </div>
  );
}
