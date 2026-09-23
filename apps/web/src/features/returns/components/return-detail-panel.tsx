/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { returnsApi } from "../api/returns-api";
import { ReturnRequest } from "../types/returns.types";

interface ReturnDetailPanelProps {
  returnId: string;
  onBack: () => void;
}

export const ReturnDetailPanel: React.FC<ReturnDetailPanelProps> = ({ returnId, onBack }) => {
  const [rma, setRma] = useState<ReturnRequest | null>(null);
  const [activeTab, setActiveTab] = useState<
    "lines" | "receiving" | "inspection" | "disposition" | "resolutions"
  >("lines");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Receiving state
  const [recWarehouseId, setRecWarehouseId] = useState("");
  const [recLocationId, setRecLocationId] = useState("");
  const [recNotes, setRecNotes] = useState("");

  // Inspection state
  const [inspWarehouseId, setInspWarehouseId] = useState("");
  const [inspLocationId, setInspLocationId] = useState("");

  // Disposition state
  const [dispLineId, setDispLineId] = useState("");
  const [dispType, setDispType] = useState("RESTOCK");
  const [dispQty, setDispQty] = useState(1);
  const [dispWarehouseId, setDispWarehouseId] = useState("");
  const [dispLocationId, setDispLocationId] = useState("");

  // Resolution state
  const [resType, setResType] = useState<"CREDIT_NOTE" | "REFUND" | "DEBIT_NOTE" | "REPLACEMENT">(
    "CREDIT_NOTE",
  );
  const [resAmount, setResAmount] = useState(0);
  const [resQty, setResQty] = useState(1);
  const [resLineId, setResLineId] = useState("");

  const loadRma = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await returnsApi.getReturn(returnId);
      setRma(data);
      if (data.lines.length > 0) {
        setDispLineId(data.lines[0].id);
        setResLineId(data.lines[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load return details");
    } finally {
      setLoading(false);
    }
  }, [returnId]);

  useEffect(() => {
    loadRma();
  }, [loadRma]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-slate-500">Loading RMA details...</div>
      </div>
    );
  }

  if (error || !rma) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="text-sm text-red-600">Error: {error || "Return request not found"}</div>
        <button
          onClick={onBack}
          className="mt-4 rounded-lg bg-slate-800 px-4 py-1.5 text-xs text-white"
        >
          ← Back to List
        </button>
      </div>
    );
  }

  // Action Handlers
  const handleLifecycleAction = async (action: "submit" | "review" | "authorize" | "close") => {
    try {
      setLoading(true);
      if (action === "submit") await returnsApi.submitReturn(rma.id);
      if (action === "review")
        await returnsApi.reviewReturn(rma.id, { reviewNotes: "Review initiated" });
      if (action === "authorize")
        await returnsApi.authorizeReturn(rma.id, { authorizationNotes: "Authorized" });
      if (action === "close") await returnsApi.closeReturn(rma.id);
      await loadRma();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to ${action} RMA`);
      setLoading(false);
    }
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await returnsApi.receiveReturn(rma.id, {
        warehouseId: recWarehouseId,
        locationId: recLocationId,
        receivingNotes: recNotes,
        items: rma.lines.map((l) => ({
          lineId: l.id,
          receivedQuantity: Number(l.authorizedQuantity || l.requestedQuantity),
        })),
      });
      await loadRma();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to receive returned items");
      setLoading(false);
    }
  };

  const handleRequestInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await returnsApi.requestInspection(rma.id, {
        warehouseId: inspWarehouseId,
        locationId: inspLocationId,
      });
      await loadRma();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to request inspection");
      setLoading(false);
    }
  };

  const handleSyncInspection = async () => {
    try {
      setLoading(true);
      await returnsApi.syncInspection(rma.id);
      await loadRma();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sync inspection");
      setLoading(false);
    }
  };

  const handleCreateDisposition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await returnsApi.createDispositions(rma.id, {
        dispositions: [
          {
            returnLineId: dispLineId,
            dispositionType: dispType,
            quantity: Number(dispQty),
            warehouseId: dispWarehouseId,
            locationId: dispLocationId,
          },
        ],
      });
      await loadRma();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create disposition");
      setLoading(false);
    }
  };

  const handleCreateResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (resType === "CREDIT_NOTE") {
        await returnsApi.createCreditNote(rma.id, {
          returnLineId: resLineId || undefined,
          amount: Number(resAmount),
          quantity: Number(resQty),
        });
      } else if (resType === "REFUND") {
        await returnsApi.createRefund(rma.id, {
          returnLineId: resLineId || undefined,
          amount: Number(resAmount),
        });
      } else if (resType === "DEBIT_NOTE") {
        await returnsApi.createDebitNote(rma.id, {
          returnLineId: resLineId || undefined,
          amount: Number(resAmount),
          quantity: Number(resQty),
        });
      } else if (resType === "REPLACEMENT") {
        await returnsApi.createReplacement(rma.id, {
          returnLineId: resLineId,
          quantity: Number(resQty),
        });
      }
      await loadRma();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create resolution");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Back
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">{rma.returnNumber}</h2>
              <span
                className={`inline-flex rounded-full px-3 py-0.5 text-xs font-semibold ${
                  rma.status === "CLOSED" || rma.status === "RESOLVED"
                    ? "bg-emerald-100 text-emerald-800"
                    : rma.status === "REJECTED" ||
                        rma.status === "CANCELLED" ||
                        rma.status === "VOIDED"
                      ? "bg-red-100 text-red-800"
                      : rma.status === "AUTHORIZED" || rma.status === "RECEIVED"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-amber-100 text-amber-800"
                }`}
              >
                {rma.status}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {rma.returnType.replace("_", " ")} • Reason: {rma.reason.name} • Requested:{" "}
              {new Date(rma.requestedAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Header Lifecycle Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {rma.status === "DRAFT" && (
            <button
              onClick={() => handleLifecycleAction("submit")}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Submit RMA
            </button>
          )}

          {(rma.status === "DRAFT" || rma.status === "SUBMITTED") && (
            <button
              onClick={() => handleLifecycleAction("review")}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Start Review
            </button>
          )}

          {(rma.status === "UNDER_REVIEW" ||
            rma.status === "SUBMITTED" ||
            rma.status === "DRAFT") && (
            <button
              onClick={() => handleLifecycleAction("authorize")}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Authorize Return
            </button>
          )}

          {rma.status === "RESOLVED" && (
            <button
              onClick={() => handleLifecycleAction("close")}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
            >
              Close RMA (Lock)
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-4 text-xs text-red-600">{error}</div>}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-500 uppercase">Customer / Supplier</span>
          <p className="mt-1 font-semibold text-slate-900">
            {rma.customer?.name ?? rma.supplier?.name ?? "Internal"}
          </p>
          <span className="text-xs text-slate-400">
            {rma.customer
              ? `Customer Code: ${rma.customer.code}`
              : rma.supplier
                ? `Supplier Code: ${rma.supplier.code}`
                : ""}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-500 uppercase">Source Reference</span>
          <p className="mt-1 font-semibold text-slate-900">
            {rma.salesOrder?.orderNumber ??
              rma.purchaseOrder?.poNumber ??
              rma.shipment?.shipmentNumber ??
              "—"}
          </p>
          <span className="text-xs text-slate-400">
            {rma.deliveryOrder?.deliveryNumber
              ? `DO: ${rma.deliveryOrder.deliveryNumber}`
              : rma.goodsReceipt?.receiptNumber
                ? `GR: ${rma.goodsReceipt.receiptNumber}`
                : "Direct RMA"}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-500 uppercase">Inspection Lot</span>
          <p className="mt-1 font-semibold text-slate-900">
            {rma.inspectionLot ? rma.inspectionLot.lotNumber : "None"}
          </p>
          <span className="text-xs text-slate-400">
            {rma.inspectionLot?.decision
              ? `Decision: ${rma.inspectionLot.decision}`
              : rma.inspectionLot
                ? "Inspection In Progress"
                : "No Lot Created"}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs text-slate-500 uppercase">Immutability</span>
          <p className="mt-1 font-semibold text-slate-900">
            {rma.isImmutable ? "LOCKED (Immutable)" : "Open (Editable)"}
          </p>
          <span className="text-xs text-slate-400">
            Resolutions: {rma.resolutions.length} • Dispositions: {rma.dispositions.length}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6">
          {(["lines", "receiving", "inspection", "disposition", "resolutions"] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 py-3 text-sm font-semibold capitalize ${
                  activeTab === tab
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                }`}
              >
                {tab === "lines"
                  ? `Item Lines (${rma.lines.length})`
                  : tab === "receiving"
                    ? "Warehouse Receiving"
                    : tab === "inspection"
                      ? "Quality Inspection"
                      : tab === "disposition"
                        ? `Dispositions (${rma.dispositions.length})`
                        : `Resolutions (${rma.resolutions.length})`}
              </button>
            ),
          )}
        </nav>
      </div>

      {/* Tab 1: Item Lines */}
      {activeTab === "lines" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Item / SKU</th>
                  <th className="px-6 py-3">Requested</th>
                  <th className="px-6 py-3">Authorized</th>
                  <th className="px-6 py-3">Received</th>
                  <th className="px-6 py-3">Inspected</th>
                  <th className="px-6 py-3">Accepted</th>
                  <th className="px-6 py-3">Rejected</th>
                  <th className="px-6 py-3">UnitPrice</th>
                  <th className="px-6 py-3">Total Amount</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rma.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-6 py-3">
                      <div className="font-semibold text-slate-900">
                        {line.item?.name ?? line.itemId}
                      </div>
                      <div className="text-xs text-slate-400">SKU: {line.item?.sku ?? "—"}</div>
                    </td>
                    <td className="px-6 py-3 font-medium">{String(line.requestedQuantity)}</td>
                    <td className="px-6 py-3 font-medium text-indigo-600">
                      {String(line.authorizedQuantity)}
                    </td>
                    <td className="px-6 py-3">{String(line.receivedQuantity)}</td>
                    <td className="px-6 py-3">{String(line.inspectedQuantity)}</td>
                    <td className="px-6 py-3 font-medium text-emerald-600">
                      {String(line.acceptedQuantity)}
                    </td>
                    <td className="px-6 py-3 font-medium text-red-600">
                      {String(line.rejectedQuantity)}
                    </td>
                    <td className="px-6 py-3">${Number(line.unitPrice).toFixed(2)}</td>
                    <td className="px-6 py-3 font-semibold text-slate-900">
                      ${Number(line.lineAmount).toFixed(2)}
                    </td>
                    <td className="px-6 py-3">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {line.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Warehouse Receiving */}
      {activeTab === "receiving" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900">Receive Returned Material</h3>
          <p className="text-xs text-slate-500">
            Route incoming returned physical inventory into return or quarantine locations.
          </p>

          <form onSubmit={handleReceive} className="mt-4 max-w-xl space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Warehouse Location UUID *
                </label>
                <input
                  type="text"
                  placeholder="Warehouse UUID"
                  value={recWarehouseId}
                  onChange={(e) => setRecWarehouseId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Bin / Quarantine Location UUID *
                </label>
                <input
                  type="text"
                  placeholder="Quarantine Bin UUID"
                  value={recLocationId}
                  onChange={(e) => setRecLocationId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Receiving Notes</label>
              <textarea
                rows={2}
                placeholder="Physical box condition, seal status, carrier notes..."
                value={recNotes}
                onChange={(e) => setRecNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || rma.isImmutable}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              Post Warehouse Receipt
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: Quality Inspection */}
      {activeTab === "inspection" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">M31 Quality Inspection Lot</h3>
                <p className="text-xs text-slate-500">
                  Execute QA inspection plans and sync lot decisions directly into RMA lines.
                </p>
              </div>
              {rma.inspectionLotId && (
                <button
                  type="button"
                  onClick={handleSyncInspection}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Sync Inspection Lot Decision
                </button>
              )}
            </div>

            {rma.inspectionLot ? (
              <div className="mt-4 rounded-lg bg-slate-50 p-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <span className="text-xs text-slate-500">Lot Number</span>
                    <p className="font-semibold text-slate-900">{rma.inspectionLot.lotNumber}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Status</span>
                    <p className="font-semibold text-slate-900">{rma.inspectionLot.status}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Decision</span>
                    <p className="font-semibold text-indigo-600">
                      {rma.inspectionLot.decision ?? "PENDING"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRequestInspection} className="mt-4 max-w-xl space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Warehouse UUID *
                    </label>
                    <input
                      type="text"
                      placeholder="Warehouse Location UUID"
                      value={inspWarehouseId}
                      onChange={(e) => setInspWarehouseId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Inspection Area UUID *
                    </label>
                    <input
                      type="text"
                      placeholder="Inspection Bay UUID"
                      value={inspLocationId}
                      onChange={(e) => setInspLocationId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || rma.isImmutable}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  Create Inspection Lot
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Dispositions */}
      {activeTab === "disposition" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900">Record Material Disposition</h3>
            <p className="text-xs text-slate-500">
              Execute disposition actions: Restock, Scrap, Repair, Rework, Replace, Return to
              Supplier.
            </p>

            <form onSubmit={handleCreateDisposition} className="mt-4 max-w-2xl space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Line *</label>
                  <select
                    value={dispLineId}
                    onChange={(e) => setDispLineId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    required
                  >
                    {rma.lines.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.item?.sku ?? l.itemId} (Accepted: {String(l.acceptedQuantity)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Disposition Type *
                  </label>
                  <select
                    value={dispType}
                    onChange={(e) => setDispType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  >
                    <option value="RESTOCK">RESTOCK</option>
                    <option value="SCRAP">SCRAP</option>
                    <option value="REWORK">REWORK</option>
                    <option value="REPAIR">REPAIR</option>
                    <option value="REPLACE">REPLACE</option>
                    <option value="RETURN_TO_SUPPLIER">RETURN TO SUPPLIER</option>
                    <option value="REJECT_RETURN">REJECT RETURN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Quantity *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={dispQty}
                    onChange={(e) => setDispQty(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Destination Warehouse UUID *
                  </label>
                  <input
                    type="text"
                    placeholder="Warehouse Location UUID"
                    value={dispWarehouseId}
                    onChange={(e) => setDispWarehouseId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Destination Bin UUID *
                  </label>
                  <input
                    type="text"
                    placeholder="Location Bin UUID"
                    value={dispLocationId}
                    onChange={(e) => setDispLocationId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || rma.isImmutable}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                Execute Disposition
              </button>
            </form>
          </div>

          {/* Existing Dispositions List */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h4 className="text-sm font-semibold text-slate-900">Executed Disposition Records</h4>
            </div>
            <div className="divide-y divide-slate-100">
              {rma.dispositions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No dispositions executed yet.
                </div>
              ) : (
                rma.dispositions.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-4 text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{d.dispositionType}</span> • Qty:{" "}
                      {String(d.quantity)}
                      <div className="text-slate-500">
                        Processed: {new Date(d.processedAt).toLocaleString()}
                      </div>
                    </div>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                      Completed
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Financial Resolutions */}
      {activeTab === "resolutions" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900">
              Process Financial & Fulfillment Resolution
            </h3>
            <p className="text-xs text-slate-500">
              Issue M18 Credit Notes, M18/M15 Refunds, M18 Debit Notes, or M28 Replacements.
            </p>

            <form onSubmit={handleCreateResolution} className="mt-4 max-w-2xl space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Resolution Type *
                  </label>
                  <select
                    value={resType}
                    onChange={(e) =>
                      setResType(
                        e.target.value as unknown as
                          "CREDIT_NOTE" | "REFUND" | "DEBIT_NOTE" | "REPLACEMENT",
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  >
                    <option value="CREDIT_NOTE">CREDIT NOTE (Customer)</option>
                    <option value="REFUND">REFUND (Customer)</option>
                    <option value="DEBIT_NOTE">DEBIT NOTE (Supplier)</option>
                    <option value="REPLACEMENT">REPLACEMENT ORDER</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Target Line (Optional)
                  </label>
                  <select
                    value={resLineId}
                    onChange={(e) => setResLineId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  >
                    <option value="">Whole RMA</option>
                    {rma.lines.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.item?.sku ?? l.itemId}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Amount ($) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={resAmount}
                    onChange={(e) => setResAmount(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Quantity (Units)
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={resQty}
                    onChange={(e) => setResQty(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || rma.isImmutable}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                Create Resolution
              </button>
            </form>
          </div>

          {/* Resolutions History */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h4 className="text-sm font-semibold text-slate-900">Recorded Resolutions</h4>
            </div>
            <div className="divide-y divide-slate-100">
              {rma.resolutions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No resolutions recorded yet.
                </div>
              ) : (
                rma.resolutions.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-4 text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{r.resolutionType}</span> • Amount:
                      ${Number(r.amount).toFixed(2)}
                      <div className="text-slate-500">
                        {r.customerCreditNote
                          ? `CRN: ${r.customerCreditNote.creditNoteNumber}`
                          : r.customerRefund
                            ? `Refund: ${r.customerRefund.refundNumber}`
                            : r.supplierDebitNote
                              ? `DBN: ${r.supplierDebitNote.debitNoteNumber}`
                              : ""}
                      </div>
                    </div>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                      RESOLVED
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
