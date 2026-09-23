"use client";

import React, { useState, useEffect } from "react";
import { WebhookSubscription } from "./types";
import { getWebhooks, createWebhook, deleteWebhook } from "./api";

export function WebhooksPanel() {
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [eventsStr, setEventsStr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getWebhooks();
      setWebhooks(data);
    } catch {
      setError("Failed to load webhook subscriptions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    getWebhooks()
      .then((data) => {
        if (!ignore) {
          setWebhooks(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setError("Failed to load webhook subscriptions");
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !endpoint) return;

    if (!endpoint.startsWith("https://")) {
      setError("Webhook endpoint must use HTTPS protocol");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const subscribedEvents = eventsStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await createWebhook({
        name,
        endpoint,
        subscribedEvents: subscribedEvents.length > 0 ? subscribedEvents : ["*"],
      });
      setShowModal(false);
      setName("");
      setEndpoint("");
      setEventsStr("");
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create webhook subscription");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this webhook subscription?")) return;
    try {
      await deleteWebhook(id);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete webhook");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
            Active
          </span>
        );
      case "FAILED":
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
            Failed
          </span>
        );
      case "INACTIVE":
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
            Inactive
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Webhook Subscriptions</h2>
          <p className="text-sm text-gray-500">
            Deliver real-time platform events to external endpoints
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm"
        >
          Add Subscription
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading webhooks...</div>
      ) : webhooks.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-sm text-gray-500">No outbound webhook subscriptions configured yet.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Create your first subscription
          </button>
        </div>
      ) : (
        <div className="overflow-hidden border border-gray-200 rounded-lg shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Subscription
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Endpoint
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Events
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Failures
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {webhooks.map((sub) => (
                <tr key={sub.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{sub.name}</div>
                    <div className="text-xs text-gray-400">
                      {sub.lastDeliveredAt
                        ? `Last delivered: ${new Date(sub.lastDeliveredAt).toLocaleString()}`
                        : "Never delivered"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div
                      className="text-sm font-mono text-gray-600 max-w-xs truncate"
                      title={sub.endpoint}
                    >
                      {sub.endpoint}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {sub.subscribedEvents.slice(0, 3).map((e) => (
                        <span
                          key={e}
                          className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded"
                        >
                          {e}
                        </span>
                      ))}
                      {sub.subscribedEvents.length > 3 && (
                        <span className="text-xs text-gray-400">
                          +{sub.subscribedEvents.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(sub.status)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {sub.failureCount > 0 ? (
                      <span className="text-red-600 font-medium">{sub.failureCount}</span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => handleDelete(sub.id)}
                      className="text-red-600 hover:text-red-900 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Add Webhook Subscription</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Subscription Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. ERP Sync Webhook"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Endpoint URL (HTTPS only)
                </label>
                <input
                  type="url"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  required
                  placeholder="https://api.external.com/webhooks/listener"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Subscribed Events (comma-separated)
                </label>
                <input
                  type="text"
                  value={eventsStr}
                  onChange={(e) => setEventsStr(e.target.value)}
                  placeholder="e.g. sales.order.created, customer.updated"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank to subscribe to all platform events (*)
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Subscription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
