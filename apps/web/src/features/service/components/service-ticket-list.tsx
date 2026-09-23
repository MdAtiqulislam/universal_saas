"use client";

import React, { useEffect, useState } from "react";
import { serviceApi } from "../api/service-api";
import { ServiceTicket } from "../types/service.types";

export function ServiceTicketList() {
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<ServiceTicket | null>(null);

  // Diagnosis state
  const [diagnosisCode, setDiagnosisCode] = useState("E101-MOTOR_FAULT");
  const [symptoms, setSymptoms] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [warrantyCovered, setWarrantyCovered] = useState(true);
  const [savingDiagnosis, setSavingDiagnosis] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const data = await serviceApi.listServiceTickets();
      setTickets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDiagnosisModal = (ticket: ServiceTicket) => {
    setSelectedTicket(ticket);
    setSymptoms(ticket.description || "");
    setRootCause("");
  };

  const handleSubmitDiagnosis = async () => {
    if (!selectedTicket || !symptoms.trim() || !rootCause.trim()) return;
    try {
      setSavingDiagnosis(true);
      // Fallback technician ID
      const techId = selectedTicket.assignedTechnicianId || "00000000-0000-0000-0000-000000000001";

      await serviceApi.recordDiagnosis(selectedTicket.id, {
        technicianId: techId,
        diagnosisCode,
        symptoms: symptoms.trim(),
        rootCause: rootCause.trim(),
        warrantyCovered,
        finalize: true,
      });

      setSelectedTicket(null);
      loadTickets();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingDiagnosis(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-slate-900">Support & Service Tickets</h3>
          <p className="text-xs text-slate-500">
            SLA tracking, technician dispatch & technical root cause diagnosis
          </p>
        </div>
        <button
          onClick={loadTickets}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          Refresh
        </button>
      </div>

      {/* Tickets Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Ticket #</th>
                <th className="px-6 py-4">Customer & Asset</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Technician</th>
                <th className="px-6 py-4">SLA Status</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading service tickets...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No active service tickets found.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4 font-bold text-slate-900">{t.ticketNumber}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{t.customer?.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {t.customerAsset ? `Asset: ${t.customerAsset.assetNumber}` : t.item?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">{t.subject}</td>
                    <td className="px-6 py-4">
                      {t.assignedTechnician ? (
                        <span className="font-semibold text-slate-800">
                          {t.assignedTechnician.firstName} {t.assignedTechnician.lastName}
                        </span>
                      ) : (
                        <span className="italic text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          t.slaStatus === "MET"
                            ? "bg-emerald-100 text-emerald-800"
                            : t.slaStatus === "BREACHED"
                              ? "bg-rose-100 text-rose-800"
                              : t.slaStatus === "AT_RISK"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {t.slaStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-800">
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {t.status !== "CLOSED" && t.status !== "CANCELLED" && (
                        <button
                          onClick={() => handleOpenDiagnosisModal(t)}
                          className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                        >
                          Diagnose
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diagnosis Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900">
              Record Technical Diagnosis — {selectedTicket.ticketNumber}
            </h3>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Diagnosis Code</label>
              <select
                value={diagnosisCode}
                onChange={(e) => setDiagnosisCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
              >
                <option value="E101-MOTOR_FAULT">E101 - Motor / Actuator Failure</option>
                <option value="E102-PCB_SHORT">E102 - Power Circuit Short</option>
                <option value="E103-FIRMWARE_CORRUPT">E103 - Firmware / Memory Error</option>
                <option value="E104-WEAR_AND_TEAR">E104 - Mechanical Wear & Tear</option>
                <option value="E105-CALIBRATION">E105 - Calibration Deviation</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Observed Symptoms</label>
              <textarea
                rows={2}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Root Cause Finding</label>
              <textarea
                rows={2}
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                placeholder="Detail technical root cause..."
                className="w-full rounded-xl border border-slate-200 p-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="diagWarranty"
                checked={warrantyCovered}
                onChange={(e) => setWarrantyCovered(e.target.checked)}
                className="rounded text-indigo-600"
              />
              <label htmlFor="diagWarranty" className="font-medium text-slate-700">
                Covered under manufacturer / extended warranty
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedTicket(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitDiagnosis}
                disabled={savingDiagnosis || !symptoms.trim() || !rootCause.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingDiagnosis ? "Finalizing..." : "Finalize Diagnosis"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
