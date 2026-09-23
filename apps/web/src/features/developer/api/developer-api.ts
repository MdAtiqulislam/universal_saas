import {
  DeveloperOverviewData,
  ApiEndpointDefinition,
  ApiExplorerRequest,
  ApiExplorerResult,
  ApiUsageRecord,
  UsageSummaryData,
  DeveloperErrorsData,
  ApiVersionInfo,
  WebhookDocsData,
} from "../types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const orgId = typeof window !== "undefined" ? localStorage.getItem("current_org_id") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(orgId ? { "X-Organization-Id": orgId } : {}),
    ...(options?.headers as Record<string, string>),
  };

  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string; error?: { message?: string } };
      errorMsg = body.message || body.error?.message || errorMsg;
    } catch {
      // Non-JSON error
    }
    throw new Error(errorMsg);
  }

  const json = (await res.json()) as { data?: T } | T;
  if (json && typeof json === "object" && "data" in json && json.data !== undefined) {
    return json.data as T;
  }
  return json as T;
}

export async function getDeveloperOverview(): Promise<DeveloperOverviewData> {
  return fetchJson<DeveloperOverviewData>("/api/v1/developer/overview");
}

export async function getApiEndpoints(category?: string): Promise<ApiEndpointDefinition[]> {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  return fetchJson<ApiEndpointDefinition[]>(`/api/v1/developer/api/endpoints${query}`);
}

export async function getApiEndpointDetail(id: string): Promise<ApiEndpointDefinition> {
  return fetchJson<ApiEndpointDefinition>(
    `/api/v1/developer/api/endpoints/${encodeURIComponent(id)}`,
  );
}

export async function executeApiExplorer(req: ApiExplorerRequest): Promise<ApiExplorerResult> {
  return fetchJson<ApiExplorerResult>("/api/v1/developer/api/explorer", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export interface PaginatedUsageResult {
  records: ApiUsageRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getApiUsage(params?: {
  page?: number;
  limit?: number;
  apiKeyId?: string;
  route?: string;
  responseClass?: string;
  days?: number;
}): Promise<PaginatedUsageResult> {
  const q = new URLSearchParams();
  if (params?.page) q.append("page", String(params.page));
  if (params?.limit) q.append("limit", String(params.limit));
  if (params?.apiKeyId) q.append("apiKeyId", params.apiKeyId);
  if (params?.route) q.append("route", params.route);
  if (params?.responseClass) q.append("responseClass", params.responseClass);
  if (params?.days) q.append("days", String(params.days));

  const orgId = typeof window !== "undefined" ? localStorage.getItem("current_org_id") : null;
  const res = await fetch(`${BASE_URL}/api/v1/developer/usage?${q.toString()}`, {
    headers: {
      "Content-Type": "application/json",
      ...(orgId ? { "X-Organization-Id": orgId } : {}),
    },
  });

  if (!res.ok) throw new Error(`Failed to fetch usage: HTTP ${res.status}`);
  const json = (await res.json()) as {
    data: ApiUsageRecord[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  };

  return {
    records: json.data || [],
    total: json.meta?.total || 0,
    page: json.meta?.page || 1,
    limit: json.meta?.limit || 20,
    totalPages: json.meta?.totalPages || 1,
  };
}

export async function getUsageSummary(days: number = 30): Promise<UsageSummaryData> {
  return fetchJson<UsageSummaryData>(`/api/v1/developer/usage/summary?days=${days}`);
}

export async function exportUsageCsv(dto: {
  days?: number;
  apiKeyId?: string;
  route?: string;
}): Promise<{ filename: string; csvContent: string; recordCount: number }> {
  return fetchJson<{ filename: string; csvContent: string; recordCount: number }>(
    "/api/v1/developer/usage/export",
    {
      method: "POST",
      body: JSON.stringify(dto),
    },
  );
}

export async function getApiErrors(limit: number = 20): Promise<DeveloperErrorsData> {
  return fetchJson<DeveloperErrorsData>(`/api/v1/developer/errors?limit=${limit}`);
}

export async function getApiVersions(): Promise<ApiVersionInfo[]> {
  return fetchJson<ApiVersionInfo[]>("/api/v1/developer/versions");
}

export async function getWebhookDocs(): Promise<WebhookDocsData> {
  return fetchJson<WebhookDocsData>("/api/v1/developer/webhooks/docs");
}
