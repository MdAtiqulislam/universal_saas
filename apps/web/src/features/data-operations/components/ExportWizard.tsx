import React, { useState } from "react";
import { DataOperationDefinition, ExportResult } from "../types";
import { dataOperationsApi } from "../api/data-operations-api";

interface ExportWizardProps {
  definitions: DataOperationDefinition[];
  onExportComplete?: () => void;
}

export const ExportWizard: React.FC<ExportWizardProps> = ({ definitions, onExportComplete }) => {
  const exportDefs = definitions.filter((d) => d.operationType === "EXPORT");
  const [selectedKey, setSelectedKey] = useState<string>(exportDefs[0]?.operationKey || "");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [format, setFormat] = useState<"CSV" | "JSON">("CSV");
  const [limit, setLimit] = useState<number>(1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  const currentDef = exportDefs.find((d) => d.operationKey === selectedKey);

  const toggleField = (fieldName: string) => {
    if (selectedFields.includes(fieldName)) {
      setSelectedFields(selectedFields.filter((f) => f !== fieldName));
    } else {
      setSelectedFields([...selectedFields, fieldName]);
    }
  };

  const selectAllFields = () => {
    if (currentDef) {
      setSelectedFields(currentDef.fieldSchema.map((f) => f.name));
    }
  };

  const handleExport = async () => {
    if (!currentDef) return;
    try {
      setLoading(true);
      setError(null);
      const res = await dataOperationsApi.exportData({
        operationKey: selectedKey,
        fields: selectedFields.length > 0 ? selectedFields : undefined,
        format,
        limit,
      });
      setResult(res);
      if (onExportComplete) onExportComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const mime = result.format === "JSON" ? "application/json" : "text/csv";
    const blob = new Blob([result.fileContent], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Data Export Wizard</h2>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Operation Picker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Export Dataset
        </label>
        <select
          value={selectedKey}
          onChange={(e) => {
            setSelectedKey(e.target.value);
            setSelectedFields([]);
            setResult(null);
          }}
          className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          {exportDefs.map((def) => (
            <option key={def.operationKey} value={def.operationKey}>
              {def.domain.toUpperCase()}: {def.entity} ({def.operationKey})
            </option>
          ))}
        </select>
      </div>

      {currentDef && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              Select Fields to Export (default: all)
            </span>
            <button
              type="button"
              onClick={selectAllFields}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Select All
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border border-gray-200 rounded p-3 max-h-48 overflow-y-auto">
            {currentDef.fieldSchema.map((field) => (
              <label
                key={field.name}
                className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedFields.length === 0 || selectedFields.includes(field.name)}
                  onChange={() => toggleField(field.name)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="truncate">{field.name}</span>
                {field.isRestricted && (
                  <span className="px-1 text-[10px] bg-amber-100 text-amber-800 rounded">
                    Restricted
                  </span>
                )}
              </label>
            ))}
          </div>

          {/* Options: Format & Limit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as "CSV" | "JSON")}
                className="w-full border border-gray-300 rounded p-2 text-sm"
              >
                <option value="CSV">CSV (Spreadsheet RFC 4180)</option>
                <option value="JSON">JSON</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Max Rows (Server limit: {currentDef.maxRows})
              </label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                min={1}
                max={currentDef.maxRows}
                className="w-full border border-gray-300 rounded p-2 text-sm"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={loading}
            className="w-full bg-blue-600 text-white font-medium py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {loading ? "Exporting..." : "Execute Export"}
          </button>
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-green-900">Export Ready!</h3>
              <p className="text-xs text-green-700">
                Exported {result.rowCount} rows ({result.fileSizeBytes} bytes) in{" "}
                {result.durationMs}ms.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              className="bg-green-600 text-white text-xs px-4 py-2 rounded hover:bg-green-700 font-medium"
            >
              Download {result.fileName}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
