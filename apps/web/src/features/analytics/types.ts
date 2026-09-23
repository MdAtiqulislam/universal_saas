export type ReportVisibility = "PRIVATE" | "ORGANIZATION" | "PUBLIC";
export type ReportShareType = "USER" | "ROLE" | "TEAM";
export type ReportScheduleFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";
export type ReportExecutionStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type DashboardVisibility = "PRIVATE" | "ORGANIZATION" | "PUBLIC";
export type DashboardWidgetType =
  "METRIC_CARD" | "CHART_LINE" | "CHART_BAR" | "CHART_PIE" | "TABLE" | "KPI_SUMMARY";
export type ExportFormat = "CSV" | "JSON";

export interface MeasureDefinition {
  name: string;
  label: string;
  aggregations: ("COUNT" | "SUM" | "AVG" | "MIN" | "MAX")[];
  isCurrency?: boolean;
  unit?: string;
}

export interface AnalyticsDefinition {
  definitionKey: string;
  name: string;
  domain: string;
  description: string;
  allowedDimensions: string[];
  allowedMeasures: MeasureDefinition[];
  supportedAggregations: string[];
  allowedFilterFields: string[];
  requiredPermissions: string[];
  defaultTimeDimension: string;
  allowedTimeDimensions: string[];
}

export interface FilterNode {
  field?: string;
  operator?: string;
  value?: unknown;
  and?: FilterNode[];
  or?: FilterNode[];
  not?: FilterNode;
}

export interface MeasureQueryItem {
  name: string;
  aggregation: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
}

export interface AnalyticsQuery {
  definitionKey: string;
  dimensions?: string[];
  measures?: MeasureQueryItem[];
  filterAst?: FilterNode;
  timeDimension?: string;
  timeGranularity?: "hour" | "day" | "week" | "month" | "quarter" | "year";
  timeZone?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}

export interface AnalyticsQueryResult {
  data: Record<string, unknown>[];
  meta: {
    definitionKey: string;
    dimensions: string[];
    measures: string[];
    totalRows: number;
    executionTimeMs: number;
    timeDimension?: string;
    timeGranularity?: string;
    timeZone: string;
    limit: number;
    offset: number;
  };
}

export interface SavedReport {
  id: string;
  organizationId: string;
  definitionKey: string;
  name: string;
  description?: string;
  dimensions: string[];
  measures: any[];
  filterAst?: FilterNode;
  timeDimension?: string;
  timeGranularity?: string;
  timeZone: string;
  limit: number;
  offset: number;
  sortBy?: string;
  sortDirection: string;
  visibility: ReportVisibility;
  isSystem: boolean;
  ownerUserId: string;
  lastExecutedAt?: string;
  createdAt: string;
  updatedAt: string;
  shares?: ReportShare[];
}

export interface ReportShare {
  id: string;
  savedReportId: string;
  shareType: ReportShareType;
  targetId: string;
  createdAt: string;
}

export interface ReportSchedule {
  id: string;
  savedReportId: string;
  frequency: ReportScheduleFrequency;
  cronExpression?: string;
  recipients: string[];
  channels: string[];
  exportFormat: ExportFormat;
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  savedReport?: { name: string };
}

export interface Dashboard {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  layout?: any;
  visibility: DashboardVisibility;
  isDefault: boolean;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
  widgets?: DashboardWidget[];
  shares?: any[];
}

export interface DashboardWidget {
  id: string;
  dashboardId: string;
  savedReportId?: string;
  title: string;
  widgetType: DashboardWidgetType;
  position: { x: number; y: number; w: number; h: number };
  config?: Record<string, any>;
  savedReport?: SavedReport;
}
