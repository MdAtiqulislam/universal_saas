"use client";

import React, { useState } from "react";
import { ShipmentCarrier, CarrierType } from "../types/shipping.types";
import { shippingApi } from "../api/shipping-api";

interface CarrierManagementProps {
  carriers: ShipmentCarrier[];
  loading: boolean;
  onRefresh: () => void;
}

export function CarrierManagement({ carriers, loading, onRefresh }: CarrierManagementProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<ShipmentCarrier | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [carrierType, setCarrierType] = useState<CarrierType>("COURIER");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [trackingUrlTemplate, setTrackingUrlTemplate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setCode("");
    setName("");
    setCarrierType("COURIER");
    setContactName("");
    setPhone("");
    setEmail("");
    setTrackingUrlTemplate("");
    setError(null);
    setEditingCarrier(null);
    setShowCreateModal(true);
  };

  const openEdit = (c: ShipmentCarrier) => {
    setCode(c.code);
    setName(c.name);
    setCarrierType(c.carrierType);
    setContactName(c.contactName || "");
    setPhone(c.phone || "");
    setEmail(c.email || "");
    setTrackingUrlTemplate(c.trackingUrlTemplate || "");
    setError(null);
    setEditingCarrier(c);
    setShowCreateModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      if (editingCarrier) {
        await shippingApi.updateCarrier(editingCarrier.id, {
          code,
          name,
          carrierType,
          contactName: contactName || undefined,
          phone: phone || undefined,
          email: email || undefined,
          trackingUrlTemplate: trackingUrlTemplate || undefined,
        });
      } else {
        await shippingApi.createCarrier({
          code,
          name,
          carrierType,
          contactName: contactName || undefined,
          phone: phone || undefined,
          email: email || undefined,
          trackingUrlTemplate: trackingUrlTemplate || undefined,
        });
      }
      setShowCreateModal(false);
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save carrier");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (c: ShipmentCarrier) => {
    try {
      if (c.isActive) {
        await shippingApi.deactivateCarrier(c.id);
      } else {
        await shippingApi.activateCarrier(c.id);
      }
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to toggle status");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Carrier Master</h2>
        <button
          type="button"
          onClick={openCreate}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
        >
          + Add Carrier
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-800 text-xs rounded-lg">
          {error}
        </div>
      )}

      <div className="overflow-x-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-medium text-xs">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Loading carriers...
                </td>
              </tr>
            ) : carriers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No carriers configured yet.
                </td>
              </tr>
            ) : (
              carriers.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                    {c.code}
                  </td>
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {c.carrierType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {c.contactName && <div>{c.contactName}</div>}
                    {c.phone && <div>{c.phone}</div>}
                    {c.email && <div>{c.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 text-xs font-semibold rounded ${
                        c.isActive
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStatus(c)}
                      className={`text-xs font-semibold hover:underline ${
                        c.isActive ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {c.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-md w-full space-y-4 border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold">{editingCarrier ? "Edit Carrier" : "Add Carrier"}</h3>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DHL, FEDEX, LOCAL-01"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full p-2 text-sm border rounded-lg bg-white dark:bg-zinc-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DHL Express Worldwide"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 text-sm border rounded-lg bg-white dark:bg-zinc-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Carrier Type
                </label>
                <select
                  value={carrierType}
                  onChange={(e) => setCarrierType(e.target.value as CarrierType)}
                  className="w-full p-2 text-sm border rounded-lg bg-white dark:bg-zinc-800"
                >
                  <option value="COURIER">Courier</option>
                  <option value="TRANSPORT_COMPANY">Transport Company</option>
                  <option value="FREIGHT_FORWARDER">Freight Forwarder</option>
                  <option value="INTERNAL">Internal Transport</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full p-2 text-sm border rounded-lg bg-white dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2 text-sm border rounded-lg bg-white dark:bg-zinc-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tracking URL Template
                </label>
                <input
                  type="text"
                  placeholder="https://track.carrier.com?id={{trackingNumber}}"
                  value={trackingUrlTemplate}
                  onChange={(e) => setTrackingUrlTemplate(e.target.value)}
                  className="w-full p-2 text-sm border rounded-lg bg-white dark:bg-zinc-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 border rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Carrier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
