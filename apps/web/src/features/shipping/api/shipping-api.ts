import { Shipment, ShipmentCarrier, ShipmentSummaryReport } from "../types/shipping.types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(errorBody.message || `Request failed with status ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const shippingApi = {
  // Shipments
  getShipments: (params?: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<{
      shipments: Shipment[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/api/v1/shipping/shipments?${query.toString()}`);
  },

  getShipment: (id: string) => fetchJson<Shipment>(`/api/v1/shipping/shipments/${id}`),

  createShipment: (data: Record<string, unknown>) =>
    fetchJson<Shipment>("/api/v1/shipping/shipments", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateShipment: (id: string, data: Record<string, unknown>) =>
    fetchJson<Shipment>(`/api/v1/shipping/shipments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  prepareShipment: (id: string) =>
    fetchJson<Shipment>(`/api/v1/shipping/shipments/${id}/ready`, {
      method: "POST",
    }),

  assignCarrier: (
    id: string,
    data: { carrierId: string; trackingNumber?: string; serviceType?: string },
  ) =>
    fetchJson<Shipment>(`/api/v1/shipping/shipments/${id}/assign-carrier`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  dispatchShipment: (
    id: string,
    data?: { actualShipDate?: string; trackingNumber?: string; notes?: string },
  ) =>
    fetchJson<Shipment>(`/api/v1/shipping/shipments/${id}/dispatch`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),

  markInTransit: (id: string, data?: { notes?: string; location?: string }) =>
    fetchJson<Shipment>(`/api/v1/shipping/shipments/${id}/in-transit`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),

  markDelivered: (id: string, data?: { notes?: string; location?: string }) =>
    fetchJson<Shipment>(`/api/v1/shipping/shipments/${id}/deliver`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),

  markFailed: (id: string, data: { failureReason: string; location?: string }) =>
    fetchJson<Shipment>(`/api/v1/shipping/shipments/${id}/fail`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  initiateReturn: (id: string, data: { returnReason: string; location?: string }) =>
    fetchJson<Shipment>(`/api/v1/shipping/shipments/${id}/return`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  closeShipment: (id: string) =>
    fetchJson<Shipment>(`/api/v1/shipping/shipments/${id}/close`, {
      method: "POST",
    }),

  cancelShipment: (id: string, data: { cancellationReason: string }) =>
    fetchJson<Shipment>(`/api/v1/shipping/shipments/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Tracking
  getTrackingHistory: (id: string) =>
    fetchJson<{
      shipmentId: string;
      shipmentNumber: string;
      carrierName: string | null;
      trackingNumber: string | null;
      currentStatus: string;
      events: Array<{
        id: string;
        status: string;
        eventType: string;
        eventTime: string;
        location?: string | null;
        description?: string | null;
      }>;
    }>(`/api/v1/shipping/shipments/${id}/tracking`),

  addTrackingEvent: (id: string, data: Record<string, unknown>) =>
    fetchJson<unknown>(`/api/v1/shipping/shipments/${id}/tracking`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Carriers
  getCarriers: (params?: Record<string, string | number | boolean | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined) query.append(key, String(val));
      });
    }
    return fetchJson<{
      carriers: ShipmentCarrier[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/api/v1/shipping/carriers?${query.toString()}`);
  },

  createCarrier: (data: Record<string, unknown>) =>
    fetchJson<ShipmentCarrier>("/api/v1/shipping/carriers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCarrier: (id: string, data: Record<string, unknown>) =>
    fetchJson<ShipmentCarrier>(`/api/v1/shipping/carriers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  activateCarrier: (id: string) =>
    fetchJson<ShipmentCarrier>(`/api/v1/shipping/carriers/${id}/activate`, {
      method: "POST",
    }),

  deactivateCarrier: (id: string) =>
    fetchJson<ShipmentCarrier>(`/api/v1/shipping/carriers/${id}/deactivate`, {
      method: "POST",
    }),

  // Reports
  getSummaryReport: (params?: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<ShipmentSummaryReport>(`/api/v1/shipping/reports/summary?${query.toString()}`);
  },

  getPerformanceReport: (params?: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<{
      totalDelivered: number;
      onTimeDeliveries: number;
      lateDeliveries: number;
      onTimeRate: number;
      avgDeliveryDays: number;
      shipments: Array<{
        id: string;
        shipmentNumber: string;
        customerName: string;
        carrierName: string | null;
        daysInTransit: number | null;
        isOnTime: boolean | null;
      }>;
    }>(`/api/v1/shipping/reports/performance?${query.toString()}`);
  },

  getCarrierPerformance: (params?: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<
      Array<{
        carrierId: string;
        carrierCode: string;
        carrierName: string;
        carrierType: string;
        totalShipments: number;
        deliveredCount: number;
        failedCount: number;
        returnedCount: number;
        onTimeRate: number;
        totalCost: string;
      }>
    >(`/api/v1/shipping/reports/carriers?${query.toString()}`);
  },
};
