"use client";

import React, { useState, useEffect } from "react";
import { securityApi } from "../api/security-api";
import { SecurityEventItem } from "../types/security.types";

export function SecurityEventList() {
  const [events, setEvents] = useState<SecurityEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<SecurityEventItem | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (categoryFilter) params.category = categoryFilter;
      if (severityFilter) params.severity = severityFilter;
      const data = await securityApi.getEvents(params);
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [categoryFilter, severityFilter]);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700"
          >
            <option value="">All Threat Categories</option>
            <option value="AUTHENTICATION">Authentication</option>
            <option value="AUTHORIZATION">Authorization</option>
            <option value="SESSION">Session</option>
            <option value="API_ABUSE">API Abuse & Throttling</option>
            <option value="TENANT_SECURITY">Tenant Isolation</option>
            <option value="ADMINISTRATION">Administration</option>
            <option value="CONFIGURATION">Configuration</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700"
          >
            <option value="">All Severity Levels</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="INFO">Info</option>
          </select>
        </div>

        <button
          onClick={fetchEvents}
          className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
        >
          Refresh Feed
        </button>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-100 text-gray-600 uppercase font-semibold">
            <tr>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Severity</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Event Type</th>
              <th className="py-3 px-4">Actor</th>
              <th className="py-3 px-4">Resource</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  Loading security events...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  No matching security events found.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-500">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        e.severity === "CRITICAL"
                          ? "bg-rose-100 text-rose-800"
                          : e.severity === "HIGH"
                            ? "bg-orange-100 text-orange-800"
                            : e.severity === "MEDIUM"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {e.severity}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-700">{e.category}</td>
                  <td className="py-3 px-4 font-semibold text-gray-900">{e.eventType}</td>
                  <td className="py-3 px-4 text-gray-600">{e.actorUser?.email || "Anonymous"}</td>
                  <td className="py-3 px-4 text-gray-500 font-mono">
                    {e.resource ? `${e.resource}:${e.resourceId || "*"}` : "&mdash;"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedEvent(e)}
                      className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900">Security Event Payload</h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="font-semibold text-gray-600">ID:</span>{" "}
                <span className="font-mono text-gray-800">{selectedEvent.id}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-600">Category:</span>{" "}
                {selectedEvent.category}
              </div>
              <div>
                <span className="font-semibold text-gray-600">Event Type:</span>{" "}
                {selectedEvent.eventType}
              </div>
              <div>
                <span className="font-semibold text-gray-600">IP Address:</span>{" "}
                {selectedEvent.ipAddress || "None"}
              </div>
              <div>
                <span className="font-semibold text-gray-600">User Agent:</span>{" "}
                {selectedEvent.userAgent || "None"}
              </div>
              <div>
                <span className="font-semibold text-gray-600">Sanitized Metadata:</span>
                <pre className="mt-1 p-3 bg-gray-900 text-emerald-400 rounded text-[11px] overflow-x-auto max-h-48">
                  {JSON.stringify(selectedEvent.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="text-right pt-2 border-t">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-xs hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
