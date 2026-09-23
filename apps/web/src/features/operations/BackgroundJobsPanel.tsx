import React from "react";

export function BackgroundJobsPanel({
  queued,
  processing,
  completed,
  failed,
  retryCount,
  avgDurationMs,
}: {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  retryCount: number;
  avgDurationMs: number;
}) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-4">Background Jobs</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-xs text-gray-500">Queued</div>
          <div className="text-xl font-bold">{queued}</div>
        </div>
        <div className="bg-indigo-50 p-3 rounded">
          <div className="text-xs text-indigo-500">Processing</div>
          <div className="text-xl font-bold text-indigo-700">{processing}</div>
        </div>
        <div className="bg-emerald-50 p-3 rounded">
          <div className="text-xs text-emerald-600">Completed</div>
          <div className="text-xl font-bold text-emerald-700">{completed}</div>
        </div>
        <div className="bg-rose-50 p-3 rounded">
          <div className="text-xs text-rose-600">Failed</div>
          <div className="text-xl font-bold text-rose-700">{failed}</div>
        </div>
        <div className="bg-amber-50 p-3 rounded">
          <div className="text-xs text-amber-600">Retries</div>
          <div className="text-xl font-bold text-amber-700">{retryCount}</div>
        </div>
        <div className="bg-slate-50 p-3 rounded">
          <div className="text-xs text-slate-500">Avg Duration</div>
          <div className="text-xl font-bold text-slate-700">{avgDurationMs}ms</div>
        </div>
      </div>
    </div>
  );
}
