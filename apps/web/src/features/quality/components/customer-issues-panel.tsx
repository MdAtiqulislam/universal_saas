/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CustomerQualityIssue } from "../types/quality.types";
import { qualityApi } from "../api/quality-api";

export function CustomerIssuesPanel() {
  const [issues, setIssues] = useState<CustomerQualityIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<CustomerQualityIssue | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const data = await qualityApi.getCustomerIssues();
      setIssues(data);
    } catch (err) {
      console.error("Failed to load customer quality issues", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIssues();
  }, [loadIssues]);

  const handleResolve = async () => {
    if (!selectedIssue) return;
    try {
      await qualityApi.resolveCustomerIssue(selectedIssue.id, resolutionNotes);
      setIsResolveModalOpen(false);
      setSelectedIssue(null);
      setResolutionNotes("");
      void loadIssues();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to resolve customer issue");
    }
  };

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 border-b text-muted-foreground">
              <tr>
                <th className="p-3">Issue #</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Item / SKU</th>
                <th className="p-3">Issue Description</th>
                <th className="p-3">Severity</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Loading customer quality issues...
                  </td>
                </tr>
              ) : issues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No customer quality issues reported.
                  </td>
                </tr>
              ) : (
                issues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-muted/20 transition">
                    <td className="p-3 font-mono font-medium">{issue.issueNumber}</td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">{issue.customer?.name}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {issue.customer?.code}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {issue.item?.name} ({issue.item?.sku})
                    </td>
                    <td className="p-3 text-muted-foreground line-clamp-2 max-w-sm">
                      {issue.issueDescription}
                    </td>
                    <td className="p-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-muted">
                        {issue.severity}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          issue.status === "RESOLVED" || issue.status === "CLOSED"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {issue.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {issue.status !== "RESOLVED" && issue.status !== "CLOSED" && (
                        <button
                          onClick={() => {
                            setSelectedIssue(issue);
                            setIsResolveModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 transition"
                        >
                          Resolve Issue
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

      {/* Resolve Dialog */}
      {isResolveModalOpen && selectedIssue && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold">
              Resolve Customer Issue ({selectedIssue.issueNumber})
            </h3>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Resolution Actions Taken
              </label>
              <textarea
                rows={3}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="RMA issued, replacement dispatched, process updated..."
                className="w-full border rounded-lg p-2.5 text-xs bg-background"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsResolveModalOpen(false)}
                className="px-3 py-1.5 text-xs border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleResolve()}
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Complete Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
