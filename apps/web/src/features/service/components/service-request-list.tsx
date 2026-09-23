"use client";

import React, { useEffect, useState } from "react";
import { serviceApi } from "../api/service-api";
import { ServiceRequest } from "../types/service.types";

export function ServiceRequestList({
  onNavigateTicket,
}: {
  onNavigateTicket?: (ticketId: string) => void;
}) {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [triageNotes, setTriageNotes] = useState("");
  const [triaging, setTriaging] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await serviceApi.listServiceRequests();
      setRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriageSubmit = async () => {
    if (!selectedRequest || !triageNotes.trim()) return;
    try {
      setTriaging(true);
      await serviceApi.triageServiceRequest(selectedRequest.id, {
        triageNotes: triageNotes.trim(),
      });
      setSelectedRequest(null);
      setTriageNotes("");
      loadRequests();
    } catch (err) {
      console.error(err);
    } finally {
      setTriaging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-slate-900">Customer Service Requests</h3>
          <p className="text-xs text-slate-500">
            Intake portal for maintenance, warranty claims & repairs
          </p>
        </div>
        <button
          onClick={loadRequests}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Request #</th>
                <th className="px-6 py-4">Customer & Asset</th>
                <th className="px-6 py-4">Category & Subject</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No service requests found.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4 font-semibold text-slate-900">{r.requestNumber}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{r.customer?.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {r.customerAsset ? `Asset: ${r.customerAsset.assetNumber}` : r.item?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{r.subject}</div>
                      <div className="text-[10px] text-slate-400">{r.issueCategory}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          r.priority === "CRITICAL" || r.priority === "URGENT"
                            ? "bg-rose-100 text-rose-800"
                            : r.priority === "HIGH"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {r.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          r.status === "CONVERTED_TO_TICKET"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.status === "TRIAGED"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-indigo-100 text-indigo-800"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {r.status === "SUBMITTED" || r.status === "DRAFT" ? (
                        <button
                          onClick={() => setSelectedRequest(r)}
                          className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                        >
                          Triage
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Converted</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Triage Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900">
              Triage Request — {selectedRequest.requestNumber}
            </h3>
            <p className="text-slate-600">
              Customer: <strong>{selectedRequest.customer?.name}</strong> | Subject:{" "}
              {selectedRequest.subject}
            </p>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Triage Notes & Assessment
              </label>
              <textarea
                rows={4}
                value={triageNotes}
                onChange={(e) => setTriageNotes(e.target.value)}
                placeholder="Enter technical assessment and resolution plan..."
                className="w-full rounded-xl border border-slate-200 p-3 text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedRequest(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleTriageSubmit}
                disabled={triaging || !triageNotes.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {triaging ? "Converting..." : "Convert to Service Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
