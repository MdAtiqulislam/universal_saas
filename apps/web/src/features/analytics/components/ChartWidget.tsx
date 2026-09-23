import React from "react";

interface ChartWidgetProps {
  title: string;
  type: "line" | "bar" | "pie";
  dataPoints: { label: string; value: number }[];
  isCurrency?: boolean;
}

export const ChartWidget: React.FC<ChartWidgetProps> = ({
  title,
  type,
  dataPoints,
  isCurrency,
}) => {
  const maxValue = Math.max(...dataPoints.map((d) => d.value), 1);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{title}</h4>
        <span className="text-[10px] bg-gray-100 text-gray-500 font-mono uppercase px-1.5 py-0.5 rounded">
          {type}
        </span>
      </div>

      {dataPoints.length === 0 ? (
        <div className="py-8 text-center text-xs text-gray-400 italic">No chart data</div>
      ) : (
        <div className="space-y-2 py-1">
          {dataPoints.map((pt, i) => {
            const pct = Math.min(Math.round((pt.value / maxValue) * 100), 100);
            const displayVal = isCurrency
              ? `$${(pt.value / 100).toFixed(2)}`
              : pt.value.toLocaleString();

            return (
              <div key={i} className="text-xs">
                <div className="flex justify-between text-[11px] text-gray-600 mb-0.5">
                  <span className="truncate max-w-[150px] font-medium">{pt.label}</span>
                  <span className="font-mono text-gray-900 font-semibold">{displayVal}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
