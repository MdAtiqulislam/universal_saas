"use client";

import React, { useEffect, useState } from "react";
import { crmApi } from "../api/crm-api";
import { Lead, LeadStatus, LeadPriority, LeadSource } from "../types/crm.types";

export const CrmLeadList: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Modals state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQualifyModal, setShowQualifyModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: "",
    companyName: "",
    email: "",
    phone: "",
    source: "WEBSITE" as LeadSource,
    priority: "MEDIUM" as LeadPriority,
    estimatedValue: 0,
    notes: "",
  });

  const [qualifyForm, setQualifyForm] = useState({
    qualificationNotes: "",
    estimatedValue: 0,
  });

  const [convertForm, setConvertForm] = useState({
    newCustomerName: "",
    opportunityTitle: "",
    estimatedValue: 0,
  });

  const [closeForm, setCloseForm] = useState({
    lostReason: "",
  });

  useEffect(() => {
    fetchLeads();
  }, [statusFilter]);

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const data = await crmApi.listLeads(params);
      setLeads(data);
    } catch (err: any) {
      setError(err.message || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await crmApi.createLead(createForm);
      setShowCreateModal(false);
      setCreateForm({
        name: "",
        companyName: "",
        email: "",
        phone: "",
        source: "WEBSITE",
        priority: "MEDIUM",
        estimatedValue: 0,
        notes: "",
      });
      fetchLeads();
    } catch (err: any) {
      alert(`Error creating lead: ${err.message}`);
    }
  };

  const handleQualifyLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    try {
      await crmApi.qualifyLead(selectedLead.id, qualifyForm);
      setShowQualifyModal(false);
      setSelectedLead(null);
      fetchLeads();
    } catch (err: any) {
      alert(`Error qualifying lead: ${err.message}`);
    }
  };

  const handleConvertLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    try {
      const res = await crmApi.convertLead(selectedLead.id, convertForm);
      alert(
        `Successfully converted Lead into Customer & Opportunity ${res.opportunity?.opportunityNumber || ""}`,
      );
      setShowConvertModal(false);
      setSelectedLead(null);
      fetchLeads();
    } catch (err: any) {
      alert(`Error converting lead: ${err.message}`);
    }
  };

  const handleCloseLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    try {
      await crmApi.closeLead(selectedLead.id, closeForm);
      setShowCloseModal(false);
      setSelectedLead(null);
      fetchLeads();
    } catch (err: any) {
      alert(`Error closing lead: ${err.message}`);
    }
  };

  const filteredLeads = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.companyName && l.companyName.toLowerCase().includes(search.toLowerCase())) ||
      l.leadNumber.toLowerCase().includes(search.toLowerCase()) ||
      (l.email && l.email.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search leads, company, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm w-full sm:w-72"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">All Statuses</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="CONVERTED">Converted</option>
            <option value="LOST">Lost</option>
          </select>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 w-full sm:w-auto"
        >
          + Add New Lead
        </button>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-6 text-gray-500 text-center">Loading leads...</div>
        ) : error ? (
          <div className="p-6 text-red-600 text-center">{error}</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-6 text-gray-400 text-center">No leads found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                <tr>
                  <th className="p-3">Lead #</th>
                  <th className="p-3">Name / Company</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Estimated Value</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold text-gray-800">{lead.leadNumber}</td>
                    <td className="p-3">
                      <div className="font-medium text-gray-900">{lead.name}</div>
                      {lead.companyName && (
                        <div className="text-xs text-gray-500">{lead.companyName}</div>
                      )}
                    </td>
                    <td className="p-3 text-xs text-gray-600">
                      {lead.email && <div>{lead.email}</div>}
                      {lead.phone && <div>{lead.phone}</div>}
                    </td>
                    <td className="p-3 text-xs">
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        {lead.source}
                      </span>
                    </td>
                    <td className="p-3 font-medium">
                      $
                      {Number(lead.estimatedValue).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          lead.status === "NEW"
                            ? "bg-blue-100 text-blue-800"
                            : lead.status === "QUALIFIED"
                              ? "bg-purple-100 text-purple-800"
                              : lead.status === "CONVERTED"
                                ? "bg-emerald-100 text-emerald-800"
                                : lead.status === "LOST"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      {lead.status !== "CONVERTED" && lead.status !== "LOST" && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setQualifyForm({
                                qualificationNotes: lead.qualificationNotes || "",
                                estimatedValue: Number(lead.estimatedValue) || 0,
                              });
                              setShowQualifyModal(true);
                            }}
                            className="px-2.5 py-1 text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 rounded"
                          >
                            Qualify
                          </button>

                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setConvertForm({
                                newCustomerName: lead.companyName || lead.name,
                                opportunityTitle: `Commercial Deal - ${lead.companyName || lead.name}`,
                                estimatedValue: Number(lead.estimatedValue) || 0,
                              });
                              setShowConvertModal(true);
                            }}
                            className="px-2.5 py-1 text-xs bg-emerald-600 text-white hover:bg-emerald-700 rounded font-medium shadow-sm"
                          >
                            1-Click Convert
                          </button>

                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setCloseForm({ lostReason: "" });
                              setShowCloseModal(true);
                            }}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                          >
                            Mark Lost
                          </button>
                        </>
                      )}
                      {lead.status === "CONVERTED" && (
                        <span className="text-xs text-emerald-600 font-medium">✓ Converted</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Lead */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Create New Prospect Lead</h3>
            <form onSubmit={handleCreateLead} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">Contact Name *</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Company Name</label>
                <input
                  type="text"
                  value={createForm.companyName}
                  onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Phone</label>
                  <input
                    type="text"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Source</label>
                  <select
                    value={createForm.source}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, source: e.target.value as LeadSource })
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                  >
                    <option value="WEBSITE">Website</option>
                    <option value="REFERRAL">Referral</option>
                    <option value="SOCIAL_MEDIA">Social Media</option>
                    <option value="CAMPAIGN">Campaign</option>
                    <option value="PARTNER">Partner</option>
                    <option value="COLD_OUTREACH">Cold Outreach</option>
                    <option value="EXHIBITION">Exhibition</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Estimated Value ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={createForm.estimatedValue}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        estimatedValue: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Notes</label>
                <textarea
                  rows={3}
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
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
                  Create Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Qualify Lead */}
      {showQualifyModal && selectedLead && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">
              Qualify Lead: {selectedLead.leadNumber}
            </h3>
            <form onSubmit={handleQualifyLead} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Qualification Assessment Notes *
                </label>
                <textarea
                  required
                  rows={3}
                  value={qualifyForm.qualificationNotes}
                  onChange={(e) =>
                    setQualifyForm({ ...qualifyForm, qualificationNotes: e.target.value })
                  }
                  placeholder="Budget verified, authority established, timeline identified..."
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Refined Estimated Deal Value ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={qualifyForm.estimatedValue}
                  onChange={(e) =>
                    setQualifyForm({
                      ...qualifyForm,
                      estimatedValue: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQualifyModal(false)}
                  className="px-4 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700"
                >
                  Mark as Qualified
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: 1-Click Convert Lead */}
      {showConvertModal && selectedLead && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">1-Click Convert Lead</h3>
            <p className="text-xs text-gray-500">
              Atomically creates authoritative M11 Customer Master, primary contact, and initializes
              M35 Opportunity Deal.
            </p>
            <form onSubmit={handleConvertLead} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Customer Account Name *
                </label>
                <input
                  type="text"
                  required
                  value={convertForm.newCustomerName}
                  onChange={(e) =>
                    setConvertForm({ ...convertForm, newCustomerName: e.target.value })
                  }
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Opportunity Deal Title *
                </label>
                <input
                  type="text"
                  required
                  value={convertForm.opportunityTitle}
                  onChange={(e) =>
                    setConvertForm({ ...convertForm, opportunityTitle: e.target.value })
                  }
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Initial Estimated Value ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={convertForm.estimatedValue}
                  onChange={(e) =>
                    setConvertForm({
                      ...convertForm,
                      estimatedValue: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  className="px-4 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700"
                >
                  Execute Conversion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Close Lead Lost */}
      {showCloseModal && selectedLead && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Mark Lead as Lost</h3>
            <form onSubmit={handleCloseLead} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">Reason for Loss *</label>
                <textarea
                  required
                  rows={3}
                  value={closeForm.lostReason}
                  onChange={(e) => setCloseForm({ lostReason: e.target.value })}
                  placeholder="Competitor chosen, budget dissolved, unresponsive..."
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700"
                >
                  Confirm Lost
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
