/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { QualityConfiguration, SamplingPlan } from "../types/quality.types";
import { qualityApi } from "../api/quality-api";

export function QualityConfigPanel() {
  const [config, setConfig] = useState<QualityConfiguration | null>(null);
  const [samplingPlans, setSamplingPlans] = useState<SamplingPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgData, spData] = await Promise.all([
        qualityApi.getConfig(),
        qualityApi.getSamplingPlans(),
      ]);
      setConfig(cfgData);
      setSamplingPlans(spData);
    } catch (err) {
      console.error("Failed to load quality configuration", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setSuccess(false);
    try {
      const updated = await qualityApi.updateConfig({
        defaultInspectionType: config.defaultInspectionType,
        autoCreateIncomingLots: config.autoCreateIncomingLots,
        autoCreateFinishedGoodsLots: config.autoCreateFinishedGoodsLots,
        autoCreateOutgoingLots: config.autoCreateOutgoingLots,
        holdOnFailure: config.holdOnFailure,
        requireAllMandatoryCharacteristics: config.requireAllMandatoryCharacteristics,
        defaultSamplingPlanId: config.defaultSamplingPlanId,
      });
      setConfig(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save config", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">Loading configuration...</div>
    );
  }

  return (
    <div className="max-w-2xl bg-card border rounded-xl p-6 space-y-6">
      <div>
        <h3 className="text-base font-bold">Organization Quality Policies & Automation</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure default inspection strategies, automated lot creation triggers, and hold
          enforcement rules.
        </p>
      </div>

      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs rounded-lg">
          Quality configuration updated successfully.
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">
            Default Inspection Type
          </label>
          <select
            value={config.defaultInspectionType}
            onChange={(e) =>
              setConfig({
                ...config,
                defaultInspectionType: e.target
                  .value as QualityConfiguration["defaultInspectionType"],
              })
            }
            className="w-full border rounded-lg px-3 py-2 text-xs bg-background"
          >
            <option value="INCOMING_PURCHASE">INCOMING PURCHASE</option>
            <option value="GOODS_RECEIPT">GOODS RECEIPT</option>
            <option value="IN_PROCESS_MANUFACTURING">IN-PROCESS MANUFACTURING</option>
            <option value="FINISHED_GOODS">FINISHED GOODS</option>
            <option value="OUTGOING_SHIPMENT">OUTGOING SHIPMENT</option>
            <option value="CUSTOMER_RETURN">CUSTOMER RETURN</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">
            Default Sampling Plan Formula
          </label>
          <select
            value={config.defaultSamplingPlanId || ""}
            onChange={(e) =>
              setConfig({
                ...config,
                defaultSamplingPlanId: e.target.value ? e.target.value : null,
              })
            }
            className="w-full border rounded-lg px-3 py-2 text-xs bg-background"
          >
            <option value="">100% Full Inspection (Default)</option>
            {samplingPlans.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name} ({sp.code} - {sp.samplingType})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-xs">Automatic Quality Hold on Failure</div>
              <div className="text-[11px] text-muted-foreground">
                Automatically place inventory on quality hold & isolate stock when an inspection lot
                fails.
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.holdOnFailure}
              onChange={(e) => setConfig({ ...config, holdOnFailure: e.target.checked })}
              className="rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-xs">Enforce Mandatory Characteristic Testing</div>
              <div className="text-[11px] text-muted-foreground">
                Block disposition decisions until all mandatory plan characteristics are recorded.
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.requireAllMandatoryCharacteristics}
              onChange={(e) =>
                setConfig({
                  ...config,
                  requireAllMandatoryCharacteristics: e.target.checked,
                })
              }
              className="rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-xs">Auto-Create Lots on Goods Receipts</div>
              <div className="text-[11px] text-muted-foreground">
                Automatically generate incoming inspection lots whenever purchase goods are
                received.
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.autoCreateIncomingLots}
              onChange={(e) => setConfig({ ...config, autoCreateIncomingLots: e.target.checked })}
              className="rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-xs">Auto-Create Lots on Production Completion</div>
              <div className="text-[11px] text-muted-foreground">
                Automatically generate finished goods inspection lots when manufacturing orders
                finish.
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.autoCreateFinishedGoodsLots}
              onChange={(e) =>
                setConfig({
                  ...config,
                  autoCreateFinishedGoodsLots: e.target.checked,
                })
              }
              className="rounded"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t flex justify-end">
        <button
          disabled={saving}
          onClick={() => void handleSave()}
          className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
        >
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>
    </div>
  );
}
