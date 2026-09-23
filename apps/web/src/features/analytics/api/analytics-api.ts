import {
  AnalyticsDefinition,
  AnalyticsQuery,
  AnalyticsQueryResult,
  SavedReport,
  ReportSchedule,
  Dashboard,
  DashboardWidget,
} from "../types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `API error: ${res.status}`);
  }
  return res.json();
}

export const analyticsApi = {
  // Definitions
  async listDefinitions(): Promise<AnalyticsDefinition[]> {
    return fetchJson<AnalyticsDefinition[]>(`${BASE_URL}/analytics/definitions`);
  },

  async getDefinition(key: string): Promise<AnalyticsDefinition> {
    return fetchJson<AnalyticsDefinition>(`${BASE_URL}/analytics/definitions/${key}`);
  },

  // Query Execution
  async executeQuery(query: AnalyticsQuery): Promise<AnalyticsQueryResult> {
    return fetchJson<AnalyticsQueryResult>(`${BASE_URL}/analytics/query`, {
      method: "POST",
      body: JSON.stringify(query),
    });
  },

  // Export
  async exportQuery(query: AnalyticsQuery, format: "CSV" | "JSON" = "CSV"): Promise<Blob> {
    const res = await fetch(`${BASE_URL}/analytics/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, format }),
    });
    if (!res.ok) {
      throw new Error(`Export error: ${res.status}`);
    }
    return res.blob();
  },

  // Saved Reports
  async listSavedReports(params?: {
    definitionKey?: string;
    visibility?: string;
  }): Promise<{ reports: SavedReport[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.definitionKey) searchParams.append("definitionKey", params.definitionKey);
    if (params?.visibility) searchParams.append("visibility", params.visibility);
    const qs = searchParams.toString();
    return fetchJson<{ reports: SavedReport[]; total: number }>(
      `${BASE_URL}/analytics/reports${qs ? `?${qs}` : ""}`,
    );
  },

  async getSavedReport(id: string): Promise<SavedReport> {
    return fetchJson<SavedReport>(`${BASE_URL}/analytics/reports/${id}`);
  },

  async createSavedReport(data: Partial<SavedReport>): Promise<SavedReport> {
    return fetchJson<SavedReport>(`${BASE_URL}/analytics/reports`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateSavedReport(id: string, data: Partial<SavedReport>): Promise<SavedReport> {
    return fetchJson<SavedReport>(`${BASE_URL}/analytics/reports/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteSavedReport(id: string): Promise<void> {
    await fetchJson<void>(`${BASE_URL}/analytics/reports/${id}`, { method: "DELETE" });
  },

  async executeSavedReport(id: string): Promise<{ execution: any; result: AnalyticsQueryResult }> {
    return fetchJson<{ execution: any; result: AnalyticsQueryResult }>(
      `${BASE_URL}/analytics/reports/${id}/execute`,
      {
        method: "POST",
      },
    );
  },

  // Schedules
  async listSchedules(): Promise<ReportSchedule[]> {
    return fetchJson<ReportSchedule[]>(`${BASE_URL}/analytics/schedules`);
  },

  async createSchedule(data: any): Promise<ReportSchedule> {
    return fetchJson<ReportSchedule>(`${BASE_URL}/analytics/schedules`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async deleteSchedule(id: string): Promise<void> {
    await fetchJson<void>(`${BASE_URL}/analytics/schedules/${id}`, { method: "DELETE" });
  },

  // Dashboards
  async listDashboards(): Promise<{ dashboards: Dashboard[]; total: number }> {
    return fetchJson<{ dashboards: Dashboard[]; total: number }>(
      `${BASE_URL}/analytics/dashboards`,
    );
  },

  async getDashboard(id: string): Promise<Dashboard> {
    return fetchJson<Dashboard>(`${BASE_URL}/analytics/dashboards/${id}`);
  },

  async createDashboard(data: Partial<Dashboard>): Promise<Dashboard> {
    return fetchJson<Dashboard>(`${BASE_URL}/analytics/dashboards`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async deleteDashboard(id: string): Promise<void> {
    await fetchJson<void>(`${BASE_URL}/analytics/dashboards/${id}`, { method: "DELETE" });
  },

  async addDashboardWidget(
    dashboardId: string,
    widget: Partial<DashboardWidget>,
  ): Promise<DashboardWidget> {
    return fetchJson<DashboardWidget>(`${BASE_URL}/analytics/dashboards/${dashboardId}/widgets`, {
      method: "POST",
      body: JSON.stringify(widget),
    });
  },

  async deleteDashboardWidget(dashboardId: string, widgetId: string): Promise<void> {
    await fetchJson<void>(`${BASE_URL}/analytics/dashboards/${dashboardId}/widgets/${widgetId}`, {
      method: "DELETE",
    });
  },

  // Operational Reports
  async getOperationalReport(name: string): Promise<any> {
    return fetchJson<any>(`${BASE_URL}/analytics/operational-reports/${name}`);
  },
};
