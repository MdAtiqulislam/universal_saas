"use client";

import React, { useState } from "react";
import { Shipment, ShipmentCarrier } from "../types/shipping.types";
import { TrackingTimeline } from "./tracking-timeline";
import { shippingApi } from "../api/shipping-api";

interface ShipmentDetailProps {
  shipment: Shipment;
  carriers: ShipmentCarrier[];
  onBack: () => void;
  onRefresh: () => void;
}

export function ShipmentDetail({ shipment, carriers, onBack, onRefresh }: ShipmentDetailProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals / Input states
  const [assignCarrierId, setAssignCarrierId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [activeModal, setActiveModal] = useState<
    "assign" | "dispatch" | "fail" | "return" | "cancel" | null
  >(null);

  const handleAction = async (actionFn: () => Promise<unknown>) => {
    try {
      setLoading(true);
      setError(null);
      await actionFn();
      setActiveModal(null);
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-1"
          >
            ← Back to Shipments
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {shipment.shipmentNumber}
            </h1>
            <span className="px-2.5 py-1 text-xs font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
              {shipment.status}
            </span>
          </div>
        </div>

        {/* Lifecycle Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {shipment.status === "DRAFT" && (
            <button
              type="button"
              disabled={loading}
              onClick={() => handleAction(() => shippingApi.prepareShipment(shipment.id))}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              Mark Ready
            </button>
          )}

          {(shipment.status === "DRAFT" ||
            shipment.status === "READY" ||
            shipment.status === "ASSIGNED") && (
            <button
              type="button"
              onClick={() => setActiveModal("assign")}
              className="px-3 py-1.5 bg-zinc-800 dark:bg-zinc-700 text-white rounded-lg text-xs font-semibold hover:bg-zinc-900"
            >
              Assign Carrier
            </button>
          )}

          {(shipment.status === "READY" || shipment.status === "ASSIGNED") && (
            <button
              type="button"
              onClick={() => setActiveModal("dispatch")}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
            >
              Dispatch Shipment
            </button>
          )}

          {shipment.status === "DISPATCHED" && (
            <button
              type="button"
              disabled={loading}
              onClick={() => handleAction(() => shippingApi.markInTransit(shipment.id))}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              Mark In Transit
            </button>
          )}

          {(shipment.status === "DISPATCHED" || shipment.status === "IN_TRANSIT") && (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleAction(() => shippingApi.markDelivered(shipment.id))}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                Confirm Delivery
              </button>
              <button
                type="button"
                onClick={() => setActiveModal("fail")}
                className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700"
              >
                Report Failure
              </button>
            </>
          )}

          {(shipment.status === "FAILED" || shipment.status === "IN_TRANSIT") && (
            <button
              type="button"
              onClick={() => setActiveModal("return")}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700"
            >
              Initiate Return
            </button>
          )}

          {(shipment.status === "DELIVERED" ||
            shipment.status === "RETURNED" ||
            shipment.status === "FAILED") && (
            <button
              type="button"
              disabled={loading}
              onClick={() => handleAction(() => shippingApi.closeShipment(shipment.id))}
              className="px-3 py-1.5 bg-zinc-600 text-white rounded-lg text-xs font-semibold hover:bg-zinc-700 disabled:opacity-50"
            >
              Close Shipment
            </button>
          )}

          {(shipment.status === "DRAFT" ||
            shipment.status === "READY" ||
            shipment.status === "ASSIGNED") && (
            <button
              type="button"
              onClick={() => setActiveModal("cancel")}
              className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold hover:bg-zinc-300"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Info Grids */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
          <p className="text-xs font-semibold text-zinc-400">Order & Customer</p>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Customer: {shipment.customer?.name || "—"}
          </p>
          <p className="text-xs text-zinc-500">
            Delivery Order: {shipment.deliveryOrder?.deliveryNumber || shipment.deliveryOrderId}
          </p>
          {shipment.specialInstructions && (
            <p className="text-xs text-zinc-500 italic mt-2">
              Note: {shipment.specialInstructions}
            </p>
          )}
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
          <p className="text-xs font-semibold text-zinc-400">Carrier & Logistics</p>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Carrier: {shipment.carrier?.name || "Unassigned"}
          </p>
          <p className="text-xs text-zinc-500">Tracking #: {shipment.trackingNumber || "—"}</p>
          <p className="text-xs text-zinc-500">Service: {shipment.serviceType || "STANDARD"}</p>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
          <p className="text-xs font-semibold text-zinc-400">Logistics Costs</p>
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Total: ${Number(shipment.totalLogisticsCost).toFixed(2)}
          </p>
          <p className="text-xs text-zinc-500">
            Shipping: ${Number(shipment.shippingCost).toFixed(2)} | Ins: $
            {Number(shipment.insuranceCost).toFixed(2)} | Other: $
            {Number(shipment.otherCost).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Shipment Lines Table */}
      <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Shipment Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
              <tr>
                <th className="py-2">Item SKU / Name</th>
                <th className="py-2">Quantity</th>
                <th className="py-2">Package Ref</th>
                <th className="py-2">Batch / Serial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {shipment.lines?.map((line) => (
                <tr key={line.id}>
                  <td className="py-2 font-medium text-zinc-900 dark:text-zinc-100">
                    {line.item ? `${line.item.sku} - ${line.item.name}` : line.itemId}
                  </td>
                  <td className="py-2">{Number(line.quantity).toFixed(2)}</td>
                  <td className="py-2 text-zinc-500">{line.packageReference || "—"}</td>
                  <td className="py-2 text-zinc-500">
                    {line.batchReference || line.serialReference || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tracking Timeline */}
      <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Tracking Timeline</h3>
        <TrackingTimeline events={shipment.trackingEvents || []} />
      </div>

      {/* Assign Carrier Modal */}
      {activeModal === "assign" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-md w-full space-y-4 border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold">Assign Carrier</h3>
            <select
              value={assignCarrierId}
              onChange={(e) => setAssignCarrierId(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-zinc-800"
            >
              <option value="">Select Carrier...</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Tracking Number (optional)"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-zinc-800"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 border rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!assignCarrierId || loading}
                onClick={() =>
                  handleAction(() =>
                    shippingApi.assignCarrier(shipment.id, {
                      carrierId: assignCarrierId,
                      trackingNumber: trackingNumber || undefined,
                    }),
                  )
                }
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {activeModal === "dispatch" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-md w-full space-y-4 border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold">Dispatch Shipment</h3>
            <input
              type="text"
              placeholder="Tracking Number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-zinc-800"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 border rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  handleAction(() =>
                    shippingApi.dispatchShipment(shipment.id, {
                      trackingNumber: trackingNumber || undefined,
                    }),
                  )
                }
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fail Modal */}
      {activeModal === "fail" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-md w-full space-y-4 border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold">Record Delivery Failure</h3>
            <textarea
              placeholder="Failure reason (e.g. customer unavailable, incorrect address)..."
              value={failureReason}
              onChange={(e) => setFailureReason(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-zinc-800 h-24"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 border rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!failureReason || loading}
                onClick={() =>
                  handleAction(() => shippingApi.markFailed(shipment.id, { failureReason }))
                }
                className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                Submit Failure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {activeModal === "return" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-md w-full space-y-4 border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold">Initiate Return</h3>
            <textarea
              placeholder="Return reason (e.g. refused by customer, damaged goods)..."
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-zinc-800 h-24"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 border rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!returnReason || loading}
                onClick={() =>
                  handleAction(() => shippingApi.initiateReturn(shipment.id, { returnReason }))
                }
                className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {activeModal === "cancel" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-md w-full space-y-4 border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold">Cancel Shipment</h3>
            <textarea
              placeholder="Cancellation reason..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-zinc-800 h-24"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 border rounded-lg text-xs"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!cancellationReason || loading}
                onClick={() =>
                  handleAction(() =>
                    shippingApi.cancelShipment(shipment.id, { cancellationReason }),
                  )
                }
                className="px-3 py-1.5 bg-zinc-800 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
