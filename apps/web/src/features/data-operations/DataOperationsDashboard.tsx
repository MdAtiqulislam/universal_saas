import React, { useState, useEffect } from "react";
import { DataOperationDefinition, DataOperationJob } from "./types";
import { dataOperationsApi } from "./api/data-operations-api";
import { ExportWizard } from "./components/ExportWizard";
import { ImportWizard } from "./components/ImportWizard";
import { JobHistoryTable } from "./components/JobHistoryTable";

export const DataOperationsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"export" | "import" | "history">("export");
  const [definitions, setDefinitions] = useState<DataOperationDefinition[]>([]);
  const [jobs, setJobs] = useState<DataOperationJob[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [defsData, jobsData] = await Promise.all([
        dataOperationsApi.listDefinitions().catch(() => []),
        dataOperationsApi
          .listJobs()
          .then((r) => r.jobs)
          .catch(() => []),
      ]);
      setDefinitions(defsData);
      setJobs(jobsData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalJobs = jobs.length;
  const activeJobs = jobs.filter((j) => j.status === "PROCESSING" || j.status === "QUEUED").length;
  const completedExports = jobs.filter(
    (j) => j.operationType === "EXPORT" && j.status === "COMPLETED",
  ).length;
  const totalRowsProcessed = jobs.reduce((acc, j) => acc + (j.processedRows || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Data Export, Import & Bulk Operations
          </h1>
          <p className="text-sm text-gray-500">
            Centralized platform for tenant-isolated bulk operations, dry-run validation, and
            streaming exports.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <span className="text-xs font-medium text-gray-500">Total Jobs</span>
          <p className="text-2xl font-bold text-gray-900">{totalJobs}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <span className="text-xs font-medium text-blue-600">Active Jobs</span>
          <p className="text-2xl font-bold text-blue-700">{activeJobs}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <span className="text-xs font-medium text-green-600">Completed Exports</span>
          <p className="text-2xl font-bold text-green-700">{completedExports}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <span className="text-xs font-medium text-purple-600">Processed Rows</span>
          <p className="text-2xl font-bold text-purple-700">
            {totalRowsProcessed.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6">
          <button
            type="button"
            onClick={() => setActiveTab("export")}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === "export"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Export Data
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("import")}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === "import"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Import Data (Dry-Run & Commit)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === "history"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Job History & Errors
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      {loading ? (
        <div className="p-8 text-center text-sm text-gray-500">
          Loading Data Operations platform...
        </div>
      ) : (
        <>
          {activeTab === "export" && (
            <ExportWizard definitions={definitions} onExportComplete={loadData} />
          )}
          {activeTab === "import" && (
            <ImportWizard definitions={definitions} onImportComplete={loadData} />
          )}
          {activeTab === "history" && <JobHistoryTable jobs={jobs} onRefresh={loadData} />}
        </>
      )}
    </div>
  );
};
