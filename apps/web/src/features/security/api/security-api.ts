import {
  SecurityDashboardSummary,
  SecurityEventItem,
  UserSessionItem,
  SecurityPolicyConfig,
} from "../types/security.types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

async function fetchWithAuth<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const orgId = typeof window !== "undefined" ? localStorage.getItem("organization_id") : null;

  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (orgId) headers.set("x-organization-id", orgId);
  headers.set("Content-Type", "application/json");

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "API request failed");
  }
  return res.json();
}

export const securityApi = {
  // Dashboard
  getDashboardSummary: (): Promise<SecurityDashboardSummary> =>
    fetchWithAuth("/api/v1/security/dashboard"),

  // Events
  getEvents: (params?: Record<string, string>): Promise<SecurityEventItem[]> => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return fetchWithAuth(`/api/v1/security/events${query}`);
  },

  getEvent: (id: string): Promise<SecurityEventItem> =>
    fetchWithAuth(`/api/v1/security/events/${id}`),

  // Sessions
  getSessions: (params?: Record<string, string>): Promise<UserSessionItem[]> => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return fetchWithAuth(`/api/v1/security/sessions${query}`);
  },

  revokeSession: (id: string, reason?: string): Promise<{ id: string; status: string }> =>
    fetchWithAuth(`/api/v1/security/sessions/${id}/revoke`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  revokeUserAll: (
    userId: string,
    reason?: string,
  ): Promise<{ revokedCount: number; message: string }> =>
    fetchWithAuth("/api/v1/security/sessions/revoke-user-all", {
      method: "POST",
      body: JSON.stringify({ userId, reason }),
    }),

  // Policies
  getPolicy: (): Promise<SecurityPolicyConfig> => fetchWithAuth("/api/v1/security/policies"),

  updatePolicy: (data: Partial<SecurityPolicyConfig>): Promise<SecurityPolicyConfig> =>
    fetchWithAuth("/api/v1/security/policies", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Reports
  getReport: (reportName: string, params?: Record<string, string>): Promise<any> => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return fetchWithAuth(`/api/v1/security/reports/${reportName}${query}`);
  },
};
