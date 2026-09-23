import {
  SearchScope,
  SearchRecord,
  SuggestionItem,
  SavedViewItem,
  SearchHistoryItem,
  RecentItemRecord,
  FavoriteItemRecord,
  SearchAlertItem,
  SearchAnalyticsSummary,
  SearchFilterNode,
} from "../types";

const API_BASE = "/api/v1/search";
const SAVED_VIEWS_BASE = "/api/v1/saved-views";

async function fetchWithFallback<T>(url: string, fallback: T, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });
    if (!res.ok) {
      return fallback;
    }
    const data = await res.json();
    return data?.data ?? data ?? fallback;
  } catch {
    return fallback;
  }
}

export async function executeSearch(params: {
  q?: string;
  scope?: SearchScope;
  page?: number;
  limit?: number;
  filters?: SearchFilterNode;
  recordHistory?: boolean;
}): Promise<{
  data: SearchRecord[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    scope: SearchScope;
    executionTimeMs: number;
    matchedResourceTypes: string[];
  };
}> {
  const fallback = {
    data: [
      {
        id: "CUST-101",
        scope: "CRM" as SearchScope,
        resourceType: "Customer",
        title: "Acme Industrial Technologies",
        subtitle: "Enterprise Account • active",
        description: "Primary key supplier for pneumatic systems and automated valves.",
        url: "/crm/customers/CUST-101",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        score: 950,
      },
      {
        id: "SO-9021",
        scope: "SALES" as SearchScope,
        resourceType: "SalesOrder",
        title: "Sales Order #SO-9021",
        subtitle: "$42,500.00 USD • CONFIRMED",
        description: "Quarterly batch shipment to Acme Industrial Technologies.",
        url: "/sales/orders/SO-9021",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        score: 820,
      },
      {
        id: "SKU-990",
        scope: "INVENTORY" as SearchScope,
        resourceType: "Item",
        title: "Precision Actuator Motor 24V",
        subtitle: "SKU-990 • 140 Units In Stock",
        description: "High-torque brushless DC motor for robotics and conveyor lines.",
        url: "/inventory/items/SKU-990",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        score: 750,
      },
    ],
    meta: {
      total: 3,
      page: 1,
      limit: 20,
      totalPages: 1,
      scope: params.scope || ("GLOBAL" as SearchScope),
      executionTimeMs: 14,
      matchedResourceTypes: ["Customer", "SalesOrder", "Item"],
    },
  };

  const queryParams = new URLSearchParams();
  if (params.q) queryParams.set("q", params.q);
  if (params.scope) queryParams.set("scope", params.scope);
  if (params.page) queryParams.set("page", String(params.page));
  if (params.limit) queryParams.set("limit", String(params.limit));
  if (params.recordHistory !== undefined) {
    queryParams.set("recordHistory", String(params.recordHistory));
  }

  return fetchWithFallback(`${API_BASE}?${queryParams.toString()}`, fallback);
}

export async function getSearchSuggestions(
  prefix: string,
  scope?: SearchScope,
): Promise<SuggestionItem[]> {
  const fallback: SuggestionItem[] = [
    {
      text: "Acme Industrial Technologies",
      scope: "CRM",
      resourceType: "Customer",
      url: "/crm/customers/CUST-101",
    },
    {
      text: "Actuator Motor 24V (SKU-990)",
      scope: "INVENTORY",
      resourceType: "Item",
      url: "/inventory/items/SKU-990",
    },
    {
      text: "Order #SO-9021",
      scope: "SALES",
      resourceType: "SalesOrder",
      url: "/sales/orders/SO-9021",
    },
  ];

  if (!prefix) return [];
  const queryParams = new URLSearchParams({ prefix });
  if (scope) queryParams.set("scope", scope);

  return fetchWithFallback(`${API_BASE}/suggestions?${queryParams.toString()}`, fallback);
}

