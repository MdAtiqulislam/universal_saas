import React from "react";

interface KpiWidgetProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { direction: "up" | "down" | "neutral"; percent: number };
  unit?: string;
}

export const KpiWidget: React.FC<KpiWidgetProps> = ({ title, value, subtitle, trend, unit }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm flex flex-col justify-between">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</div>
      <div className="my-2">
        <div className="text-2xl font-bold text-gray-900 flex items-baseline gap-1 font-mono">
          <span>{value}</span>
          {unit && <span className="text-xs font-normal text-gray-500">{unit}</span>}
        </div>
      </div>
      {(subtitle || trend) && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {trend && (
            <span
              className={`font-semibold ${
                trend.direction === "up"
                  ? "text-emerald-600"
                  : trend.direction === "down"
                    ? "text-red-600"
                    : "text-gray-500"
              }`}
            >
              {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}{" "}
              {Math.abs(trend.percent)}%
            </span>
          )}
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
    </div>
  );
};
