import {
  QualityConfiguration,
  SamplingPlan,
  InspectionPlan,
  QualityInspectionLot,
  QualityHold,
  NonConformance,
  CAPA,
  CustomerQualityIssue,
  SupplierQualitySummaryItem,
} from "../types/quality.types";

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
    const errorBody = (await res.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(errorBody.message || `Request failed with status ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const qualityApi = {
  // Configuration
  getConfig: () => fetchJson<QualityConfiguration>("/api/v1/quality/configuration"),
  updateConfig: (data: Partial<QualityConfiguration>) =>
    fetchJson<QualityConfiguration>("/api/v1/quality/configuration", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Sampling Plans
  getSamplingPlans: (params?: Record<string, unknown>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<SamplingPlan[]>(`/api/v1/quality/sampling-plans?${query.toString()}`);
  },
  getSamplingPlan: (id: string) => fetchJson<SamplingPlan>(`/api/v1/quality/sampling-plans/${id}`),
  createSamplingPlan: (data: Record<string, unknown>) =>
    fetchJson<SamplingPlan>("/api/v1/quality/sampling-plans", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSamplingPlan: (id: string, data: Record<string, unknown>) =>
    fetchJson<SamplingPlan>(`/api/v1/quality/sampling-plans/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Inspection Plans
  getInspectionPlans: (params?: Record<string, unknown>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<InspectionPlan[]>(`/api/v1/quality/inspection-plans?${query.toString()}`);
  },
  getInspectionPlan: (id: string) =>
    fetchJson<InspectionPlan>(`/api/v1/quality/inspection-plans/${id}`),
  createInspectionPlan: (data: Record<string, unknown>) =>
    fetchJson<InspectionPlan>("/api/v1/quality/inspection-plans", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateInspectionPlan: (id: string, data: Record<string, unknown>) =>
    fetchJson<InspectionPlan>(`/api/v1/quality/inspection-plans/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  activateInspectionPlan: (id: string) =>
    fetchJson<InspectionPlan>(`/api/v1/quality/inspection-plans/${id}/activate`, {
      method: "POST",
    }),
  deactivateInspectionPlan: (id: string) =>
    fetchJson<InspectionPlan>(`/api/v1/quality/inspection-plans/${id}/deactivate`, {
      method: "POST",
    }),

  // Inspection Lots
  getInspectionLots: (params?: Record<string, unknown>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<QualityInspectionLot[]>(`/api/v1/quality/inspection-lots?${query.toString()}`);
  },
  getInspectionLot: (id: string) =>
    fetchJson<QualityInspectionLot>(`/api/v1/quality/inspection-lots/${id}`),
  createInspectionLot: (data: Record<string, unknown>) =>
    fetchJson<QualityInspectionLot>("/api/v1/quality/inspection-lots", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  recordInspectionResults: (
    id: string,
    results: Array<{
      characteristicId: string;
      sampleNumber: number;
      observedNumericValue?: number;
      observedTextValue?: string;
      isPass: boolean;
      notes?: string;
    }>,
  ) =>
    fetchJson<QualityInspectionLot>(`/api/v1/quality/inspection-lots/${id}/results`, {
      method: "POST",
      body: JSON.stringify({ results }),
    }),
  decideInspectionLot: (id: string, decisionData: Record<string, unknown>) =>
    fetchJson<QualityInspectionLot>(`/api/v1/quality/inspection-lots/${id}/decide`, {
      method: "POST",
      body: JSON.stringify(decisionData),
    }),

  // Holds
  getHolds: (params?: Record<string, unknown>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<QualityHold[]>(`/api/v1/quality/holds?${query.toString()}`);
  },
  getHold: (id: string) => fetchJson<QualityHold>(`/api/v1/quality/holds/${id}`),
  createHold: (data: Record<string, unknown>) =>
    fetchJson<QualityHold>("/api/v1/quality/holds", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  releaseHold: (id: string, data: Record<string, unknown>) =>
    fetchJson<QualityHold>(`/api/v1/quality/holds/${id}/release`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Non-Conformance (NCR)
  getNonConformances: (params?: Record<string, unknown>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<NonConformance[]>(`/api/v1/quality/non-conformances?${query.toString()}`);
  },
  getNonConformance: (id: string) =>
    fetchJson<NonConformance>(`/api/v1/quality/non-conformances/${id}`),
  createNonConformance: (data: Record<string, unknown>) =>
    fetchJson<NonConformance>("/api/v1/quality/non-conformances", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  containNonConformance: (id: string, containmentAction: string) =>
    fetchJson<NonConformance>(`/api/v1/quality/non-conformances/${id}/contain`, {
      method: "POST",
      body: JSON.stringify({ containmentAction }),
    }),
  investigateNonConformance: (id: string, rootCause: string) =>
    fetchJson<NonConformance>(`/api/v1/quality/non-conformances/${id}/investigate`, {
      method: "POST",
      body: JSON.stringify({ rootCause }),
    }),
  dispositionNonConformance: (id: string, data: Record<string, unknown>) =>
    fetchJson<NonConformance>(`/api/v1/quality/non-conformances/${id}/disposition`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  closeNonConformance: (id: string, data?: Record<string, unknown>) =>
    fetchJson<NonConformance>(`/api/v1/quality/non-conformances/${id}/close`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),

  // CAPA
  getCapas: (params?: Record<string, unknown>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<CAPA[]>(`/api/v1/quality/capa?${query.toString()}`);
  },
  getCapa: (id: string) => fetchJson<CAPA>(`/api/v1/quality/capa/${id}`),
  createCapa: (data: Record<string, unknown>) =>
    fetchJson<CAPA>("/api/v1/quality/capa", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCapa: (id: string, data: Record<string, unknown>) =>
    fetchJson<CAPA>(`/api/v1/quality/capa/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  startCapa: (id: string) =>
    fetchJson<CAPA>(`/api/v1/quality/capa/${id}/start`, {
      method: "POST",
    }),
  verifyCapa: (id: string, data: Record<string, unknown>) =>
    fetchJson<CAPA>(`/api/v1/quality/capa/${id}/verify`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  closeCapa: (id: string) =>
    fetchJson<CAPA>(`/api/v1/quality/capa/${id}/close`, {
      method: "POST",
    }),

  // Customer Quality Issues
  getCustomerIssues: (params?: Record<string, unknown>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<CustomerQualityIssue[]>(`/api/v1/quality/customer-issues?${query.toString()}`);
  },
  getCustomerIssue: (id: string) =>
    fetchJson<CustomerQualityIssue>(`/api/v1/quality/customer-issues/${id}`),
  createCustomerIssue: (data: Record<string, unknown>) =>
    fetchJson<CustomerQualityIssue>("/api/v1/quality/customer-issues", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  resolveCustomerIssue: (id: string, resolutionNotes: string) =>
    fetchJson<CustomerQualityIssue>(`/api/v1/quality/customer-issues/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolutionNotes }),
    }),

  // Analytics & Scorecards
  getSupplierQualitySummary: (params?: Record<string, unknown>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<SupplierQualitySummaryItem[]>(
      `/api/v1/quality/supplier-quality/summary?${query.toString()}`,
    );
  },
  getSupplierScorecard: (supplierId: string) =>
    fetchJson<{
      supplier: { id: string; code: string; name: string };
      summary: SupplierQualitySummaryItem;
      recentLots: QualityInspectionLot[];
    }>(`/api/v1/quality/supplier-quality/${supplierId}/scorecard`),

  // Reports
  getInspectionSummaryReport: (params?: Record<string, unknown>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<{
      overallPassRate: number;
      totalLots: number;
      acceptedLots: number;
      rejectedLots: number;
      totalInspectedQuantity: number;
      totalPassedQuantity: number;
      totalFailedQuantity: number;
      pendingLots: number;
    }>(`/api/v1/quality/reports/inspection-summary?${query.toString()}`);
  },
  getPassFailReport: (params?: Record<string, unknown>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<
      Array<{
        itemId: string;
        itemSku: string;
        itemName: string;
        totalLots: number;
        passedLots: number;
        failedLots: number;
        totalInspectedQty: number;
        passRate: number;
      }>
    >(`/api/v1/quality/reports/pass-fail?${query.toString()}`);
  },
  getLotAgingReport: () =>
    fetchJson<{
      totalOpenLots: number;
      buckets: Record<string, { count: number; lots: unknown[] }>;
    }>("/api/v1/quality/reports/lot-aging"),
  getHoldReport: (params?: Record<string, unknown>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<{
      activeHoldsCount: number;
      activeHeldQuantity: number;
      holds: QualityHold[];
    }>(`/api/v1/quality/reports/holds?${query.toString()}`);
  },
  getQuarantineAgingReport: () => fetchJson<unknown>("/api/v1/quality/reports/quarantine-aging"),
  getNonConformanceReport: (params?: Record<string, unknown>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<unknown>(`/api/v1/quality/reports/non-conformance?${query.toString()}`);
  },
  getNcrAgingReport: () => fetchJson<unknown>("/api/v1/quality/reports/ncr-aging"),
  getCapaReport: () => fetchJson<unknown>("/api/v1/quality/reports/capa"),
  getSupplierQualityReport: (params?: Record<string, unknown>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== "") query.append(key, String(val));
      });
    }
    return fetchJson<unknown>(`/api/v1/quality/reports/supplier-quality?${query.toString()}`);
  },
  getCustomerQualityReport: () => fetchJson<unknown>("/api/v1/quality/reports/customer-quality"),
  getReworkScrapReport: () => fetchJson<unknown>("/api/v1/quality/reports/rework-scrap"),
  getQualityTrendsReport: () =>
    fetchJson<
      Array<{
        month: string;
        totalLots: number;
        passedLots: number;
        failedLots: number;
        passRate: number;
      }>
    >("/api/v1/quality/reports/trends"),
};