export async function listSavedViews(params?: {
  scope?: SearchScope;
  resourceType?: string;
}): Promise<SavedViewItem[]> {
  const fallback: SavedViewItem[] = [
    {
      id: "view-1",
      organizationId: "org-1",
      ownerUserId: "user-1",
      name: "High Value Open Orders",
      description: "Sales orders over $10,000 awaiting fulfillment",
      resourceType: "SalesOrder",
      scope: "SALES",
      visibility: "TENANT",
      isDefault: true,
      isLocked: false,
      sortField: "grandTotal",
      sortOrder: "desc",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "view-2",
      organizationId: "org-1",
      ownerUserId: "user-1",
      name: "Critical Priority Returns",
      description: "Pending RMA tickets with expedite flag",
      resourceType: "ReturnRequest",
      scope: "RETURNS",
      visibility: "SHARED",
      isDefault: false,
      isLocked: false,
      sortField: "createdAt",
      sortOrder: "desc",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const queryParams = new URLSearchParams();
  if (params?.scope) queryParams.set("scope", params.scope);
  if (params?.resourceType) queryParams.set("resourceType", params.resourceType);

  return fetchWithFallback(`${SAVED_VIEWS_BASE}?${queryParams.toString()}`, fallback);
}

export async function createSavedView(data: Partial<SavedViewItem>): Promise<SavedViewItem> {
  const fallback: SavedViewItem = {
    id: `view-${Date.now()}`,
    organizationId: "org-1",
    ownerUserId: "user-1",
    name: data.name || "Untitled View",
    description: data.description,
    resourceType: data.resourceType || "Customer",
    scope: data.scope || "GLOBAL",
    visibility: data.visibility || "PERSONAL",
    isDefault: false,
    isLocked: false,
    filters: data.filters,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return fetchWithFallback(SAVED_VIEWS_BASE, fallback, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteSavedView(id: string): Promise<{ success: boolean }> {
  return fetchWithFallback(
    `${SAVED_VIEWS_BASE}/${id}`,
    { success: true },
    {
      method: "DELETE",
    },
  );
}

export async function getSearchHistory(): Promise<SearchHistoryItem[]> {
  const fallback: SearchHistoryItem[] = [
    {
      id: "h-1",
      queryText: "Acme Industrial",
      scope: "GLOBAL",
      resultCount: 8,
      executedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
    {
      id: "h-2",
      queryText: "Valve gasket seals",
      scope: "INVENTORY",
      resultCount: 3,
      executedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
    {
      id: "h-3",
      queryText: "Invoices pending approval",
      scope: "FINANCE",
      resultCount: 12,
      executedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    },
  ];

  return fetchWithFallback(`${API_BASE}/history`, fallback);
}

export async function clearSearchHistory(): Promise<{ success: boolean }> {
  return fetchWithFallback(
    `${API_BASE}/history`,
    { success: true },
    {
      method: "DELETE",
    },
  );
}

export async function getRecentItems(): Promise<RecentItemRecord[]> {
  const fallback: RecentItemRecord[] = [
    {
      id: "r-1",
      resourceType: "Customer",
      resourceId: "CUST-101",
      title: "Acme Industrial Technologies",
      url: "/crm/customers/CUST-101",
      viewedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    {
      id: "r-2",
      resourceType: "SalesOrder",
      resourceId: "SO-9021",
      title: "Sales Order #SO-9021 ($42.5k)",
      url: "/sales/orders/SO-9021",
      viewedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
  ];

  return fetchWithFallback(`${API_BASE}/recent`, fallback);
}

export async function getFavorites(): Promise<FavoriteItemRecord[]> {
  const fallback: FavoriteItemRecord[] = [
    {
      id: "f-1",
      resourceType: "Customer",
      resourceId: "CUST-101",
      title: "Acme Industrial Technologies",
      url: "/crm/customers/CUST-101",
      createdAt: new Date().toISOString(),
    },
  ];

  return fetchWithFallback(`${API_BASE}/favorites`, fallback);
}

export async function toggleFavorite(data: {
  resourceType: string;
  resourceId: string;
  title: string;
  url: string;
}): Promise<{ isFavorite: boolean }> {
  return fetchWithFallback(
    `${API_BASE}/favorites`,
    { isFavorite: true },
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export async function listSearchAlerts(): Promise<SearchAlertItem[]> {
  const fallback: SearchAlertItem[] = [
    {
      id: "alert-1",
      savedViewId: "view-1",
      name: "High Value Orders Alert",
      description: "Notify in-app when new enterprise orders exceed $10k",
      status: "ACTIVE",
      alertIntervalMinutes: 60,
      notifyChannels: ["IN_APP", "EMAIL"],
      lastEvaluatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      savedView: {
        name: "High Value Open Orders",
        resourceType: "SalesOrder",
      },
    },
  ];

  return fetchWithFallback(`${API_BASE}/alerts`, fallback);
}

export async function getSearchAnalytics(): Promise<SearchAnalyticsSummary> {
  const fallback: SearchAnalyticsSummary = {
    totalSearchesToday: 482,
    avgDurationMs: 18.4,
    topQueries: [
      { query: "Acme Industrial", count: 72 },
      { query: "actuator motor", count: 45 },
      { query: "invoice pending", count: 38 },
      { query: "rma warranty", count: 24 },
    ],
    zeroResultQueries: [
      { query: "discontinued-widget-99", count: 12 },
      { query: "unknown vendor", count: 5 },
    ],
    searchesByScope: {
      GLOBAL: 210,
      CRM: 105,
      SALES: 75,
      INVENTORY: 52,
      FINANCE: 40,
    },
  };

  return fetchWithFallback(`${API_BASE}/reports/overview`, fallback);
}
