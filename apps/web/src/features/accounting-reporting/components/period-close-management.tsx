/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState } from "react";
import { FiscalPeriod, PeriodCloseExecutionSummary } from "../types/accounting-reporting.types";
import { accountingReportingApi } from "../api/accounting-reporting-api";

export function PeriodCloseManagement() {
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected period for validation or close
  const [selectedPeriod, setSelectedPeriod] = useState<FiscalPeriod | null>(null);
  const [validationSummary, setValidationSummary] = useState<PeriodCloseExecutionSummary | null>(
    null,
  );
  const [validating, setValidating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Reopen modal state
  const [reopenModalPeriod, setReopenModalPeriod] = useState<FiscalPeriod | null>(null);
  const [reopenReason, setReopenReason] = useState("");

  // Create Period Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newYear, setNewYear] = useState<number>(new Date().getFullYear());
  const [newPeriodNum, setNewPeriodNum] = useState<number>(1);

  const loadPeriods = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await accountingReportingApi.listPeriods();
      setPeriods(data.periods);
      if (data.periods.length > 0 && !selectedPeriod) {
        setSelectedPeriod(data.periods[0]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load periods");
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  async function handleValidateClose(period: FiscalPeriod) {
    try {
      setValidating(true);
      setError(null);
      const summary = await accountingReportingApi.validateClose(period.id);
      setValidationSummary(summary);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setValidating(false);
    }
  }

  async function handleClosePeriod(period: FiscalPeriod) {
    if (
      !confirm(
        `Are you sure you want to permanently close ${period.name}? Closed periods reject all financial mutations.`,
      )
    ) {
      return;
    }
    try {
      setActionLoading(true);
      setError(null);
      await accountingReportingApi.closePeriod(period.id);
      await loadPeriods();
      setValidationSummary(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to close period");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReopenPeriod() {
    if (!reopenModalPeriod || !reopenReason || reopenReason.length < 5) return;
    try {
      setActionLoading(true);
      setError(null);
      await accountingReportingApi.reopenPeriod(reopenModalPeriod.id, { reason: reopenReason });
      setReopenModalPeriod(null);
      setReopenReason("");
      await loadPeriods();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reopen period");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCreatePeriod(e: React.FormEvent) {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError(null);
      await accountingReportingApi.createPeriod({
        name: newName,
        startDate: newStartDate,
        endDate: newEndDate,
        fiscalYear: newYear,
        periodNumber: newPeriodNum,
      });
      setCreateModalOpen(false);
      setNewName("");
      setNewStartDate("");
      setNewEndDate("");
      await loadPeriods();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create period");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Accounting Period Close & Control</h3>
          <p className="text-xs text-slate-500">
            Manage fiscal calendar, deterministic pre-close checks, and period immutability locks.
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          + New Accounting Period
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Main Grid: Periods List & Close Control Runner */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Periods List */}
        <div className="space-y-3 lg:col-span-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Accounting Periods
          </h4>
          <div className="space-y-2">
            {periods.map((period) => (
              <div
                key={period.id}
                onClick={() => {
                  setSelectedPeriod(period);
                  setValidationSummary(null);
                }}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  selectedPeriod?.id === period.id
                    ? "border-indigo-500 bg-indigo-50/50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{period.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      period.status === "OPEN"
                        ? "bg-emerald-100 text-emerald-800"
                        : period.status === "CLOSING"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {period.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 font-mono">
                  {period.startDate.slice(0, 10)} &rarr; {period.endDate.slice(0, 10)}
                </p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                  <span>{period._count?.journalEntries || 0} Journals</span>
                  {period.status === "CLOSED" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setReopenModalPeriod(period);
                      }}
                      className="font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      Reopen...
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Close Runner & Diagnostic Matrix */}
        <div className="space-y-4 lg:col-span-2">
          {selectedPeriod ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
                <div>
                  <h4 className="text-base font-bold text-slate-900">{selectedPeriod.name}</h4>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedPeriod.startDate.slice(0, 10)} to {selectedPeriod.endDate.slice(0, 10)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleValidateClose(selectedPeriod)}
                    disabled={validating || actionLoading}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                  >
                    {validating ? "Evaluating 11 Checks..." : "Run Pre-Close Checks"}
                  </button>
                  {selectedPeriod.status !== "CLOSED" && (
                    <button
                      onClick={() => handleClosePeriod(selectedPeriod)}
                      disabled={actionLoading || validating}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700"
                    >
                      Close Period Permanently
                    </button>
                  )}
                </div>
              </div>

              {/* Validation Summary & Diagnostic Checks */}
              {validationSummary && (
                <div className="mt-5 space-y-4">
                  <div
                    className={`rounded-xl p-4 text-xs font-medium border ${
                      validationSummary.canClose
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-red-200 bg-red-50 text-red-800"
                    }`}
                  >
                    <p className="font-bold">{validationSummary.summaryMessage}</p>
                  </div>

                  <div className="space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Evaluated Close Checks ({validationSummary.checks.length})
                    </h5>
                    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {validationSummary.checks.map((check, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 text-xs">
                          <div>
                            <span className="font-semibold text-slate-900">{check.checkType}</span>
                            <p className="text-slate-500 mt-0.5">{check.message}</p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              check.status === "PASSED"
                                ? "bg-emerald-100 text-emerald-800"
                                : check.status === "WARNING"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {check.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Closed Audit Info */}
              {selectedPeriod.status === "CLOSED" && (
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  <p className="font-bold text-slate-800">Closed Period Audit Trail</p>
                  <p className="mt-1">
                    Closed At: <span className="font-mono">{selectedPeriod.closedAt || "—"}</span>
                  </p>
                  {selectedPeriod.reopenedAt && (
                    <div className="mt-2 text-indigo-700">
                      <p>Last Reopened: {selectedPeriod.reopenedAt}</p>
                      <p>Reason: {selectedPeriod.reopenReason}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
              Select an accounting period to review readiness.
            </div>
          )}
        </div>
      </div>

      {/* Reopen Modal */}
      {reopenModalPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Reopen Accounting Period: {reopenModalPeriod.name}
            </h3>
            <p className="text-xs text-slate-500">
              Reopening a closed period allows posting transactions into this historical timeframe.
              A mandatory audit justification reason is required.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Audit Justification Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Explain why this closed period must be unlocked (min 5 characters)..."
                rows={3}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setReopenModalPeriod(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReopenPeriod}
                disabled={reopenReason.trim().length < 5 || actionLoading}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Confirm Reopen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Period Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleCreatePeriod}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900">Create Accounting Period</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Period Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FY2026-Q1, 2026-01-JAN"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fiscal Year</label>
                  <input
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Period Number</label>
                  <input
                    type="number"
                    value={newPeriodNum}
                    onChange={(e) => setNewPeriodNum(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Create Period
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
