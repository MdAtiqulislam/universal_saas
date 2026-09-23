"use client";

import React, { useState, useEffect } from "react";
import { securityApi } from "../api/security-api";
import { UserSessionItem } from "../types/security.types";

export function ActiveSessionList() {
  const [sessions, setSessions] = useState<UserSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const data = await securityApi.getSessions(params);
      setSessions(data);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [statusFilter]);

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this active session immediately?")) return;
    try {
      await securityApi.revokeSession(id, "Admin revoked from security console");
      setActionMessage("Session revoked successfully.");
      fetchSessions();
    } catch (err: any) {
      alert(err.message || "Failed to revoke session");
    }
  };

  const handleRevokeUserAll = async (userId: string, email: string) => {
    if (!confirm(`Revoke ALL active devices/sessions for ${email}?`)) return;
    try {
      const res = await securityApi.revokeUserAll(userId, "Admin global logout");
      setActionMessage(res.message);
      fetchSessions();
    } catch (err: any) {
      alert(err.message || "Failed to trigger global logout");
    }
  };

  return (
    <div className="space-y-4">
      {actionMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs flex justify-between items-center">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="font-bold">
            &times;
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-3 items-center">
          <label className="text-xs font-semibold text-gray-500">Session Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700"
          >
            <option value="">All Sessions</option>
            <option value="ACTIVE">Active Only</option>
            <option value="REVOKED">Revoked</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>

        <button
          onClick={fetchSessions}
          className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
        >
          Refresh Registry
        </button>
      </div>

      {/* Sessions Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-100 text-gray-600 uppercase font-semibold">
            <tr>
              <th className="py-3 px-4">User Email</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">IP Address</th>
              <th className="py-3 px-4">User Agent / Client</th>
              <th className="py-3 px-4">Last Activity</th>
              <th className="py-3 px-4">Expires At</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  Loading active sessions...
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  No sessions found matching criteria.
                </td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-semibold text-gray-900">{s.userEmail}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        s.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800"
                          : s.status === "REVOKED"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 font-mono">{s.ipAddress || "&mdash;"}</td>
                  <td
                    className="py-3 px-4 text-gray-600 max-w-xs truncate"
                    title={s.userAgent || ""}
                  >
                    {s.userAgent || "Standard Browser Client"}
                  </td>
                  <td className="py-3 px-4 text-gray-500">
                    {new Date(s.lastActivityAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-gray-500">
                    {new Date(s.expiresAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    {s.status === "ACTIVE" && (
                      <>
                        <button
                          onClick={() => handleRevoke(s.id)}
                          className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded hover:bg-rose-100 text-xs"
                        >
                          Revoke
                        </button>
                        <button
                          onClick={() => handleRevokeUserAll(s.userId, s.userEmail)}
                          className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 text-xs"
                          title="Revoke all devices for this user"
                        >
                          Logout All
                        </button>
                      </>
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
}
