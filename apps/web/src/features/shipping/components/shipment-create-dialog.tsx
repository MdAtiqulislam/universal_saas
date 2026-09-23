"use client";

import React, { useState } from "react";
import { ShipmentCarrier } from "../types/shipping.types";
import { shippingApi } from "../api/shipping-api";

interface ShipmentCreateDialogProps {
  carriers: ShipmentCarrier[];
  onClose: () => void;
  onCreated: () => void;
}

export function ShipmentCreateDialog({ carriers, onClose, onCreated }: ShipmentCreateDialogProps) {
  const [deliveryOrderId, setDeliveryOrderId] = useState("");
  const [carrierId, setCarrierId] = useState("");
  const [serviceType, setServiceType] = useState("STANDARD");
  const [plannedShipDate, setPlannedShipDate] = useState("");
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState("");
  const [shippingCost, setShippingCost] = useState("0");
  const [insuranceCost, setInsuranceCost] = useState("0");
  const [otherCost, setOtherCost] = useState("0");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryOrderId.trim()) {
      setError("Delivery Order ID is required");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await shippingApi.createShipment({
        deliveryOrderId: deliveryOrderId.trim(),
        carrierId: carrierId || undefined,
        serviceType: serviceType || undefined,
        plannedShipDate: plannedShipDate ? new Date(plannedShipDate).toISOString() : undefined,
        estimatedDeliveryDate: estimatedDeliveryDate
          ? new Date(estimatedDeliveryDate).toISOString()
          : undefined,
        shippingCost: Number(shippingCost) || 0,
        insuranceCost: Number(insuranceCost) || 0,
        otherCost: Number(otherCost) || 0,
        specialInstructions: specialInstructions.trim() || undefined,
      });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create shipment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-lg w-full space-y-4 border border-zinc-200 dark:border-zinc-800">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Create New Shipment</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Delivery Order UUID *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              value={deliveryOrderId}
              onChange={(e) => setDeliveryOrderId(e.target.value)}
              className="w-full p-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Carrier (Optional)
              </label>
              <select
                value={carrierId}
                onChange={(e) => setCarrierId(e.target.value)}
                className="w-full p-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-800"
              >
                <option value="">Unassigned</option>
                {carriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Service Type
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full p-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-800"
              >
                <option value="STANDARD">Standard Delivery</option>
                <option value="EXPRESS">Express Air</option>
                <option value="OVERNIGHT">Overnight</option>
                <option value="FREIGHT">Freight Transport</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Planned Ship Date
              </label>
              <input
                type="date"
                value={plannedShipDate}
                onChange={(e) => setPlannedShipDate(e.target.value)}
                className="w-full p-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Estimated Delivery Date
              </label>
              <input
                type="date"
                value={estimatedDeliveryDate}
                onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                className="w-full p-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Shipping Cost ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
                className="w-full p-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Insurance ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={insuranceCost}
                onChange={(e) => setInsuranceCost(e.target.value)}
                className="w-full p-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Other Cost ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={otherCost}
                onChange={(e) => setOtherCost(e.target.value)}
                className="w-full p-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Special Instructions
            </label>
            <textarea
              placeholder="e.g. Handle with care, deliver during business hours..."
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              className="w-full p-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-800 h-16"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Shipment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
