/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { QualityInspectionLot, InspectionDecision } from "../types/quality.types";
import { qualityApi } from "../api/quality-api";

interface ModalProps {
  lotId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InspectionExecutionModal({ lotId, isOpen, onClose, onSuccess }: ModalProps) {
  const [lot, setLot] = useState<QualityInspectionLot | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"results" | "decision">("results");
  const [resultsForm, setResultsForm] = useState<
    Record<string, { value?: string; isPass: boolean; notes?: string }>
  >({});
  const [decision, setDecision] = useState<InspectionDecision>("ACCEPT");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [createNcr, setCreateNcr] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await qualityApi.getInspectionLot(lotId);
      setLot(data);

      const initialMap: Record<string, { value?: string; isPass: boolean; notes?: string }> = {};
      if (data.results) {
        for (const r of data.results) {
          const key = `${r.characteristicId}_${r.sampleNumber}`;
          initialMap[key] = {
            value:
              r.observedNumericValue !== undefined && r.observedNumericValue !== null
                ? String(r.observedNumericValue)
                : r.observedTextValue || "",
            isPass: r.isPass,
            notes: r.notes || "",
          };
        }
      }
      setResultsForm(initialMap);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load inspection lot");
    } finally {
      setLoading(false);
    }
  }, [lotId]);

  useEffect(() => {
    if (isOpen && lotId) {
      void loadLot();
    }
  }, [isOpen, lotId, loadLot]);

  const handleNumericChange = (
    charId: string,
    sampleNum: number,
    valStr: string,
    minSpec?: number | string | null,
    maxSpec?: number | string | null,
  ) => {
    const key = `${charId}_${sampleNum}`;
    const num = parseFloat(valStr);
    let pass = true;
    if (!isNaN(num)) {
      if (minSpec !== null && minSpec !== undefined && num < Number(minSpec)) {
        pass = false;
      }
      if (maxSpec !== null && maxSpec !== undefined && num > Number(maxSpec)) {
        pass = false;
      }
    } else {
      pass = false;
    }

    setResultsForm((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        value: valStr,
        isPass: pass,
      },
    }));
  };

  const handleSaveResults = async () => {
    if (!lot) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = Object.entries(resultsForm).map(([k, item]) => {
        const [charId, sampleNumStr] = k.split("_");
        const numVal = parseFloat(item.value || "");
        return {
          characteristicId: charId,
          sampleNumber: parseInt(sampleNumStr, 10),
          observedNumericValue: !isNaN(numVal) ? numVal : undefined,
          observedTextValue: isNaN(numVal) ? item.value : undefined,
          isPass: item.isPass,
          notes: item.notes,
        };
      });

      await qualityApi.recordInspectionResults(lot.id, payload);
      await loadLot();
      setActiveTab("decision");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save inspection results");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMakeDecision = async () => {
    if (!lot) return;
    setSubmitting(true);
    setError(null);
    try {
      await qualityApi.decideInspectionLot(lot.id, {
        decision,
        decisionNotes,
        createNcrOnFailure: createNcr,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to finalize decision");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const characteristics = lot?.inspectionPlan?.characteristics || [];
  const sampleQty = lot ? Number(lot.sampleQuantity) : 1;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-muted/20">
          <div>
            <h2 className="text-lg font-bold">
              Inspection Execution: {lot?.lotNumber || "Loading..."}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Item: {lot?.item?.sku} — {lot?.item?.name} | Total Qty: {lot?.totalQuantity} |
              Samples: {lot?.sampleQuantity}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>

        {/* Modal Body Tabs */}
        <div className="flex border-b px-6 bg-muted/10">
          <button
            onClick={() => setActiveTab("results")}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition ${
              activeTab === "results"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            1. Record Sample Results
          </button>
          <button
            onClick={() => setActiveTab("decision")}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition ${
              activeTab === "decision"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            2. Disposition & Final Decision
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500 text-red-600 text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* Tab Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading lot details...
            </div>
          ) : activeTab === "results" ? (
            <div className="space-y-6">
              {characteristics.length === 0 ? (
                <div className="p-6 text-center border border-dashed rounded-lg text-sm text-muted-foreground">
                  No inspection characteristics attached to this lot plan. You can proceed directly
                  to disposition.
                </div>
              ) : (
                <div className="space-y-6">
                  {characteristics.map((char) => (
                    <div key={char.id} className="border rounded-lg p-4 bg-muted/10 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-2">
                            <span>{char.name}</span>
                            <span className="text-xs font-mono text-muted-foreground">
                              ({char.code})
                            </span>
                            {char.isMandatory && (
                              <span className="text-[10px] bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded font-medium">
                                MANDATORY
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Type: {char.dataType}
                            {char.unitOfMeasure && ` | Unit: ${char.unitOfMeasure}`}
                            {char.minSpec !== null && ` | Min: ${char.minSpec}`}
                            {char.maxSpec !== null && ` | Max: ${char.maxSpec}`}
                            {char.targetValue !== null && ` | Target: ${char.targetValue}`}
                          </div>
                        </div>
                      </div>

                      {/* Samples Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-muted-foreground text-left">
                              <th className="pb-1 w-20">Sample #</th>
                              <th className="pb-1 w-44">Observed Value</th>
                              <th className="pb-1 w-28">Result</th>
                              <th className="pb-1">Notes / Deviation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: Math.min(sampleQty, 20) }).map((_, idx) => {
                              const sNum = idx + 1;
                              const key = `${char.id}_${sNum}`;
                              const cur = resultsForm[key] || {
                                value: "",
                                isPass: true,
                                notes: "",
                              };

                              return (
                                <tr key={sNum} className="border-b border-muted/50">
                                  <td className="py-2 font-mono font-medium">Sample {sNum}</td>
                                  <td className="py-2 pr-2">
                                    {char.dataType === "QUALITATIVE_PASS_FAIL" ? (
                                      <select
                                        disabled={lot?.isImmutable}
                                        value={cur.isPass ? "PASS" : "FAIL"}
                                        onChange={(e) =>
                                          setResultsForm((prev) => ({
                                            ...prev,
                                            [key]: {
                                              ...prev[key],
                                              isPass: e.target.value === "PASS",
                                            },
                                          }))
                                        }
                                        className="w-full border rounded px-2 py-1 bg-background text-xs"
                                      >
                                        <option value="PASS">Pass / Conforms</option>
                                        <option value="FAIL">Fail / Non-Conforming</option>
                                      </select>
                                    ) : (
                                      <input
                                        type={char.dataType === "NUMERIC_VALUE" ? "number" : "text"}
                                        step="any"
                                        disabled={lot?.isImmutable}
                                        value={cur.value || ""}
                                        placeholder={
                                          char.dataType === "NUMERIC_VALUE"
                                            ? "Enter measurement"
                                            : "Observation"
                                        }
                                        onChange={(e) => {
                                          if (char.dataType === "NUMERIC_VALUE") {
                                            handleNumericChange(
                                              char.id,
                                              sNum,
                                              e.target.value,
                                              char.minSpec,
                                              char.maxSpec,
                                            );
                                          } else {
                                            setResultsForm((prev) => ({
                                              ...prev,
                                              [key]: {
                                                ...prev[key],
                                                value: e.target.value,
                                              },
                                            }));
                                          }
                                        }}
                                        className="w-full border rounded px-2 py-1 bg-background text-xs"
                                      />
                                    )}
                                  </td>
                                  <td className="py-2 pr-2">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] ${
                                        cur.isPass
                                          ? "bg-emerald-500/10 text-emerald-600"
                                          : "bg-red-500/10 text-red-600"
                                      }`}
                                    >
                                      {cur.isPass ? "PASS" : "FAIL"}
                                    </span>
                                  </td>
                                  <td className="py-2">
                                    <input
                                      type="text"
                                      disabled={lot?.isImmutable}
                                      value={cur.notes || ""}
                                      placeholder="Optional remarks"
                                      onChange={(e) =>
                                        setResultsForm((prev) => ({
                                          ...prev,
                                          [key]: {
                                            ...prev[key],
                                            notes: e.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full border rounded px-2 py-1 bg-background text-xs"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 max-w-xl">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Authoritative Inspection Disposition
                </label>
                <select
                  disabled={lot?.isImmutable}
                  value={decision}
                  onChange={(e) => setDecision(e.target.value as InspectionDecision)}
                  className="w-full border rounded-lg px-3 py-2 bg-background text-sm font-medium"
                >
                  <option value="ACCEPT">ACCEPT (Full Release to Stock)</option>
                  <option value="ACCEPT_WITH_DEVIATION">ACCEPT WITH DEVIATION (Conditional)</option>
                  <option value="REWORK">REWORK (Internal Rework Required)</option>
                  <option value="HOLD">HOLD (Quarantine & Isolate)</option>
                  <option value="REJECT">REJECT (Rejection / NCR)</option>
                  <option value="SCRAP">SCRAP (Write-Off & Destroy)</option>
                  <option value="RETURN_TO_SUPPLIER">RETURN TO SUPPLIER (RTV / Debit Note)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Disposition Notes & Rationale
                </label>
                <textarea
                  rows={4}
                  disabled={lot?.isImmutable}
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder="Explain justification for decision, deviation approvals, or root cause summary..."
                  className="w-full border rounded-lg p-3 bg-background text-xs"
                />
              </div>

              {decision !== "ACCEPT" && (
                <div className="p-4 border rounded-lg bg-amber-500/10 border-amber-500/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="createNcrCheck"
                      disabled={lot?.isImmutable}
                      checked={createNcr}
                      onChange={(e) => setCreateNcr(e.target.checked)}
                      className="rounded"
                    />
                    <label
                      htmlFor="createNcrCheck"
                      className="text-xs font-semibold cursor-pointer"
                    >
                      Automatically create Non-Conformance Report (NCR)
                    </label>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    If selected, a formal NCR record will be opened for containment and CAPA
                    escalation.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t bg-muted/20 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium border rounded-lg hover:bg-muted"
          >
            Close
          </button>

          {!lot?.isImmutable && (
            <div className="flex gap-2">
              {activeTab === "results" ? (
                <button
                  disabled={submitting}
                  onClick={handleSaveResults}
                  className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
                >
                  {submitting ? "Saving..." : "Save Results & Proceed to Decision"}
                </button>
              ) : (
                <button
                  disabled={submitting}
                  onClick={handleMakeDecision}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                >
                  {submitting ? "Submitting..." : "Post Final Disposition Decision"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
