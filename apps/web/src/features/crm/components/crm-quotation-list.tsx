"use client";

import React, { useEffect, useState } from "react";
import { crmApi } from "../api/crm-api";
import { Quotation, QuotationStatus } from "../types/crm.types";

export const CrmQuotationList: React.FC = () => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Modals
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptedBy, setAcceptedBy] = useState("");

  useEffect(() => {
    fetchQuotations();
  }, [statusFilter]);

  const fetchQuotations = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const data = await crmApi.listQuotations(params);
      setQuotations(data);
    } catch (err: any) {
      setError(err.message || "Failed to load quotations");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (id: string) => {
    try {
      await crmApi.submitQuotation(id);
      fetchQuotations();
    } catch (err: any) {
      alert(`Error submitting quotation: ${err.message}`);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await crmApi.approveQuotation(id);
      fetchQuotations();
    } catch (err: any) {
      alert(`Error approving quotation: ${err.message}`);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuote) return;
    try {
      await crmApi.rejectQuotation(selectedQuote.id, { rejectionReason: rejectReason });
      setShowRejectModal(false);
      setSelectedQuote(null);
      setRejectReason("");
      fetchQuotations();
    } catch (err: any) {
      alert(`Error rejecting quotation: ${err.message}`);
    }
  };

  const handleSend = async (id: string) => {
    try {
      await crmApi.sendQuotation(id);
      fetchQuotations();
    } catch (err: any) {
      alert(`Error sending quotation: ${err.message}`);
    }
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuote) return;
    try {
      await crmApi.acceptQuotation(selectedQuote.id, { acceptedBy });
      setShowAcceptModal(false);
      setSelectedQuote(null);
      setAcceptedBy("");
      fetchQuotations();
    } catch (err: any) {
      alert(`Error accepting quotation: ${err.message}`);
    }
  };

  const handleConvert = async (quote: Quotation) => {
    if (
      !confirm(
        `Convert accepted quotation ${quote.quotationNumber} into an authoritative Sales Order?`,
      )
    )
      return;
    try {
      const res = await crmApi.convertQuotation(quote.id);
      alert(`Successfully generated M28 Sales Order: ${res.salesOrder?.orderNumber || "Created"}`);
      fetchQuotations();
    } catch (err: any) {
      alert(`Error converting quotation: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h2 className="text-base font-bold text-gray-900">Commercial Quotations & Proposals</h2>
          <p className="text-xs text-gray-500">
            Submit, approve, send, and 1-click convert accepted customer proposals to M28 Sales
            Orders
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="SENT">Sent</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="CONVERTED">Converted (Sales Order)</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button
            onClick={fetchQuotations}
            className="px-3 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-6 text-gray-500 text-center">Loading quotations...</div>
        ) : error ? (
          <div className="p-6 text-red-600 text-center">{error}</div>
        ) : quotations.length === 0 ? (
          <div className="p-6 text-gray-400 text-center">No quotations found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                <tr>
                  <th className="p-3">Quotation #</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Opportunity</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Grand Total</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Commercial Lifecycle Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold text-gray-800">{q.quotationNumber}</td>
                    <td className="p-3 font-medium text-gray-900">
                      {q.customer?.name || "Customer"}
                    </td>
                    <td className="p-3 text-xs text-indigo-600 font-medium">
                      {q.opportunity ? q.opportunity.opportunityNumber : "—"}
                    </td>
                    <td className="p-3 text-xs text-gray-500">
                      {new Date(q.quotationDate).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right font-bold text-gray-900">
                      $
                      {Number(q.grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          q.status === "DRAFT"
                            ? "bg-gray-100 text-gray-700"
                            : q.status === "SUBMITTED"
                              ? "bg-blue-100 text-blue-800"
                              : q.status === "APPROVED"
                                ? "bg-indigo-100 text-indigo-800"
                                : q.status === "SENT"
                                  ? "bg-amber-100 text-amber-800"
                                  : q.status === "ACCEPTED"
                                    ? "bg-teal-100 text-teal-800"
                                    : q.status === "CONVERTED"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-red-100 text-red-800"
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1.5">
                      {q.status === "DRAFT" && (
                        <button
                          onClick={() => handleSubmit(q.id)}
                          className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded font-medium"
                        >
                          Submit
                        </button>
                      )}

                      {q.status === "SUBMITTED" && (
                        <>
                          <button
                            onClick={() => handleApprove(q.id)}
                            className="px-2.5 py-1 text-xs bg-indigo-600 text-white hover:bg-indigo-700 rounded font-medium"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedQuote(q);
                              setShowRejectModal(true);
                            }}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {(q.status === "APPROVED" || q.status === "DRAFT") && (
                        <button
                          onClick={() => handleSend(q.id)}
                          className="px-2.5 py-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 rounded font-medium"
                        >
                          Send to Client
                        </button>
                      )}

                      {(q.status === "SENT" || q.status === "APPROVED") && (
                        <button
                          onClick={() => {
                            setSelectedQuote(q);
                            setAcceptedBy(q.customer?.name || "");
                            setShowAcceptModal(true);
                          }}
                          className="px-2.5 py-1 text-xs bg-teal-600 text-white hover:bg-teal-700 rounded font-medium"
                        >
                          Record Acceptance
                        </button>
                      )}

                      {q.status === "ACCEPTED" && (
                        <button
                          onClick={() => handleConvert(q)}
                          className="px-3 py-1 text-xs bg-emerald-600 text-white hover:bg-emerald-700 rounded font-bold shadow-xs"
                        >
                          1-Click Sales Order
                        </button>
                      )}

                      {q.status === "CONVERTED" && (
                        <span className="text-xs text-emerald-700 font-semibold">
                          ✓ M28 Order Created
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedQuote && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Reject Quotation</h3>
            <form onSubmit={handleReject} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Rejection Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Discount excessive, terms unacceptable..."
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700"
                >
                  Reject Proposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Accept Modal */}
      {showAcceptModal && selectedQuote && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Record Customer Acceptance</h3>
            <p className="text-xs text-gray-500">
              Quotation:{" "}
              <span className="font-semibold">
                {selectedQuote.quotationNumber} (${Number(selectedQuote.grandTotal).toFixed(2)})
              </span>
            </p>
            <form onSubmit={handleAccept} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Client Signatory / Representative *
                </label>
                <input
                  type="text"
                  required
                  value={acceptedBy}
                  onChange={(e) => setAcceptedBy(e.target.value)}
                  placeholder="e.g. John Doe (Procurement Director)"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAcceptModal(false)}
                  className="px-4 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 text-white rounded text-sm font-medium hover:bg-teal-700"
                >
                  Confirm Acceptance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
