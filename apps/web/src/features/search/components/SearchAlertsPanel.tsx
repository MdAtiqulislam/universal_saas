"use client";

import React, { useState } from "react";
import { SearchAlertItem, SavedViewItem } from "../types";

interface SearchAlertsPanelProps {
  alerts: SearchAlertItem[];
  savedViews: SavedViewItem[];
  onCreateAlert: (data: {
    savedViewId: string;
    name: string;
    description?: string;
    alertIntervalMinutes: number;
    notifyChannels: string[];
  }) => void;
}

export const SearchAlertsPanel: React.FC<SearchAlertsPanelProps> = ({
  alerts,
  savedViews,
  onCreateAlert,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [savedViewId, setSavedViewId] = useState(savedViews[0]?.id || "");
  const [name, setName] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyInApp, setNotifyInApp] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !savedViewId) return;

    const channels: string[] = [];
    if (notifyInApp) channels.push("IN_APP");
    if (notifyEmail) channels.push("EMAIL");

    onCreateAlert({
      savedViewId,
      name: name.trim(),
      alertIntervalMinutes: Number(intervalMinutes),
      notifyChannels: channels,
    });

    setName("");
    setIsCreating(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Search Alerts</h3>
          <p className="text-xs text-gray-500">
            Get automated omnichannel notifications (M43) when new records match your saved searches
          </p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          disabled={savedViews.length === 0}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isCreating ? "Cancel" : "+ New Search Alert"}
        </button>
      </div>

      {isCreating && (
        <form
          onSubmit={handleSubmit}
          className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3"
        >
          <h4 className="text-xs font-semibold text-gray-700">Configure Automated Search Alert</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Target Saved Search</label>
              <select
                value={savedViewId}
                onChange={(e) => setSavedViewId(e.target.value)}
                required
                className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {savedViews.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.resourceType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Alert Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. New High Priority Tickets"
                required
                className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Evaluation Frequency</label>
              <select
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={15}>Every 15 minutes</option>
                <option value={60}>Every hour</option>
                <option value={360}>Every 6 hours</option>
                <option value={1440}>Once daily</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Notification Channels (M43)
              </label>
              <div className="flex items-center space-x-4 pt-1">
                <label className="flex items-center space-x-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={notifyInApp}
                    onChange={(e) => setNotifyInApp(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>In-App Bell</span>
                </label>
                <label className="flex items-center space-x-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Email Digest</span>
                </label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
          >
            Create Alert Rule
          </button>
        </form>
      )}

      {alerts.length === 0 ? (
        <p className="text-xs text-gray-500 py-4 text-center">
          No search alerts configured. Save a search view first, then create an automated alert.
        </p>
      ) : (
        <div className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-lg">
          {alerts.map((al) => (
            <div
              key={al.id}
              className="p-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-gray-900">{al.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      al.status === "ACTIVE"
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {al.status}
                  </span>
                </div>
                <div className="text-gray-500 text-[11px]">
                  Saved Search: <strong>{al.savedView?.name || "View"}</strong> • Frequency: Every{" "}
                  {al.alertIntervalMinutes} min • Channels: {al.notifyChannels.join(", ")}
                </div>
              </div>

              <span className="text-xs text-gray-400">
                Created {new Date(al.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
