import React, { useState } from "react";
import { ReportSchedule, SavedReport } from "../types";

interface ReportSchedulePanelProps {
  schedules: ReportSchedule[];
  reports: SavedReport[];
  onCreateSchedule: (savedReportId: string, frequency: "DAILY" | "WEEKLY" | "MONTHLY") => void;
  onDeleteSchedule: (id: string) => void;
}

export const ReportSchedulePanel: React.FC<ReportSchedulePanelProps> = ({
  schedules,
  reports,
  onCreateSchedule,
  onDeleteSchedule,
}) => {
  const [selectedReportId, setSelectedReportId] = useState(reports[0]?.id || "");
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("DAILY");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReportId) return;
    onCreateSchedule(selectedReportId, frequency);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <div className="border-b border-gray-200 pb-2">
        <h3 className="text-sm font-semibold text-gray-900">
          Scheduled Reports ({schedules.length})
        </h3>
        <p className="text-xs text-gray-500">
          Automated background report distribution via M36 jobs
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex gap-2 items-center text-xs">
        <select
          value={selectedReportId}
          onChange={(e) => setSelectedReportId(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 flex-1 bg-white text-gray-800"
        >
          <option value="" disabled>
            Select report...
          </option>
          {reports.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as any)}
          className="border border-gray-300 rounded px-2 py-1.5 bg-white text-gray-800"
        >
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
        </select>

        <button
          type="submit"
          className="px-3 py-1.5 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
        >
          Schedule
        </button>
      </form>

      <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
        {schedules.map((sch) => (
          <div key={sch.id} className="py-2 flex justify-between items-center text-xs">
            <div>
              <div className="font-medium text-gray-800">{sch.savedReport?.name || "Report"}</div>
              <div className="text-[11px] text-gray-400 flex gap-2">
                <span className="font-mono">{sch.frequency}</span>
                <span>Format: {sch.exportFormat}</span>
                {sch.nextRunAt && <span>Next: {new Date(sch.nextRunAt).toLocaleDateString()}</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDeleteSchedule(sch.id)}
              className="text-red-500 hover:text-red-700 px-2 py-1"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
