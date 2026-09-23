import React, { useState } from "react";
import { DataOperationDefinition, ImportPreviewResult } from "../types";
import { dataOperationsApi } from "../api/data-operations-api";

interface ImportWizardProps {
  definitions: DataOperationDefinition[];
  onImportComplete?: () => void;
}

export const ImportWizard: React.FC<ImportWizardProps> = ({ definitions, onImportComplete }) => {
  const importDefs = definitions.filter((d) => d.operationType === "IMPORT");
  const [selectedKey, setSelectedKey] = useState<string>(importDefs[0]?.operationKey || "");
  const [mode, setMode] = useState<"UPSERT" | "CREATE_ONLY" | "UPDATE_ONLY">("UPSERT");
  const [fileContent, setFileContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [commitResult, setCommitResult] = useState<any | null>(null);

  const currentDef = importDefs.find((d) => d.operationKey === selectedKey);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
      setPreview(null);
      setCommitResult(null);
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!currentDef || !fileContent.trim()) {
      setError("Please provide file content or upload a file.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setCommitResult(null);
      const res = await dataOperationsApi.previewImport({
        operationKey: selectedKey,
        fileContent,
        mode,
      });
      setPreview(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!currentDef || !fileContent.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const res = await dataOperationsApi.commitImport({
        operationKey: selectedKey,
        fileContent,
        jobId: preview?.jobId,
        mode,
      });
      setCommitResult(res);
      setPreview(null);
      if (onImportComplete) onImportComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Commit failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Data Import Wizard</h2>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Operation & Mode Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Entity Operation
          </label>
          <select
            value={selectedKey}
            onChange={(e) => {
              setSelectedKey(e.target.value);
              setPreview(null);
              setCommitResult(null);
            }}
            className="w-full border border-gray-300 rounded p-2 text-sm"
          >
            {importDefs.map((def) => (
              <option key={def.operationKey} value={def.operationKey}>
                {def.domain.toUpperCase()}: {def.entity} ({def.operationKey})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Import Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "UPSERT" | "CREATE_ONLY" | "UPDATE_ONLY")}
            className="w-full border border-gray-300 rounded p-2 text-sm"
          >
            <option value="UPSERT">UPSERT (Create new, update existing)</option>
            <option value="CREATE_ONLY">CREATE_ONLY (Reject duplicates)</option>
            <option value="UPDATE_ONLY">UPDATE_ONLY (Reject new records)</option>
          </select>
        </div>
      </div>

      {/* File Upload / Paste */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Upload CSV / JSON File
        </label>
        <input
          type="file"
          accept=".csv,.json"
          onChange={handleFileUpload}
          className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Or Paste File Content (CSV or JSON)
        </label>
        <textarea
          value={fileContent}
          onChange={(e) => {
            setFileContent(e.target.value);
            setPreview(null);
            setCommitResult(null);
          }}
          rows={5}
          placeholder="name,email&#10;Acme Corp,contact@acme.com"
          className="w-full border border-gray-300 rounded p-2 text-xs font-mono"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          type="button"
          onClick={handlePreview}
          disabled={loading || !fileContent.trim()}
          className="flex-1 bg-amber-600 text-white font-medium py-2 rounded hover:bg-amber-700 disabled:opacity-50 text-sm"
        >
          {loading ? "Validating..." : "Dry-Run Preview (No Mutation)"}
        </button>

        {preview && preview.validRows > 0 && (
          <button
            type="button"
            onClick={handleCommit}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white font-medium py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {loading ? "Committing..." : `Commit Import (${preview.validRows} rows)`}
          </button>
        )}
      </div>

      {/* Preview Summary */}
      {preview && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-md space-y-4">
          <h3 className="text-sm font-bold text-gray-900">
            Preview Results (Dry-Run Only — Zero Business Mutation)
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-white p-2 rounded border border-gray-200">
              <span className="text-xs text-gray-500">Total Rows</span>
              <p className="text-lg font-bold text-gray-900">{preview.totalRows}</p>
            </div>
            <div className="bg-white p-2 rounded border border-green-200">
              <span className="text-xs text-green-600">Planned Creates</span>
              <p className="text-lg font-bold text-green-700">{preview.plannedCreates}</p>
            </div>
            <div className="bg-white p-2 rounded border border-blue-200">
              <span className="text-xs text-blue-600">Planned Updates</span>
              <p className="text-lg font-bold text-blue-700">{preview.plannedUpdates}</p>
            </div>
            <div className="bg-white p-2 rounded border border-red-200">
              <span className="text-xs text-red-600">Invalid Rows</span>
              <p className="text-lg font-bold text-red-700">{preview.invalidRows}</p>
            </div>
          </div>

          {preview.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-red-800">
                Detected Validation Errors ({preview.errors.length})
              </h4>
              <div className="border border-red-200 rounded max-h-40 overflow-y-auto">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-red-50 text-red-700">
                    <tr>
                      <th className="p-1">Row</th>
                      <th className="p-1">Field</th>
                      <th className="p-1">Code</th>
                      <th className="p-1">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.errors.map((err, i) => (
                      <tr key={i} className="border-t border-red-100">
                        <td className="p-1 font-mono">{err.rowNumber}</td>
                        <td className="p-1 font-mono">{err.fieldName || "-"}</td>
                        <td className="p-1 font-mono text-red-600">{err.errorCode}</td>
                        <td className="p-1 text-gray-700">{err.errorMessage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Commit Result */}
      {commitResult && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md space-y-2">
          <h3 className="text-sm font-bold text-green-900">Import Committed Successfully!</h3>
          <p className="text-xs text-green-800">
            Job ID: <span className="font-mono">{commitResult.jobId}</span> | Status:{" "}
            <span className="font-bold">{commitResult.status}</span> | Processed:{" "}
            {commitResult.processedRows} rows | Successful: {commitResult.successfulRows} | Failed:{" "}
            {commitResult.failedRows} in {commitResult.durationMs}ms
          </p>
        </div>
      )}
    </div>
  );
};
