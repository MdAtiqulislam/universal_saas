/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { QualityInspectionLot } from "../types/quality.types";
import { qualityApi } from "../api/quality-api";
import { InspectionExecutionModal } from "./inspection-execution-modal";

export function InspectionLotsPanel() {
  const [lots, setLots] = useState<QualityInspectionLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadLots = useCallback(async () => {
    setLoading(true);
    try {
      const data = await qualityApi.getInspectionLots({
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setLots(data);
    } catch (err) {
      console.error("Failed to load inspection lots", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    void loadLots();
  }, [statusFilter, loadLots]);

  const handleOpenExecution = (lotId: string) => {
    setSelectedLotId(lotId);
    setIsModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "IN_PROGRESS":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "COMPLETED":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "DECIDED":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getDecisionBadge = (decision?: string | null) => {
    if (!decision) return null;
    switch (decision) {
      case "ACCEPT":
      case "ACCEPT_WITH_DEVIATION":
        return "bg-emerald-500/15 text-emerald-700 font-bold border-emerald-500/30";
      case "REJECT":
      case "SCRAP":
      case "RETURN_TO_SUPPLIER":
        return "bg-red-500/15 text-red-700 font-bold border-red-500/30";
      case "REWORK":
      case "HOLD":
        return "bg-amber-500/15 text-amber-700 font-bold border-amber-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex flex-1 gap-2 items-center">
          <input
            type="text"
            placeholder="Search lot number, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void loadLots()}
            className="w-full sm:w-72 px-3 py-1.5 text-xs border rounded-lg bg-background"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border rounded-lg bg-background"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="DECIDED">Decided</option>
          </select>
          <button
            onClick={() => void loadLots()}
            className="px-3 py-1.5 text-xs font-medium border rounded-lg hover:bg-muted"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 border-b text-muted-foreground">
              <tr>
                <th className="p-3">Lot #</th>
                <th className="p-3">Type</th>
                <th className="p-3">Item / SKU</th>
                <th className="p-3">Warehouse / Location</th>
                <th className="p-3 text-right">Total Qty</th>
                <th className="p-3 text-right">Sample Qty</th>
                <th className="p-3 text-right">Passed / Failed</th>
                <th className="p-3">Status</th>
                <th className="p-3">Decision</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    Loading inspection lots...
                  </td>
                </tr>
              ) : lots.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    No quality inspection lots found.
                  </td>
                </tr>
              ) : (
                lots.map((lot) => (
                  <tr key={lot.id} className="hover:bg-muted/20 transition">
                    <td className="p-3 font-mono font-medium">{lot.lotNumber}</td>
                    <td className="p-3">
                      <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded">
                        {lot.inspectionType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">{lot.item?.name}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {lot.item?.sku}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {lot.warehouse?.code} / {lot.location?.code}
                    </td>
                    <td className="p-3 text-right font-medium">{lot.totalQuantity}</td>
                    <td className="p-3 text-right font-medium">{lot.sampleQuantity}</td>
                    <td className="p-3 text-right font-medium">
                      <span className="text-emerald-600">{lot.passedQuantity}</span> /{" "}
                      <span className="text-red-600">{lot.failedQuantity}</span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(
                          lot.status,
                        )}`}
                      >
                        {lot.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {lot.decision ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] border ${getDecisionBadge(
                            lot.decision,
                          )}`}
                        >
                          {lot.decision.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleOpenExecution(lot.id)}
                        className={`px-3 py-1 rounded text-xs font-semibold transition ${
                          lot.status === "DECIDED"
                            ? "border hover:bg-muted text-foreground"
                            : "bg-primary text-primary-foreground hover:opacity-90"
                        }`}
                      >
                        {lot.status === "DECIDED" ? "View Lot" : "Inspect"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Execution Modal */}
      {selectedLotId && (
        <InspectionExecutionModal
          lotId={selectedLotId}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedLotId(null);
          }}
          onSuccess={() => {
            void loadLots();
          }}
        />
      )}
    </div>
  );
}
