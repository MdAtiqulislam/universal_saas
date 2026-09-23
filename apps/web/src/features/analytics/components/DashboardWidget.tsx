import React from "react";
import { DashboardWidget as WidgetType } from "../types";
import { KpiWidget } from "./KpiWidget";
import { ChartWidget } from "./ChartWidget";

interface DashboardWidgetCardProps {
  widget: WidgetType;
  onRemove?: (id: string) => void;
}

export const DashboardWidgetCard: React.FC<DashboardWidgetCardProps> = ({ widget, onRemove }) => {
  const renderWidgetContent = () => {
    switch (widget.widgetType) {
      case "METRIC_CARD":
      case "KPI_SUMMARY":
        return (
          <KpiWidget
            title={widget.title}
            value={widget.config?.value ?? "0"}
            subtitle={widget.config?.subtitle}
            unit={widget.config?.unit}
          />
        );
      case "CHART_LINE":
      case "CHART_BAR":
      case "CHART_PIE":
        return (
          <ChartWidget
            title={widget.title}
            type={
              widget.widgetType === "CHART_LINE"
                ? "line"
                : widget.widgetType === "CHART_PIE"
                  ? "pie"
                  : "bar"
            }
            dataPoints={widget.config?.dataPoints ?? []}
            isCurrency={widget.config?.isCurrency}
          />
        );
      case "TABLE":
      default:
        return (
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              {widget.title}
            </h4>
            <div className="text-xs text-gray-400 italic">Report preview table</div>
          </div>
        );
    }
  };

  return (
    <div className="relative group">
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(widget.id)}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white text-gray-400 hover:text-red-500 rounded p-1 shadow-sm z-10"
          title="Remove widget"
        >
          &times;
        </button>
      )}
      {renderWidgetContent()}
    </div>
  );
};
