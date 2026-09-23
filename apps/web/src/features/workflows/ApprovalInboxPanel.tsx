"use client";

import React, { useState, useEffect } from "react";
import { WorkflowApproval } from "./types";
import { getPendingApprovals, decideApproval, delegateApproval } from "./api/workflows-api";

export const ApprovalInboxPanel: React.FC = () => {
  const [approvals, setApprovals] = useState<WorkflowApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Modal states
  const [selectedApproval, setSelectedApproval] = useState<WorkflowApproval | null>(null);
  const [modalType, setModalType] = useState<"APPROVE" | "REJECT" | "DELEGATE" | null>(null);
  const [comment, setComment] = useState("");
  const [delegateUserId, setDelegateUserId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    getPendingApprovals()
      .then((data) => {
        if (!ignore) {
          setApprovals(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : String(err);
          setActionError(msg || "Failed to fetch pending approvals");
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const handleOpenActionModal = (
    approval: WorkflowApproval,
    type: "APPROVE" | "REJECT" | "DELEGATE",
  ) => {
    setSelectedApproval(approval);
    setModalType(type);
    setComment("");
    setDelegateUserId("");
  };

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApproval || !modalType) return;

    try {
      setIsSubmitting(true);
      if (modalType === "APPROVE" || modalType === "REJECT") {
        await decideApproval(selectedApproval.id, {
          decision: modalType === "APPROVE" ? "APPROVED" : "REJECTED",
          comment,
        });
      } else if (modalType === "DELEGATE") {
        await delegateApproval(selectedApproval.id, {
          delegateToUserId: delegateUserId,
          reason: comment,
        });
      }

      setModalType(null);
      setSelectedApproval(null);
      setIsLoading(true);
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || "Failed to submit decision");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Pending Approval Inbox ({approvals.length})
        </h3>
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

      {actionError && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {actionError}
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-sm text-gray-500">Loading pending approvals...</div>
      ) : approvals.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">
            All caught up! No pending approvals found.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">Workflow / Node</th>
                <th className="px-4 py-3">Quorum / Policy</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Requested At</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {approvals.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {app.execution?.definition?.name || "Workflow"}
                    </div>
                    <div className="font-mono text-xs text-gray-500">{app.nodeId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                      {app.approvalType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                    {app.approvalCount || 0} / {app.requiredCount || 1} approvals
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(app.requestedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {app.expiresAt ? new Date(app.expiresAt).toLocaleDateString() : "No expiry"}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => handleOpenActionModal(app, "APPROVE")}
                      className="rounded bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenActionModal(app, "REJECT")}
                      className="rounded bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenActionModal(app, "DELEGATE")}
                      className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Delegate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Decision Modal */}
      {modalType && selectedApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
              {modalType === "APPROVE"
                ? "Approve Workflow Step"
                : modalType === "REJECT"
                  ? "Reject Workflow Step"
                  : "Delegate Approval"}
            </h3>
            <form onSubmit={handleSubmitDecision} className="space-y-4">
              {modalType === "DELEGATE" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Delegate to User ID (UUID)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="User UUID"
                    value={delegateUserId}
                    onChange={(e) => setDelegateUserId(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {modalType === "REJECT" ? "Rejection Reason (Required)" : "Comments (Optional)"}
                </label>
                <textarea
                  rows={3}
                  required={modalType === "REJECT"}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    modalType === "REJECT"
                      ? "Explain why this workflow step cannot proceed..."
                      : "Optional feedback..."
                  }
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                    modalType === "APPROVE"
                      ? "bg-green-600 hover:bg-green-700"
                      : modalType === "REJECT"
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {isSubmitting ? "Submitting..." : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
