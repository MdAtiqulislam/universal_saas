import React from "react";

export function CacheMetricsPanel({
  hitRate,
  missRate,
  size,
  invalidations,
}: {
  hitRate: number;
  missRate: number;
  size: number;
  invalidations: number;
}) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-4">Cache Metrics</h3>
      <div className="flex items-center space-x-6">
        <div>
          <div className="text-xs text-gray-500 uppercase">Hit Rate</div>
          <div
            className={`text-2xl font-bold ${hitRate > 80 ? "text-emerald-600" : "text-amber-600"}`}
          >
            {hitRate}%
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Miss Rate</div>
          <div className="text-2xl font-bold text-gray-700">{missRate}%</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Size</div>
          <div className="text-lg font-semibold">{size} MB</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Invalidations</div>
          <div className="text-lg font-semibold">{invalidations}</div>
        </div>
      </div>
    </div>
  );
}
