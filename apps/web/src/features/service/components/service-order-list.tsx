"use client";

import React, { useEffect, useState } from "react";
import { serviceApi } from "../api/service-api";
import { ServiceOrder } from "../types/service.types";

export function ServiceOrderList() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);

  // Handover modal
  const [handoverRecipient, setHandoverRecipient] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [handingOver, setHandingOver] = useState(false);

  // Action status
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await serviceApi.listServiceOrders();
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async (orderId: string) => {
    try {
      setActionLoading(true);
      await serviceApi.releaseServiceOrder(orderId);
      loadOrders();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async (orderId: string) => {
    try {
      setActionLoading(true);
      await serviceApi.startServiceOrder(orderId);
      loadOrders();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestQA = async (orderId: string) => {
    try {
      setActionLoading(true);
      await serviceApi.requestQualityCheck(orderId);
      loadOrders();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async (orderId: string) => {
    try {
      setActionLoading(true);
      await serviceApi.completeServiceOrder(orderId);
      loadOrders();
    } catch (err: any) {
      alert(err.message || "Failed to complete order");
    } finally {
      setActionLoading(false);
    }
  };

  const handleInvoice = async (orderId: string) => {
    try {
      setActionLoading(true);
      await serviceApi.invoiceServiceOrder(orderId);
      alert("M14 Customer Invoice successfully generated!");
      loadOrders();
    } catch (err: any) {
      alert(err.message || "Failed to invoice order");
    } finally {
      setActionLoading(false);
    }
  };

  const handleHandoverSubmit = async () => {
    if (!selectedOrder || !handoverRecipient.trim()) return;
    try {
      setHandingOver(true);
      await serviceApi.handoverServiceOrder(selectedOrder.id, {
        recipientName: handoverRecipient.trim(),
        acceptanceNotes: handoverNotes.trim(),
      });
      setSelectedOrder(null);
      setHandoverRecipient("");
      setHandoverNotes("");
      loadOrders();
    } catch (err: any) {
      alert(err.message || "Failed to process handover");
    } finally {
      setHandingOver(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-slate-900">Service & Repair Orders</h3>
          <p className="text-xs text-slate-500">
            Execution tracking, parts consumption, QA pass & customer billing
          </p>
        </div>
        <button
          onClick={loadOrders}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          Refresh
        </button>
      </div>

      {/* Orders Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Order #</th>
                <th className="px-6 py-4">Customer & Asset</th>
                <th className="px-6 py-4">Cost vs Charge</th>
                <th className="px-6 py-4">Warranty</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading service orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No service orders created yet.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4 font-bold text-slate-900">{o.serviceOrderNumber}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{o.customer?.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {o.customerAsset
                          ? `Asset: ${o.customerAsset.assetNumber}`
                          : "General Equipment"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">
                        Charge: ${Number(o.customerCharge).toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Cost: ${Number(o.totalCost).toFixed(2)} (Parts: $
                        {Number(o.partsCost).toFixed(2)}, Labor: ${Number(o.laborCost).toFixed(2)})
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          o.warrantyStatus === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {o.warrantyStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
                        {o.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1">
                      {o.status === "DRAFT" && (
                        <button
                          onClick={() => handleRelease(o.id)}
                          disabled={actionLoading}
                          className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          Release
                        </button>
                      )}
                      {o.status === "RELEASED" && (
                        <button
                          onClick={() => handleStart(o.id)}
                          disabled={actionLoading}
                          className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600"
                        >
                          Start Work
                        </button>
                      )}
                      {o.status === "IN_PROGRESS" && (
                        <>
                          <button
                            onClick={() => handleRequestQA(o.id)}
                            disabled={actionLoading}
                            className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-700"
                          >
                            QA Check
                          </button>
                          <button
                            onClick={() => handleComplete(o.id)}
                            disabled={actionLoading}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            Complete
                          </button>
                        </>
                      )}
                      {o.status === "QUALITY_CHECK" && (
                        <button
                          onClick={() => handleComplete(o.id)}
                          disabled={actionLoading}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          Verify & Complete
                        </button>
                      )}
                      {o.status === "COMPLETED" && (
                        <>
                          <button
                            onClick={() => setSelectedOrder(o)}
                            className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            Handover
                          </button>
                          {Number(o.customerCharge) > 0 && !o.customerInvoiceId && (
                            <button
                              onClick={() => handleInvoice(o.id)}
                              disabled={actionLoading}
                              className="rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-purple-700"
                            >
                              Invoice M14
                            </button>
                          )}
                        </>
                      )}
                      {o.status === "HANDED_OVER" &&
                        Number(o.customerCharge) > 0 &&
                        !o.customerInvoiceId && (
                          <button
                            onClick={() => handleInvoice(o.id)}
                            disabled={actionLoading}
                            className="rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-purple-700"
                          >
                            Invoice M14
                          </button>
                        )}
                      {o.customerInvoice && (
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          Invoiced ({o.customerInvoice.invoiceNumber})
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Handover Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900">
              Customer Equipment Handover — {selectedOrder.serviceOrderNumber}
            </h3>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Recipient Name *</label>
              <input
                type="text"
                value={handoverRecipient}
                onChange={(e) => setHandoverRecipient(e.target.value)}
                placeholder="e.g. John Doe (Customer Rep)"
                className="w-full rounded-xl border border-slate-200 p-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Acceptance Notes & Condition
              </label>
              <textarea
                rows={3}
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                placeholder="Serviced unit tested and accepted in fully operational condition..."
                className="w-full rounded-xl border border-slate-200 p-2 text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleHandoverSubmit}
                disabled={handingOver || !handoverRecipient.trim()}
                className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {handingOver ? "Submitting..." : "Confirm Handover & Restore Asset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
