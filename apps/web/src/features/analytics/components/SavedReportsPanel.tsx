import React from "react";
import { SavedReport } from "../types";

interface SavedReportsPanelProps {
  reports: SavedReport[];
  onSelectReport: (report: SavedReport) => void;
  onDeleteReport: (id: string) => void;
}

export const SavedReportsPanel: React.FC<SavedReportsPanelProps> = ({
  reports,
  onSelectReport,
  onDeleteReport,
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex justify-between items-center border-b border-gray-200 pb-2">
        <h3 className="text-sm font-semibold text-gray-900">Saved Reports ({reports.length})</h3>
      </div>

      {reports.length === 0 ? (
        <div className="text-xs text-gray-400 italic py-4 text-center">No saved reports found</div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {reports.map((report) => (
            <div
              key={report.id}
              className="py-2.5 flex items-center justify-between hover:bg-gray-50 px-2 rounded"
            >
              <div onClick={() => onSelectReport(report)} className="cursor-pointer flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-800 truncate">{report.name}</div>
                <div className="text-[11px] text-gray-500 flex gap-2 mt-0.5">
                  <span className="font-mono bg-gray-100 px-1 rounded">{report.definitionKey}</span>
                  <span className="capitalize text-gray-400">
                    {report.visibility.toLowerCase()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 ml-3">
                <button
                  type="button"
                  onClick={() => onSelectReport(report)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 bg-blue-50 rounded"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteReport(report.id)}
                  className="text-xs text-red-500 hover:text-red-700 px-1.5 py-1"
                  title="Delete report"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
