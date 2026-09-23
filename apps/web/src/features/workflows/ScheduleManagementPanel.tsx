"use client";

import React, { useState, useEffect } from "react";
import { WorkflowSchedule, WorkflowDefinition } from "./types";
import {
  getSchedules,
  createSchedule,
  pauseSchedule,
  resumeSchedule,
  getWorkflows,
} from "./api/workflows-api";

export const ScheduleManagementPanel: React.FC = () => {
  const [schedules, setSchedules] = useState<WorkflowSchedule[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  // New Schedule Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [scheduleType, setScheduleType] = useState<"CRON" | "INTERVAL">("CRON");
  const [cronExpression, setCronExpression] = useState("0 9 * * 1-5");
  const [intervalSeconds, setIntervalSeconds] = useState(3600);
  const [timezone, setTimezone] = useState("UTC");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    Promise.all([getSchedules(), getWorkflows()])
      .then(([schedData, wfData]) => {
        if (!ignore) {
          setSchedules(schedData);
          setWorkflows(wfData);
          if (wfData.length > 0 && !selectedWorkflowId) {
            setSelectedWorkflowId(wfData[0].id);
          }
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
  }, [reloadKey, selectedWorkflowId]);

  const handleToggleStatus = async (schedule: WorkflowSchedule) => {
    try {
      if (schedule.status === "ACTIVE") {
        await pauseSchedule(schedule.id);
      } else {
        await resumeSchedule(schedule.id);
      }
      setIsLoading(true);
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || "Failed to update schedule status");
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await createSchedule({
        workflowId: selectedWorkflowId,
        scheduleType,
        cronExpression: scheduleType === "CRON" ? cronExpression : undefined,
        intervalSeconds: scheduleType === "INTERVAL" ? intervalSeconds : undefined,
        timezone,
      });
      setIsCreateModalOpen(false);
      setIsLoading(true);
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || "Failed to create schedule");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Scheduled Workflow Triggers ({schedules.length})
        </h3>
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add Schedule
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-gray-500">Loading schedules...</div>
      ) : schedules.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">No scheduled triggers configured.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3">Cadence / Expression</th>
                <th className="px-4 py-3">Timezone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Next Scheduled Run</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {schedules.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {s.workflow?.name || "Workflow"}
                    </div>
                    <div className="font-mono text-xs text-gray-500">{s.workflow?.key}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-gray-800 dark:text-gray-200">
                      {s.scheduleType === "CRON" ? s.cronExpression : `Every ${s.intervalSeconds}s`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{s.timezone}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        s.status === "ACTIVE"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(s)}
                      className={`text-xs font-medium ${
                        s.status === "ACTIVE"
                          ? "text-amber-600 hover:text-amber-800"
                          : "text-green-600 hover:text-green-800"
                      }`}
                    >
                      {s.status === "ACTIVE" ? "Pause" : "Resume"}
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
              Schedule Workflow Execution
            </h3>
            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Target Workflow
                </label>
                <select
                  value={selectedWorkflowId}
                  onChange={(e) => setSelectedWorkflowId(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.key})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Schedule Type
                </label>
                <div className="mt-1 flex space-x-4">
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="radio"
                      name="schedType"
                      checked={scheduleType === "CRON"}
                      onChange={() => setScheduleType("CRON")}
                    />
                    <span>Cron Expression</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="radio"
                      name="schedType"
                      checked={scheduleType === "INTERVAL"}
                      onChange={() => setScheduleType("INTERVAL")}
                    />
                    <span>Fixed Interval</span>
                  </label>
                </div>
              </div>

              {scheduleType === "CRON" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cron Expression
                  </label>
                  <input
                    type="text"
                    required
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    placeholder="0 9 * * 1-5"
                    className="mt-1 w-full font-mono rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">Minute Hour Day Month DayOfWeek</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Interval (Seconds)
                  </label>
                  <input
                    type="number"
                    min={60}
                    required
                    value={intervalSeconds}
                    onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Timezone
                </label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="UTC or America/New_York"
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
                  {isSubmitting ? "Scheduling..." : "Save Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
