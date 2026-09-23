import {
  WarehouseZone,
  WarehouseStockPosition,
  WarehouseTask,
  PutawayTask,
  PickTask,
  PickWave,
  WarehouseTransfer,
  CycleCount,
  ReplenishmentRule,
  ReplenishmentTask,
  QuarantineRecord,
  WarehouseConfiguration,
} from "../types/warehouse.types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export const warehouseApi = {
  // Zones
  getZones: (params?: Record<string, string | number | boolean | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<{ data: WarehouseZone[]; total: number; page: number; limit: number }>(
      `/api/v1/warehouse/zones?${query.toString()}`,
    );
  },
  getZone: (id: string) => fetchJson<WarehouseZone>(`/api/v1/warehouse/zones/${id}`),
  createZone: (data: Record<string, unknown>) =>
    fetchJson<WarehouseZone>("/api/v1/warehouse/zones", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateZone: (id: string, data: Record<string, unknown>) =>
    fetchJson<WarehouseZone>(`/api/v1/warehouse/zones/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Stock & Positions
  getStockPositions: (params?: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<{
      data: WarehouseStockPosition[];
      total: number;
      page: number;
      limit: number;
    }>(`/api/v1/warehouse/stock?${query.toString()}`);
  },

  // Quarantine
  getQuarantines: (params?: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<QuarantineRecord[]>(`/api/v1/warehouse/stock/quarantine?${query.toString()}`);
  },
  getQuarantine: (id: string) =>
    fetchJson<QuarantineRecord>(`/api/v1/warehouse/stock/quarantine/${id}`),
  quarantineStock: (data: Record<string, unknown>) =>
    fetchJson<QuarantineRecord>("/api/v1/warehouse/stock/quarantine", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  inspectQuarantine: (id: string, data: Record<string, unknown>) =>
    fetchJson<QuarantineRecord>(`/api/v1/warehouse/stock/quarantine/${id}/inspect`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  releaseQuarantine: (id: string, data?: Record<string, unknown>) =>
    fetchJson<QuarantineRecord>(`/api/v1/warehouse/stock/quarantine/${id}/release`, {
      method: "PUT",
      body: JSON.stringify(data || {}),
    }),

  // Tasks
  getTasks: (params?: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<{ data: WarehouseTask[]; total: number; page: number; limit: number }>(
      `/api/v1/warehouse/tasks?${query.toString()}`,
    );
  },
  getTask: (id: string) => fetchJson<WarehouseTask>(`/api/v1/warehouse/tasks/${id}`),
  createTask: (data: Record<string, unknown>) =>
    fetchJson<WarehouseTask>("/api/v1/warehouse/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  assignTask: (id: string, assignedUserId: string) =>
    fetchJson<WarehouseTask>(`/api/v1/warehouse/tasks/${id}/assign`, {
      method: "PUT",
      body: JSON.stringify({ assignedUserId }),
    }),
  startTask: (id: string) =>
    fetchJson<WarehouseTask>(`/api/v1/warehouse/tasks/${id}/start`, { method: "PUT" }),
  completeTask: (id: string) =>
    fetchJson<WarehouseTask>(`/api/v1/warehouse/tasks/${id}/complete`, { method: "PUT" }),
  cancelTask: (id: string) =>
    fetchJson<WarehouseTask>(`/api/v1/warehouse/tasks/${id}/cancel`, { method: "PUT" }),

  // Putaway
  getPutawayTasks: (params?: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<{ data: PutawayTask[]; total: number; page: number; limit: number }>(
      `/api/v1/warehouse/putaway?${query.toString()}`,
    );
  },
  getPutawayTask: (id: string) => fetchJson<PutawayTask>(`/api/v1/warehouse/putaway/${id}`),
  createPutawayTask: (data: Record<string, unknown>) =>
    fetchJson<PutawayTask>("/api/v1/warehouse/putaway", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  assignPutawayTask: (id: string, assignedUserId: string) =>
    fetchJson<PutawayTask>(`/api/v1/warehouse/putaway/${id}/assign`, {
      method: "PUT",
      body: JSON.stringify({ assignedUserId }),
    }),
  startPutawayTask: (id: string) =>
    fetchJson<PutawayTask>(`/api/v1/warehouse/putaway/${id}/start`, { method: "PUT" }),
  completePutawayTask: (id: string, data?: Record<string, unknown>) =>
    fetchJson<PutawayTask>(`/api/v1/warehouse/putaway/${id}/complete`, {
      method: "PUT",
      body: JSON.stringify(data || {}),
    }),
  cancelPutawayTask: (id: string) =>
    fetchJson<PutawayTask>(`/api/v1/warehouse/putaway/${id}/cancel`, { method: "PUT" }),

  // Picks
  getPicks: (params?: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<{ data: PickTask[]; total: number; page: number; limit: number }>(
      `/api/v1/warehouse/picks?${query.toString()}`,
    );
  },
  getPick: (id: string) => fetchJson<PickTask>(`/api/v1/warehouse/picks/${id}`),
  createPick: (data: Record<string, unknown>) =>
    fetchJson<PickTask>("/api/v1/warehouse/picks", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  assignPick: (id: string, assignedUserId: string) =>
    fetchJson<PickTask>(`/api/v1/warehouse/picks/${id}/assign`, {
      method: "PUT",
      body: JSON.stringify({ assignedUserId }),
    }),
  startPick: (id: string) =>
    fetchJson<PickTask>(`/api/v1/warehouse/picks/${id}/start`, { method: "PUT" }),
  executePick: (id: string, data: Record<string, unknown>) =>
    fetchJson<PickTask>(`/api/v1/warehouse/picks/${id}/execute`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  cancelPick: (id: string) =>
    fetchJson<PickTask>(`/api/v1/warehouse/picks/${id}/cancel`, { method: "PUT" }),

  // Waves
  getWaves: (params?: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<{ data: PickWave[]; total: number; page: number; limit: number }>(
      `/api/v1/warehouse/waves?${query.toString()}`,
    );
  },
  getWave: (id: string) => fetchJson<PickWave>(`/api/v1/warehouse/waves/${id}`),
  createWave: (data: Record<string, unknown>) =>
    fetchJson<PickWave>("/api/v1/warehouse/waves", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  releaseWave: (id: string) =>
    fetchJson<PickWave>(`/api/v1/warehouse/waves/${id}/release`, { method: "PUT" }),
  completeWave: (id: string) =>
    fetchJson<PickWave>(`/api/v1/warehouse/waves/${id}/complete`, { method: "PUT" }),
  cancelWave: (id: string) =>
    fetchJson<PickWave>(`/api/v1/warehouse/waves/${id}/cancel`, { method: "PUT" }),

  // Transfers
  getTransfers: (params?: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<{ data: WarehouseTransfer[]; total: number; page: number; limit: number }>(
      `/api/v1/warehouse/transfers?${query.toString()}`,
    );
  },
  getTransfer: (id: string) => fetchJson<WarehouseTransfer>(`/api/v1/warehouse/transfers/${id}`),
  createTransfer: (data: Record<string, unknown>) =>
    fetchJson<WarehouseTransfer>("/api/v1/warehouse/transfers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  submitTransfer: (id: string) =>
    fetchJson<WarehouseTransfer>(`/api/v1/warehouse/transfers/${id}/submit`, { method: "PUT" }),
  approveTransfer: (id: string) =>
    fetchJson<WarehouseTransfer>(`/api/v1/warehouse/transfers/${id}/approve`, { method: "PUT" }),
  rejectTransfer: (id: string, rejectionReason: string) =>
    fetchJson<WarehouseTransfer>(`/api/v1/warehouse/transfers/${id}/reject`, {
      method: "PUT",
      body: JSON.stringify({ rejectionReason }),
    }),
  startTransfer: (id: string) =>
    fetchJson<WarehouseTransfer>(`/api/v1/warehouse/transfers/${id}/start`, { method: "PUT" }),
  completeTransfer: (id: string) =>
    fetchJson<WarehouseTransfer>(`/api/v1/warehouse/transfers/${id}/complete`, { method: "PUT" }),
  cancelTransfer: (id: string) =>
    fetchJson<WarehouseTransfer>(`/api/v1/warehouse/transfers/${id}/cancel`, { method: "PUT" }),

  // Cycle Counts
  getCounts: (params?: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<{ data: CycleCount[]; total: number; page: number; limit: number }>(
      `/api/v1/warehouse/counts?${query.toString()}`,
    );
  },
  getCount: (id: string) => fetchJson<CycleCount>(`/api/v1/warehouse/counts/${id}`),
  createCount: (data: Record<string, unknown>) =>
    fetchJson<CycleCount>("/api/v1/warehouse/counts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  startCount: (id: string) =>
    fetchJson<CycleCount>(`/api/v1/warehouse/counts/${id}/start`, { method: "PUT" }),
  recordCount: (
    id: string,
    lines: Array<{ lineId: string; countedQuantity: number; notes?: string }>,
  ) =>
    fetchJson<CycleCount>(`/api/v1/warehouse/counts/${id}/record`, {
      method: "PUT",
      body: JSON.stringify({ lines }),
    }),
  recount: (
    id: string,
    lines: Array<{ lineId: string; recountQuantity: number; notes?: string }>,
  ) =>
    fetchJson<CycleCount>(`/api/v1/warehouse/counts/${id}/recount`, {
      method: "PUT",
      body: JSON.stringify({ lines }),
    }),
  reviewCount: (id: string) =>
    fetchJson<CycleCount>(`/api/v1/warehouse/counts/${id}/review`, { method: "PUT" }),
  postCount: (id: string) =>
    fetchJson<CycleCount>(`/api/v1/warehouse/counts/${id}/post`, { method: "PUT" }),
  cancelCount: (id: string) =>
    fetchJson<CycleCount>(`/api/v1/warehouse/counts/${id}/cancel`, { method: "PUT" }),

  // Replenishment
  getReplenishmentRules: (params?: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<ReplenishmentRule[]>(
      `/api/v1/warehouse/replenishment/rules?${query.toString()}`,
    );
  },
  createReplenishmentRule: (data: Record<string, unknown>) =>
    fetchJson<ReplenishmentRule>("/api/v1/warehouse/replenishment/rules", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  generateReplenishmentTasks: (warehouseId: string) =>
    fetchJson<ReplenishmentTask[]>("/api/v1/warehouse/replenishment/generate", {
      method: "POST",
      body: JSON.stringify({ warehouseId }),
    }),
  getReplenishmentTasks: (params?: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<ReplenishmentTask[]>(
      `/api/v1/warehouse/replenishment/tasks?${query.toString()}`,
    );
  },
  completeReplenishmentTask: (id: string) =>
    fetchJson<ReplenishmentTask>(`/api/v1/warehouse/replenishment/tasks/${id}/complete`, {
      method: "PUT",
    }),
  cancelReplenishmentTask: (id: string) =>
    fetchJson<ReplenishmentTask>(`/api/v1/warehouse/replenishment/tasks/${id}/cancel`, {
      method: "PUT",
    }),

  // Configuration
  getConfiguration: () => fetchJson<WarehouseConfiguration>("/api/v1/warehouse/configuration"),
  updateConfiguration: (data: Record<string, unknown>) =>
    fetchJson<WarehouseConfiguration>("/api/v1/warehouse/configuration", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Reports
  getStockByLocationReport: (warehouseId?: string) =>
    fetchJson<any[]>(
      `/api/v1/warehouse/reports/stock-by-location${warehouseId ? `?warehouseId=${warehouseId}` : ""}`,
    ),
  getLocationOccupancyReport: (warehouseId?: string) =>
    fetchJson<any[]>(
      `/api/v1/warehouse/reports/location-occupancy${warehouseId ? `?warehouseId=${warehouseId}` : ""}`,
    ),
  getTaskPerformanceReport: (warehouseId?: string) =>
    fetchJson<any>(
      `/api/v1/warehouse/reports/task-performance${warehouseId ? `?warehouseId=${warehouseId}` : ""}`,
    ),
  getCountVariancesReport: (warehouseId?: string) =>
    fetchJson<any>(
      `/api/v1/warehouse/reports/count-variances${warehouseId ? `?warehouseId=${warehouseId}` : ""}`,
    ),
  getQuarantineAgingReport: (warehouseId?: string) =>
    fetchJson<any>(
      `/api/v1/warehouse/reports/quarantine-aging${warehouseId ? `?warehouseId=${warehouseId}` : ""}`,
    ),
  getReplenishmentHistoryReport: (warehouseId?: string) =>
    fetchJson<any[]>(
      `/api/v1/warehouse/reports/replenishment-history${warehouseId ? `?warehouseId=${warehouseId}` : ""}`,
    ),
  getTransferAnalysisReport: (warehouseId?: string) =>
    fetchJson<any[]>(
      `/api/v1/warehouse/reports/transfer-analysis${warehouseId ? `?warehouseId=${warehouseId}` : ""}`,
    ),
  getAccuracyRateReport: () => fetchJson<any>("/api/v1/warehouse/reports/accuracy-rate"),
  getPickingVelocityReport: (warehouseId?: string) =>
    fetchJson<any>(
      `/api/v1/warehouse/reports/picking-velocity${warehouseId ? `?warehouseId=${warehouseId}` : ""}`,
    ),
};
