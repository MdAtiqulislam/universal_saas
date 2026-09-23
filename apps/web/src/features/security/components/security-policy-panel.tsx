"use client";

import React, { useState, useEffect } from "react";
import { securityApi } from "../api/security-api";
import { SecurityPolicyConfig } from "../types/security.types";

export function SecurityPolicyPanel() {
  const [policy, setPolicy] = useState<SecurityPolicyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchPolicy = async () => {
    setLoading(true);
    try {
      const data = await securityApi.getPolicy();
      setPolicy(data);
    } catch (err: any) {
      alert(err.message || "Failed to load policy");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicy();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await securityApi.updatePolicy({
        maxFailedLogins: Number(policy.maxFailedLogins),
        lockoutDurationMinutes: Number(policy.lockoutDurationMinutes),
        sessionLifetimeHours: Number(policy.sessionLifetimeHours),
        sessionIdleTimeoutMinutes: Number(policy.sessionIdleTimeoutMinutes),
        passwordMinLength: Number(policy.passwordMinLength),
        passwordRequireUppercase: Boolean(policy.passwordRequireUppercase),
        passwordRequireNumbers: Boolean(policy.passwordRequireNumbers),
        passwordRequireSymbols: Boolean(policy.passwordRequireSymbols),
        apiRateLimitPerMinute: Number(policy.apiRateLimitPerMinute),
        mfaEnforced: Boolean(policy.mfaEnforced),
      });
      setPolicy(updated);
      setMessage("Security policy updated and audited successfully.");
    } catch (err: any) {
      alert(err.message || "Failed to update policy");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !policy) {
    return <div className="p-8 text-center text-gray-500">Loading policy configurations...</div>;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6 max-w-3xl"
    >
      <div>
        <h3 className="text-base font-bold text-gray-900">Tenant Security Policies & Parameters</h3>
        <p className="text-xs text-gray-500">
          Control brute force lockout thresholds, token expiration, password complexity, and API
          rate limits.
        </p>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Lockout Controls */}
        <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <h4 className="font-semibold text-gray-800">Authentication & Lockout</h4>
          <div>
            <label className="block text-gray-600 mb-1">Max Failed Logins Before Lockout</label>
            <input
              type="number"
              min="1"
              max="20"
              value={policy.maxFailedLogins}
              onChange={(e) => setPolicy({ ...policy, maxFailedLogins: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded px-3 py-1.5 bg-white"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">Lockout Duration (Minutes)</label>
            <input
              type="number"
              min="1"
              max="1440"
              value={policy.lockoutDurationMinutes}
              onChange={(e) =>
                setPolicy({ ...policy, lockoutDurationMinutes: Number(e.target.value) })
              }
              className="w-full border border-gray-300 rounded px-3 py-1.5 bg-white"
            />
          </div>
        </div>

        {/* Session Lifetime */}
        <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <h4 className="font-semibold text-gray-800">Session & Device Lifetime</h4>
          <div>
            <label className="block text-gray-600 mb-1">Absolute Session Lifetime (Hours)</label>
            <input
              type="number"
              min="1"
              max="720"
              value={policy.sessionLifetimeHours}
              onChange={(e) =>
                setPolicy({ ...policy, sessionLifetimeHours: Number(e.target.value) })
              }
              className="w-full border border-gray-300 rounded px-3 py-1.5 bg-white"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">Idle Timeout (Minutes)</label>
            <input
              type="number"
              min="5"
              max="1440"
              value={policy.sessionIdleTimeoutMinutes}
              onChange={(e) =>
                setPolicy({ ...policy, sessionIdleTimeoutMinutes: Number(e.target.value) })
              }
              className="w-full border border-gray-300 rounded px-3 py-1.5 bg-white"
            />
          </div>
        </div>

        {/* Password Complexity */}
        <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-100 md:col-span-2">
          <h4 className="font-semibold text-gray-800">Password Policy & Complexity</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-600 mb-1">Minimum Password Length</label>
              <input
                type="number"
                min="8"
                max="64"
                value={policy.passwordMinLength}
                onChange={(e) =>
                  setPolicy({ ...policy, passwordMinLength: Number(e.target.value) })
                }
                className="w-full border border-gray-300 rounded px-3 py-1.5 bg-white"
              />
            </div>
            <div>
              <label className="block text-gray-600 mb-1">API Rate Limit (Req/Min/Tenant)</label>
              <input
                type="number"
                min="10"
                max="10000"
                value={policy.apiRateLimitPerMinute}
                onChange={(e) =>
                  setPolicy({ ...policy, apiRateLimitPerMinute: Number(e.target.value) })
                }
                className="w-full border border-gray-300 rounded px-3 py-1.5 bg-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={policy.passwordRequireUppercase}
                onChange={(e) =>
                  setPolicy({ ...policy, passwordRequireUppercase: e.target.checked })
                }
              />
              <span>Require Uppercase Letters</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={policy.passwordRequireNumbers}
                onChange={(e) => setPolicy({ ...policy, passwordRequireNumbers: e.target.checked })}
              />
              <span>Require Numbers</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={policy.passwordRequireSymbols}
                onChange={(e) => setPolicy({ ...policy, passwordRequireSymbols: e.target.checked })}
              />
              <span>Require Special Symbols</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={policy.mfaEnforced}
                onChange={(e) => setPolicy({ ...policy, mfaEnforced: e.target.checked })}
              />
              <span className="font-semibold text-indigo-700">
                Enforce Multi-Factor Authentication (MFA)
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving Policy..." : "Save & Enforce Policies"}
        </button>
      </div>
    </form>
  );
}
