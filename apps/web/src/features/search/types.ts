export type SearchScope =
  | "GLOBAL"
  | "CRM"
  | "SALES"
  | "INVENTORY"
  | "WAREHOUSE"
  | "QUALITY"
  | "RETURNS"
  | "SERVICE"
  | "FINANCE"
  | "WORKFLOW"
  | "WORKFLOWS"
  | "NOTIFICATIONS"
  | "DEVELOPER"
  | "BILLING"
  | "ADMIN"
  | "USERS";

export type SavedViewVisibility = "PERSONAL" | "SHARED" | "TENANT";

export type SavedViewShareType = "USER" | "ROLE" | "ORGANIZATION";

export type SearchAlertStatus = "ACTIVE" | "PAUSED" | "TRIGGERED" | "FAILED";

export interface SearchRecord {
  id: string;
  scope: SearchScope;
  resourceType: string;
  title: string;
  subtitle?: string;
  description?: string;
  url: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  score?: number;
}

export interface SuggestionItem {
  text: string;
  scope: SearchScope;
  resourceType: string;
  resourceId?: string;
  url?: string;
}

export interface SearchFilterNode {
  field?: string;
  operator?: string;
  value?: unknown;
  secondaryValue?: unknown;
  logicalOperator?: "AND" | "OR" | "NOT";
  conditions?: SearchFilterNode[];
}

export interface SavedViewItem {
  id: string;
  organizationId: string;
  ownerUserId: string;
  name: string;
  description?: string;
  resourceType: string;
  scope: SearchScope;
  visibility: SavedViewVisibility;
  isDefault: boolean;
  isLocked: boolean;
  queryText?: string;
  filters?: SearchFilterNode;
  visibleFields?: string[];
  sortField?: string;
  sortOrder?: "asc" | "desc";
  createdAt: string;
  updatedAt: string;
  shares?: SavedViewShareItem[];
}

export interface SavedViewShareItem {
  id: string;
  savedViewId: string;
  shareType: SavedViewShareType;
  targetId: string;
  permission: "VIEW" | "EDIT" | "ADMIN";
  createdAt: string;
}

export interface SearchHistoryItem {
  id: string;
  queryText: string;
  scope: SearchScope;
  resultCount: number;
  executedAt: string;
}

export interface RecentItemRecord {
  id: string;
  resourceType: string;
  resourceId: string;
  title: string;
  url: string;
  viewedAt: string;
}

export interface FavoriteItemRecord {
  id: string;
  resourceType: string;
  resourceId: string;
  title: string;
  url: string;
  createdAt: string;
}

export interface SearchAlertItem {
  id: string;
  savedViewId: string;
  name: string;
  description?: string;
  status: SearchAlertStatus;
  alertIntervalMinutes: number;
  notifyChannels: string[];
  lastEvaluatedAt?: string;
  lastTriggeredAt?: string;
  createdAt: string;
  savedView?: {
    name: string;
    resourceType: string;
  };
}

export interface SearchAnalyticsSummary {
  totalSearchesToday: number;
  avgDurationMs: number;
  topQueries: Array<{ query: string; count: number }>;
  zeroResultQueries: Array<{ query: string; count: number }>;
  searchesByScope: Record<string, number>;
}
