/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { returnsApi } from "../api/returns-api";

export const ReturnPolicyPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [returnWindowDays, setReturnWindowDays] = useState(30);
  const [requireInspection, setRequireInspection] = useState(true);
  const [autoQuarantine, setAutoQuarantine] = useState(true);
  const [allowPartialReturns, setAllowPartialReturns] = useState(true);
  const [allowRestocking, setAllowRestocking] = useState(true);
  const [autoCreateCreditNote, setAutoCreateCreditNote] = useState(false);
  const [maxReplacementQty, setMaxReplacementQty] = useState(100);

  const loadPolicy = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await returnsApi.getPolicy();
      setReturnWindowDays(data.returnWindowDays);
      setRequireInspection(data.requireInspection);
      setAutoQuarantine(data.autoQuarantine);
      setAllowPartialReturns(data.allowPartialReturns);
      setAllowRestocking(data.allowRestocking);
      setAutoCreateCreditNote(data.autoCreateCreditNote);
      setMaxReplacementQty(Number(data.maxReplacementQty));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load policy");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPolicy();
  }, [loadPolicy]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await returnsApi.updatePolicy({
        returnWindowDays: Number(returnWindowDays),
        requireInspection,
        autoQuarantine,
        allowPartialReturns,
        allowRestocking,
        autoCreateCreditNote,
        maxReplacementQty: Number(maxReplacementQty),
      });
      setSuccess("Return policy updated successfully!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update policy");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-slate-500">Loading return policy rules...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Tenant Return Policy & Rules</h2>
        <p className="text-sm text-slate-500">
          Configure return eligibility windows, auto-quarantine, inspection gating, and financial
          resolution defaults.
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-4 text-xs text-red-600">{error}</div>}

      {success && (
        <div className="rounded-lg bg-emerald-50 p-4 text-xs text-emerald-600">{success}</div>
      )}

      <form
        onSubmit={handleSave}
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Return Window (Days) *
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={returnWindowDays}
              onChange={(e) => setReturnWindowDays(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500"
              required
            />
            <p className="mt-1 text-xs text-slate-400">
              Maximum allowable days from customer delivery or supplier receipt.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Max Replacement Quantity Cap *
            </label>
            <input
              type="number"
              min={0}
              value={maxReplacementQty}
              onChange={(e) => setMaxReplacementQty(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500"
              required
            />
            <p className="mt-1 text-xs text-slate-400">
              Max units permitted for instant replacement without executive escalation.
            </p>
          </div>
        </div>

        {/* Checkbox Options */}
        <div className="space-y-4 border-t border-slate-100 pt-6">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={requireInspection}
              onChange={(e) => setRequireInspection(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <div>
              <div className="text-xs font-semibold text-slate-900">Mandate Quality Inspection</div>
              <div className="text-xs text-slate-500">
                Gate all returned materials with M31 quality inspection lots before releasing to
                restock.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={autoQuarantine}
              onChange={(e) => setAutoQuarantine(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <div>
              <div className="text-xs font-semibold text-slate-900">Auto-Quarantine on Receipt</div>
              <div className="text-xs text-slate-500">
                Automatically route incoming returns into dedicated quarantine warehouse locations.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={allowPartialReturns}
              onChange={(e) => setAllowPartialReturns(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <div>
              <div className="text-xs font-semibold text-slate-900">Allow Partial Returns</div>
              <div className="text-xs text-slate-500">
                Permit customers or suppliers to return partial quantities of delivered lines.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={allowRestocking}
              onChange={(e) => setAllowRestocking(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <div>
              <div className="text-xs font-semibold text-slate-900">
                Allow Restocking into Active Inventory
              </div>
              <div className="text-xs text-slate-500">
                Allow accepted returned items to be restored to active inventory bins at current
                valuation.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={autoCreateCreditNote}
              onChange={(e) => setAutoCreateCreditNote(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <div>
              <div className="text-xs font-semibold text-slate-900">
                Auto-Create Draft Credit Note
              </div>
              <div className="text-xs text-slate-500">
                Automatically generate draft M18 credit note upon return authorization.
              </div>
            </div>
          </label>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving Policy..." : "Save Policy Changes"}
          </button>
        </div>
      </form>
    </div>
  );
};
