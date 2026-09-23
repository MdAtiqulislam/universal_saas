import React from "react";
import { DashboardWidget as WidgetType } from "../types";
import { DashboardWidgetCard } from "./DashboardWidget";

interface DashboardGridProps {
  widgets: WidgetType[];
  onRemoveWidget?: (id: string) => void;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({ widgets, onRemoveWidget }) => {
  if (widgets.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
        <p className="text-sm font-medium text-gray-900">Dashboard is empty</p>
        <p className="text-xs text-gray-500 mt-1">
          Add widgets or saved reports to customize this dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {widgets.map((w) => (
        <DashboardWidgetCard key={w.id} widget={w} onRemove={onRemoveWidget} />
      ))}
    </div>
  );
};
