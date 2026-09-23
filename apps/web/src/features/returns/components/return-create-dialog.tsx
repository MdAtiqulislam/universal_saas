/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { returnsApi } from "../api/returns-api";
import { ReturnType, ReturnReason } from "../types/returns.types";

interface ReturnCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (returnId: string) => void;
}

export const ReturnCreateDialog: React.FC<ReturnCreateDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [returnType, setReturnType] = useState<ReturnType>("CUSTOMER_RETURN");
  const [reasons, setReasons] = useState<ReturnReason[]>([]);
  const [reasonId, setReasonId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [salesOrderId, setSalesOrderId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [notes, setNotes] = useState("");

  // Line Items
  const [lines, setLines] = useState<Array<{ itemId: string; requestedQuantity: number }>>([
    { itemId: "", requestedQuantity: 1 },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReasons = useCallback(async () => {
    try {
      const data = await returnsApi.listReasons();
      setReasons(data.filter((r) => r.isActive));
      if (data.length > 0) setReasonId(data[0].id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load reasons");
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadReasons();
    }
  }, [isOpen, loadReasons]);

  if (!isOpen) return null;

  const handleAddLine = () => {
    setLines([...lines, { itemId: "", requestedQuantity: 1 }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: string, value: unknown) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const payload: Record<string, unknown> = {
        returnType,
        reasonId,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          requestedQuantity: Number(l.requestedQuantity),
        })),
      };

      if (returnType === "SUPPLIER_RETURN") {
        if (!supplierId) throw new Error("Supplier ID is required for supplier returns");
        payload.supplierId = supplierId;
        if (purchaseOrderId) payload.purchaseOrderId = purchaseOrderId;
      } else {
        if (!customerId) throw new Error("Customer ID is required for customer returns");
        payload.customerId = customerId;
        if (salesOrderId) payload.salesOrderId = salesOrderId;
      }

      const created = await returnsApi.createReturn(payload);
      onSuccess(created.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create return request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Create Return Request (RMA)</h3>
            <p className="text-xs text-slate-500">
              Initiate a formal Return Merchandise Authorization
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</div>}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Return Type & Reason */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Return Type *</label>
              <select
                value={returnType}
                onChange={(e) => setReturnType(e.target.value as ReturnType)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500"
              >
                <option value="CUSTOMER_RETURN">CUSTOMER RETURN</option>
                <option value="SUPPLIER_RETURN">SUPPLIER RETURN</option>
                <option value="INTERNAL_RETURN">INTERNAL RETURN</option>
                <option value="WARRANTY_RETURN">WARRANTY RETURN</option>
                <option value="REPLACEMENT_RETURN">REPLACEMENT RETURN</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Return Reason *</label>
              <select
                value={reasonId}
                onChange={(e) => setReasonId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500"
                required
              >
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Context References */}
          {returnType === "SUPPLIER_RETURN" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Supplier UUID *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Purchase Order UUID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Optional linked PO ID"
                  value={purchaseOrderId}
                  onChange={(e) => setPurchaseOrderId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Customer UUID *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Sales Order UUID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Optional linked Sales Order ID"
                  value={salesOrderId}
                  onChange={(e) => setSalesOrderId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Reason Notes & Justification
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detail reasons for return, condition of goods, or customer comments..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500"
            />
          </div>

          {/* Line Items */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-700">Item Lines</span>
              <button
                type="button"
                onClick={handleAddLine}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                + Add Item
              </button>
            </div>

            {lines.map((line, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Item UUID"
                    value={line.itemId}
                    onChange={(e) => handleLineChange(idx, "itemId", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="w-28">
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="Qty"
                    value={line.requestedQuantity}
                    onChange={(e) =>
                      handleLineChange(idx, "requestedQuantity", Number(e.target.value))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500"
                    required
                  />
                </div>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Dialog Actions */}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Creating RMA..." : "Create RMA"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
