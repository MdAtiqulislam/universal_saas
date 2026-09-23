"use client";

import React, { useState, useEffect } from "react";
import { WorkflowDefinition } from "./types";
import { getWorkflows, createWorkflow, executeWorkflow, deleteWorkflow } from "./api/workflows-api";

interface WorkflowListPanelProps {
  onSelectWorkflow: (workflow: WorkflowDefinition) => void;
  onViewExecutions: (workflowId: string) => void;
}

export const WorkflowListPanel: React.FC<WorkflowListPanelProps> = ({
  onSelectWorkflow,
  onViewExecutions,
}) => {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // New Workflow Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("OPERATIONS");
  const [newDesc, setNewDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    let ignore = false;
    getWorkflows({
      ...(categoryFilter ? { category: categoryFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    })
      .then((data) => {
        if (!ignore) {
          setWorkflows(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : String(err);
          setErrorMessage(msg || "Failed to fetch workflows");
          setIsLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [categoryFilter, statusFilter, reloadKey]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await createWorkflow({
        key: newKey,
        name: newName,
        category: newCategory,
        description: newDesc,
      });
      setIsCreateModalOpen(false);
      setNewKey("");
      setNewName("");
      setNewDesc("");
      setIsLoading(true);
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || "Failed to create workflow");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecute = async (id: string, name: string) => {
    if (!confirm(`Trigger manual execution for "${name}"?`)) return;
    try {
      await executeWorkflow(id, { inputContext: { triggeredBy: "ADMIN_DASHBOARD" } });
      alert(`Execution queued successfully!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || "Failed to trigger workflow execution");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await deleteWorkflow(id);
      setIsLoading(true);
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || "Failed to delete workflow");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">All Categories</option>
            <option value="OPERATIONS">Operations</option>
            <option value="FINANCE">Finance</option>
            <option value="PROCUREMENT">Procurement</option>
            <option value="SALES">Sales</option>
            <option value="HR">HR</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + New Workflow
        </button>
      </div>

      {errorMessage && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-sm text-gray-500">Loading workflows...</div>
      ) : workflows.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">No workflows found.</p>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-3 text-sm font-medium text-blue-600 hover:underline"
          >
            Create your first workflow definition
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">Key / Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Versions</th>
                <th className="px-4 py-3">Executions</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {workflows.map((wf) => (
                <tr key={wf.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{wf.name}</div>
                    <div className="font-mono text-xs text-gray-500">{wf.key}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      {wf.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        wf.status === "ACTIVE"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                          : wf.status === "DRAFT"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                      }`}
                    >
                      {wf.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {wf._count?.versions || (wf.activeVersion ? 1 : 0)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    <button
                      type="button"
                      onClick={() => onViewExecutions(wf.id)}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {wf._count?.executions || 0} runs
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => onSelectWorkflow(wf)}
                      className="rounded bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                    >
                      Graph Builder
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExecute(wf.id, wf.name)}
                      className="rounded bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300"
                    >
                      Trigger
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(wf.id, wf.name)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
              Create New Workflow Definition
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Key (identifier)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. order-approval-flow"
                  value={newKey}
                  onChange={(e) =>
                    setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))
                  }
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Order Approval Workflow"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="OPERATIONS">Operations</option>
                  <option value="FINANCE">Finance</option>
                  <option value="PROCUREMENT">Procurement</option>
                  <option value="SALES">Sales</option>
                  <option value="HR">HR</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Workflow"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
