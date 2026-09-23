"use client";

import React, { useEffect, useState } from "react";
import { crmApi } from "../api/crm-api";
import { Opportunity, OpportunityStage } from "../types/crm.types";

const PIPELINE_STAGES: { key: OpportunityStage; label: string; color: string }[] = [
  { key: "PROSPECTING", label: "Prospecting", color: "border-t-blue-400 bg-blue-50/20" },
  { key: "QUALIFICATION", label: "Qualification", color: "border-t-indigo-400 bg-indigo-50/20" },
  { key: "NEEDS_ANALYSIS", label: "Needs Analysis", color: "border-t-purple-400 bg-purple-50/20" },
  { key: "PROPOSAL", label: "Proposal", color: "border-t-amber-400 bg-amber-50/20" },
  { key: "NEGOTIATION", label: "Negotiation", color: "border-t-orange-400 bg-orange-50/20" },
  { key: "CLOSED_WON", label: "Closed Won", color: "border-t-emerald-500 bg-emerald-50/20" },
  { key: "CLOSED_LOST", label: "Closed Lost", color: "border-t-red-400 bg-red-50/20" },
];

export const CrmOpportunityKanban: React.FC = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick Action Modal
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReason, setLostReason] = useState("");

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const fetchOpportunities = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await crmApi.listOpportunities();
      setOpportunities(data);
    } catch (err: any) {
      setError(err.message || "Failed to load opportunities");
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = async (id: string, newStage: OpportunityStage) => {
    try {
      await crmApi.changeOpportunityStage(id, { stage: newStage });
      fetchOpportunities();
    } catch (err: any) {
      alert(`Error updating stage: ${err.message}`);
    }
  };

  const handleCloseWon = async (id: string) => {
    try {
      await crmApi.closeOpportunityWon(id, {});
      fetchOpportunities();
    } catch (err: any) {
      alert(`Error closing opportunity: ${err.message}`);
    }
  };

  const handleCloseLost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpp) return;
    try {
      await crmApi.closeOpportunityLost(selectedOpp.id, { lostReason });
      setShowLostModal(false);
      setSelectedOpp(null);
      setLostReason("");
      fetchOpportunities();
    } catch (err: any) {
      alert(`Error marking opportunity lost: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header telemetry */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Commercial Pipeline Board</h2>
          <p className="text-xs text-gray-500">
            Interactive deal tracking across sales milestones with real-time probability weighted
            value
          </p>
        </div>
        <button
          onClick={fetchOpportunities}
          className="px-3 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Refresh Board
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-lg">
          Loading visual pipeline...
        </div>
      ) : error ? (
        <div className="p-6 text-center text-red-600 bg-red-50 rounded-lg">{error}</div>
      ) : (
        /* Kanban Board Container */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((col) => {
            const stageOpps = opportunities.filter((o) => o.stage === col.key);
            const totalVal = stageOpps.reduce((sum, o) => sum + Number(o.estimatedValue || 0), 0);

            return (
              <div
                key={col.key}
                className={`flex flex-col rounded-lg border border-gray-200 border-t-4 p-3 min-w-[240px] max-w-[320px] ${col.color}`}
              >
                {/* Stage Header */}
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200/60">
                  <span className="font-semibold text-xs text-gray-800 uppercase tracking-wider">
                    {col.label}
                  </span>
                  <span className="bg-white px-2 py-0.5 rounded-full text-xs font-bold text-gray-600 shadow-2xs">
                    {stageOpps.length}
                  </span>
                </div>

                <div className="text-xs font-bold text-gray-700 mb-3">
                  ${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>

                {/* Cards List */}
                <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[650px] pr-1">
                  {stageOpps.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-400 italic">
                      No active deals
                    </div>
                  ) : (
                    stageOpps.map((opp) => (
                      <div
                        key={opp.id}
                        className="bg-white p-3 rounded-md shadow-xs border border-gray-200 hover:shadow-md transition-shadow duration-150 space-y-2"
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-[11px] font-bold text-indigo-600">
                            {opp.opportunityNumber}
                          </span>
                          <span className="text-[10px] font-semibold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                            {Number(opp.probability)}% prob
                          </span>
                        </div>

                        <div className="font-semibold text-xs text-gray-900 line-clamp-2">
                          {opp.title}
                        </div>

                        <div className="text-xs text-gray-500 truncate">
                          🏢 {opp.customer?.name || "Customer"}
                        </div>

                        <div className="text-xs font-bold text-gray-900 pt-1 border-t border-gray-100 flex justify-between items-center">
                          <span>
                            $
                            {Number(opp.estimatedValue).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          {opp.expectedCloseDate && (
                            <span className="text-[10px] text-gray-400 font-normal">
                              📅 {new Date(opp.expectedCloseDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {/* Stage Progression Controls */}
                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-1 text-[11px]">
                          <select
                            value={opp.stage}
                            onChange={(e) =>
                              handleStageChange(opp.id, e.target.value as OpportunityStage)
                            }
                            className="text-[11px] py-0.5 px-1 border border-gray-200 rounded text-gray-700 bg-gray-50 w-full"
                          >
                            {PIPELINE_STAGES.map((s) => (
                              <option key={s.key} value={s.key}>
                                Move to {s.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {opp.stage !== "CLOSED_WON" && opp.stage !== "CLOSED_LOST" && (
                          <div className="flex justify-end gap-1 pt-1">
                            <button
                              onClick={() => handleCloseWon(opp.id)}
                              className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded"
                            >
                              ✓ Won
                            </button>
                            <button
                              onClick={() => {
                                setSelectedOpp(opp);
                                setShowLostModal(true);
                              }}
                              className="px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-700 hover:bg-red-100 rounded"
                            >
                              ✕ Lost
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lost Reason Modal */}
      {showLostModal && selectedOpp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Mark Opportunity as Lost</h3>
            <p className="text-xs text-gray-500">
              Deal:{" "}
              <span className="font-semibold">
                {selectedOpp.opportunityNumber} - {selectedOpp.title}
              </span>
            </p>
            <form onSubmit={handleCloseLost} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">Lost Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  placeholder="Price too high, feature gap, chose competitor..."
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLostModal(false)}
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
