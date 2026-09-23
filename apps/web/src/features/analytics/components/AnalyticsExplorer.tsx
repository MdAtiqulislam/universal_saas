import React, { useState } from "react";
import {
  AnalyticsDefinition,
  AnalyticsQuery,
  AnalyticsQueryResult,
  MeasureQueryItem,
  FilterNode,
} from "../types";
import { DimensionSelector } from "./DimensionSelector";
import { MeasureSelector } from "./MeasureSelector";
import { AnalyticsFilterBuilder } from "./AnalyticsFilterBuilder";
import { AnalyticsResultsTable } from "./AnalyticsResultsTable";

interface AnalyticsExplorerProps {
  definitions: AnalyticsDefinition[];
  onExecuteQuery: (query: AnalyticsQuery) => Promise<AnalyticsQueryResult>;
  onExportQuery: (query: AnalyticsQuery, format: "CSV" | "JSON") => Promise<void>;
  onSaveReport: (query: AnalyticsQuery, name: string) => Promise<void>;
}

export const AnalyticsExplorer: React.FC<AnalyticsExplorerProps> = ({
  definitions,
  onExecuteQuery,
  onExportQuery,
  onSaveReport,
}) => {
  const [selectedKey, setSelectedKey] = useState<string>(
    definitions[0]?.definitionKey || "sales.revenue",
  );
  const currentDef = definitions.find((d) => d.definitionKey === selectedKey) || definitions[0];

  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [selectedMeasures, setSelectedMeasures] = useState<MeasureQueryItem[]>([]);
  const [filterAst, setFilterAst] = useState<FilterNode | undefined>(undefined);
  const [timeDimension, setTimeDimension] = useState<string>("");
  const [timeGranularity, setTimeGranularity] = useState<string>("day");

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalyticsQueryResult | undefined>(undefined);
  const [reportName, setReportName] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);

  const handleDatasetChange = (key: string) => {
    setSelectedKey(key);
    const def = definitions.find((d) => d.definitionKey === key);
    setSelectedDimensions([]);
    setSelectedMeasures(
      def?.allowedMeasures[0]
        ? [
            {
              name: def.allowedMeasures[0].name,
              aggregation: def.allowedMeasures[0].aggregations[0],
            },
          ]
        : [],
    );
    setFilterAst(undefined);
    setTimeDimension(def?.defaultTimeDimension || "");
    setResult(undefined);
  };

  const buildQuery = (): AnalyticsQuery => ({
    definitionKey: selectedKey,
    dimensions: selectedDimensions.length > 0 ? selectedDimensions : undefined,
    measures: selectedMeasures.length > 0 ? selectedMeasures : undefined,
    filterAst,
    timeDimension: timeDimension || undefined,
    timeGranularity: timeDimension ? (timeGranularity as any) : undefined,
    limit: 50,
  });

  const handleRunQuery = async () => {
    setIsLoading(true);
    try {
      const res = await onExecuteQuery(buildQuery());
      setResult(res);
    } catch (err) {
      console.error("Query execution error", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = (format: "CSV" | "JSON") => {
    onExportQuery(buildQuery(), format);
  };

  const handleSave = async () => {
    if (!reportName.trim()) return;
    await onSaveReport(buildQuery(), reportName.trim());
    setShowSaveModal(false);
    setReportName("");
  };

  return (
    <div className="space-y-6">
      {/* Dataset & Controls Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-gray-200 pb-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Domain Dataset
            </label>
            <select
              value={selectedKey}
              onChange={(e) => handleDatasetChange(e.target.value)}
              className="font-medium text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-900 shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {definitions.map((def) => (
                <option key={def.definitionKey} value={def.definitionKey}>
                  {def.name} ({def.domain})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport("CSV")}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-md shadow-sm"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => handleExport("JSON")}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-md shadow-sm"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => setShowSaveModal(true)}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md shadow-sm"
            >
              Save Report
            </button>
            <button
              type="button"
              onClick={handleRunQuery}
              disabled={isLoading}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm disabled:opacity-50"
            >
              {isLoading ? "Running..." : "Run Query"}
            </button>
          </div>
        </div>

        {currentDef && <p className="text-xs text-gray-500 italic">{currentDef.description}</p>}

        {/* Builder Sections */}
        {currentDef && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div>
              <DimensionSelector
                availableDimensions={currentDef.allowedDimensions}
                selectedDimensions={selectedDimensions}
                onChange={setSelectedDimensions}
              />
            </div>
            <div>
              <MeasureSelector
                availableMeasures={currentDef.allowedMeasures}
                selectedMeasures={selectedMeasures}
                onChange={setSelectedMeasures}
              />
            </div>
            <div className="space-y-4">
              <AnalyticsFilterBuilder
                allowedFields={currentDef.allowedFilterFields}
                filterAst={filterAst}
                onChange={setFilterAst}
              />

              {currentDef.allowedTimeDimensions.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-gray-100 text-xs">
                  <div className="font-semibold text-gray-500 uppercase tracking-wider">
                    Time Dimension
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={timeDimension}
                      onChange={(e) => setTimeDimension(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-xs bg-white text-gray-800 flex-1"
                    >
                      <option value="">None (no bucketing)</option>
                      {currentDef.allowedTimeDimensions.map((td) => (
                        <option key={td} value={td}>
                          {td}
                        </option>
                      ))}
                    </select>
                    {timeDimension && (
                      <select
                        value={timeGranularity}
                        onChange={(e) => setTimeGranularity(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-xs bg-white text-gray-800"
                      >
                        <option value="hour">Hour</option>
                        <option value="day">Day</option>
                        <option value="week">Week</option>
                        <option value="month">Month</option>
                        <option value="quarter">Quarter</option>
                        <option value="year">Year</option>
                      </select>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results Table */}
      <AnalyticsResultsTable result={result} isLoading={isLoading} />

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-gray-900">Save Analytics Report</h3>
            <input
              type="text"
              placeholder="Report name..."
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-3 py-1.5 border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-3 py-1.5 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
