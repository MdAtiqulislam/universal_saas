"use client";

import React, { useState, useEffect } from "react";
import { ApiKey } from "./types";
import { getApiKeys, createApiKey, revokeApiKey } from "./api";

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [scopesStr, setScopesStr] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getApiKeys();
      setKeys(data);
    } catch {
      setError("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    getApiKeys()
      .then((data) => {
        if (!ignore) {
          setKeys(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setError("Failed to load API keys");
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    try {
      setSubmitting(true);
      setError(null);
      const scopes = scopesStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const created = await createApiKey({ name, scopes });
      setNewlyCreatedKey(created.rawKey);
      setName("");
      setScopesStr("");
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this API key? This cannot be undone.")) return;
    try {
      await revokeApiKey(id);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to revoke key");
    }
  };

  const copyToClipboard = () => {
    if (!newlyCreatedKey) return;
    navigator.clipboard.writeText(newlyCreatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
          <p className="text-sm text-gray-500">
            Programmatic access credentials for automated systems
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm"
        >
          Generate New Key
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading API keys...</div>
      ) : keys.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-sm text-gray-500">No active API keys found.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Create an API key
          </button>
        </div>
      ) : (
        <div className="overflow-hidden border border-gray-200 rounded-lg shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Key Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Prefix
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Scopes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Last Used
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{k.name}</div>
                    <div className="text-xs text-gray-400">
                      Created {new Date(k.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-800">
                      {k.keyPrefix}...
                    </code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {k.scopes.length > 0 ? (
                        k.scopes.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded"
                          >
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">All scopes</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => handleRevoke(k.id)}
                      className="text-red-600 hover:text-red-900 font-medium"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create Key */}
      {showModal && !newlyCreatedKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Generate New API Key</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Key Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. CI/CD Deployment Token"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Scopes (comma-separated)
                </label>
                <input
                  type="text"
                  value={scopesStr}
                  onChange={(e) => setScopesStr(e.target.value)}
                  placeholder="e.g. orders.read, webhooks.manage"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to grant full organization access
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
                  {submitting ? "Generating..." : "Generate Key"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Show Newly Created Key */}
      {newlyCreatedKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">API Key Created</h3>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
              <strong>Important:</strong> Store this key securely now. For your security, this key
              will never be shown again.
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={newlyCreatedKey}
                className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-mono select-all focus:outline-none"
              />
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium rounded-md whitespace-nowrap"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => {
                  setNewlyCreatedKey(null);
                  setShowModal(false);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md"
              >
                I Have Saved This Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
