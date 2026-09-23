"use client";

import React, { useState, useEffect } from "react";
import { WorkflowExecution } from "./types";
import { getExecutions, getExecution, cancelExecution, retryExecution } from "./api/workflows-api";

interface ExecutionExplorerPanelProps {
  initialWorkflowId?: string;
}

export const ExecutionExplorerPanel: React.FC<ExecutionExplorerPanelProps> = ({
  initialWorkflowId,
}) => {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    getExecutions({
      ...(initialWorkflowId ? { workflowDefinitionId: initialWorkflowId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      page,
      limit: 15,
    })
      .then((res) => {
        if (!ignore) {
          setExecutions(res.executions || []);
          setTotalPages(res.totalPages || 1);
          setTotalCount(res.total || 0);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          console.error(err);
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [initialWorkflowId, statusFilter, page, reloadKey]);

  const handleSelectExecution = async (id: string) => {
    try {
      const full = await getExecution(id);
      setSelectedExecution(full);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || "Failed to fetch execution details");
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this running/waiting execution?")) return;
    try {
      await cancelExecution(id);
      setIsLoading(true);
      setReloadKey((k) => k + 1);
      if (selectedExecution?.id === id) {
        handleSelectExecution(id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || "Failed to cancel execution");
    }
  };

  const handleRetry = async (id: string) => {
    const reason = prompt("Reason for retrying this execution:", "Manual operator retry");
    if (reason === null) return;
    try {
      await retryExecution(id, reason);
      setIsLoading(true);
      setReloadKey((k) => k + 1);
      if (selectedExecution?.id === id) {
        handleSelectExecution(id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || "Failed to retry execution");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">All Statuses</option>
            <option value="RUNNING">Running</option>
            <option value="WAITING">Waiting (Approval)</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <span className="text-xs text-gray-500">{totalCount} total executions</span>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsLoading(true);
            setReloadKey((k) => k + 1);
          }}
          className="rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* List Table */}
        <div className="lg:col-span-2 overflow-x-auto rounded-lg border border-gray-200 shadow-sm dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">Execution ID / Workflow</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    Loading executions...
                  </td>
                </tr>
              ) : executions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No executions recorded.
                  </td>
                </tr>
              ) : (
                executions.map((exec) => (
                  <tr
                    key={exec.id}
                    onClick={() => handleSelectExecution(exec.id)}
                    className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      selectedExecution?.id === exec.id ? "bg-blue-50/50 dark:bg-blue-900/20" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {exec.definition?.name || "Workflow"}
                      </div>
                      <div className="font-mono text-[11px] text-gray-400">
                        {exec.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          exec.status === "COMPLETED"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                            : exec.status === "RUNNING"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                              : exec.status === "WAITING"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                                : exec.status === "FAILED"
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                                  : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {exec.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                      {exec.triggerType}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {exec.startedAt ? new Date(exec.startedAt).toLocaleTimeString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">
                      {exec.durationMs ? `${exec.durationMs}ms` : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {exec.status === "FAILED" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRetry(exec.id);
                          }}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Retry
                        </button>
                      )}
                      {(exec.status === "RUNNING" || exec.status === "WAITING") && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancel(exec.id);
                          }}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-900">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-gray-300 px-3 py-1 text-xs disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded border border-gray-300 px-3 py-1 text-xs disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">
            Execution Inspector
          </h3>

          {!selectedExecution ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select an execution row on the left to inspect its timeline, steps, and outputs.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded bg-gray-50 p-3 text-xs space-y-1.5 dark:bg-gray-900">
                <div>
                  <span className="text-gray-500">ID:</span>{" "}
                  <span className="font-mono text-gray-700 dark:text-gray-300">
                    {selectedExecution.id}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>{" "}
                  <span className="font-semibold">{selectedExecution.status}</span>
                </div>
                {selectedExecution.errorMessage && (
                  <div className="text-red-600 font-medium">
                    Error: {selectedExecution.errorMessage}
                  </div>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Step Execution Sequence ({selectedExecution.steps?.length || 0})
                </h4>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {selectedExecution.steps?.map((step) => (
                    <div
                      key={step.id}
                      className="rounded border border-gray-200 p-2 text-xs dark:border-gray-700"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          #{step.stepNumber} {step.nodeKey}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            step.status === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : step.status === "FAILED"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {step.status}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                        <span>Type: {step.nodeType}</span>
                        <span>{step.durationMs ? `${step.durationMs}ms` : ""}</span>
                      </div>
                      {step.errorMessage && (
                        <div className="mt-1 text-[11px] text-red-600">{step.errorMessage}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selectedExecution.outputContext && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Output Context
                  </h4>
                  <pre className="max-h-36 overflow-auto rounded bg-gray-50 p-2 font-mono text-[11px] text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                    {JSON.stringify(selectedExecution.outputContext, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
