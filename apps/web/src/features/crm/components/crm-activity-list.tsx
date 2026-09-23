"use client";

import React, { useEffect, useState } from "react";
import { crmApi } from "../api/crm-api";
import { CrmActivity, ActivityType, ActivityStatus } from "../types/crm.types";

export const CrmActivityList: React.FC = () => {
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<CrmActivity | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [outcome, setOutcome] = useState("");

  // Create form
  const [createForm, setCreateForm] = useState({
    type: "CALL" as ActivityType,
    subject: "",
    description: "",
    scheduledAt: "",
    followUpDate: "",
  });

  useEffect(() => {
    fetchActivities();
  }, [typeFilter, statusFilter]);

  const fetchActivities = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const data = await crmApi.listActivities(params);
      setActivities(data);
    } catch (err: any) {
      setError(err.message || "Failed to load CRM activities");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await crmApi.createActivity(createForm);
      setShowCreateModal(false);
      setCreateForm({
        type: "CALL",
        subject: "",
        description: "",
        scheduledAt: "",
        followUpDate: "",
      });
      fetchActivities();
    } catch (err: any) {
      alert(`Error creating activity: ${err.message}`);
    }
  };

  const handleCompleteActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;
    try {
      await crmApi.completeActivity(selectedActivity.id, { outcome });
      setShowCompleteModal(false);
      setSelectedActivity(null);
      setOutcome("");
      fetchActivities();
    } catch (err: any) {
      alert(`Error completing activity: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium"
          >
            <option value="">All Types</option>
            <option value="CALL">Call</option>
            <option value="EMAIL">Email</option>
            <option value="MEETING">Meeting</option>
            <option value="TASK">Task</option>
            <option value="DEMO">Demo</option>
            <option value="SITE_VISIT">Site Visit</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-md hover:bg-indigo-700"
        >
          + Log Commercial Activity
        </button>
      </div>

      {/* Activities Feed */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-6 text-gray-500 text-center">Loading commercial touchpoints...</div>
        ) : error ? (
          <div className="p-6 text-red-600 text-center">{error}</div>
        ) : activities.length === 0 ? (
          <div className="p-6 text-gray-400 text-center">No activities recorded.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {activities.map((act) => (
              <div
                key={act.id}
                className="p-4 hover:bg-gray-50 flex items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[11px] font-bold">
                      {act.type}
                    </span>
                    <span className="font-semibold text-sm text-gray-900">{act.subject}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        act.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {act.status}
                    </span>
                  </div>

                  {act.description && (
                    <p className="text-xs text-gray-600 line-clamp-2">{act.description}</p>
                  )}

                  {act.outcome && (
                    <div className="text-xs text-emerald-700 bg-emerald-50/60 p-1.5 rounded">
                      <span className="font-semibold">Outcome:</span> {act.outcome}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-[11px] text-gray-400 pt-1">
                    {act.customer && <span>🏢 {act.customer.name}</span>}
                    {act.scheduledAt && (
                      <span>📅 Scheduled: {new Date(act.scheduledAt).toLocaleString()}</span>
                    )}
                    {act.followUpDate && (
                      <span>🔔 Follow-up: {new Date(act.followUpDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                <div>
                  {act.status !== "COMPLETED" && (
                    <button
                      onClick={() => {
                        setSelectedActivity(act);
                        setOutcome("");
                        setShowCompleteModal(true);
                      }}
                      className="px-3 py-1 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded font-medium"
                    >
                      Mark Complete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Create Activity */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Log Touchpoint / Activity</h3>
            <form onSubmit={handleCreateActivity} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Type *</label>
                  <select
                    value={createForm.type}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, type: e.target.value as ActivityType })
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                  >
                    <option value="CALL">Call</option>
                    <option value="EMAIL">Email</option>
                    <option value="MEETING">Meeting</option>
                    <option value="TASK">Task</option>
                    <option value="DEMO">Demo</option>
                    <option value="SITE_VISIT">Site Visit</option>
                    <option value="NOTE">Note</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Scheduled At</label>
                  <input
                    type="datetime-local"
                    value={createForm.scheduledAt}
                    onChange={(e) => setCreateForm({ ...createForm, scheduledAt: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Subject *</label>
                <input
                  type="text"
                  required
                  value={createForm.subject}
                  onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
                  placeholder="e.g. Discovery Call with VP Engineering"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Notes / Details</label>
                <textarea
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700"
                >
                  Record Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Complete Activity */}
      {showCompleteModal && selectedActivity && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Complete Activity</h3>
            <p className="text-xs text-gray-500">
              Activity: <span className="font-semibold">{selectedActivity.subject}</span>
            </p>
            <form onSubmit={handleCompleteActivity} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Discussion Outcome / Summary *
                </label>
                <textarea
                  required
                  rows={3}
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  placeholder="Client approved feature scope, requested formal quote by Thursday..."
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="px-4 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700"
                >
                  Save Outcome
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
