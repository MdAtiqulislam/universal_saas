import React from "react";
import { DataOperationJob } from "../types";
import { dataOperationsApi } from "../api/data-operations-api";

interface JobHistoryTableProps {
  jobs: DataOperationJob[];
  onRefresh: () => void;
}

export const JobHistoryTable: React.FC<JobHistoryTableProps> = ({ jobs, onRefresh }) => {
  const handleCancel = async (id: string) => {
    try {
      await dataOperationsApi.cancelJob(id);
      onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Cancel failed");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
            Completed
          </span>
        );
      case "PROCESSING":
      case "QUEUED":
        return (
          <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full animate-pulse">
            {status}
          </span>
        );
      case "PREVIEWING":
        return (
          <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full">
            Previewing
          </span>
        );
      case "FAILED":
        return (
          <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800 rounded-full">
            Failed
          </span>
        );
      case "CANCELLED":
        return (
          <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-800 rounded-full">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-900">Data Operations History</h3>
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded font-medium"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead className="bg-gray-50 text-gray-500 font-medium">
            <tr>
              <th className="px-4 py-3 text-left">Job ID</th>
              <th className="px-4 py-3 text-left">Operation Key</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Progress</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400 italic">
                  No data operation jobs executed yet.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-600">{job.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{job.operationKey}</td>
                  <td className="px-4 py-3 font-semibold text-gray-700">{job.operationType}</td>
                  <td className="px-4 py-3">{getStatusBadge(job.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <span>
                        {job.successfulRows} / {job.totalRows || 0}
                      </span>
                      {job.failedRows > 0 && (
                        <span className="text-red-500 font-bold">({job.failedRows} err)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(job.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {(job.status === "PROCESSING" ||
                      job.status === "QUEUED" ||
                      job.status === "PREVIEWING") && (
                      <button
                        type="button"
                        onClick={() => handleCancel(job.id)}
                        className="text-red-600 hover:text-red-800 font-semibold"
                      >
                        Cancel
                      </button>
                    )}
                    {job.status === "COMPLETED" && job.operationType === "EXPORT" && (
                      <a
                        href={`/api/v1/data-operations/jobs/${job.id}/result`}
                        download
                        className="text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        Download
                      </a>
                    )}
                    {job.failedRows > 0 && (
                      <a
                        href={`/api/v1/data-operations/jobs/${job.id}/errors`}
                        download
                        className="text-amber-600 hover:text-amber-800 font-semibold"
                      >
                        Errors CSV
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
