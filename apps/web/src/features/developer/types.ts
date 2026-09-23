export interface DeveloperKpis {
  totalRequests: number;
  requests24h: number;
  successRate: number;
  errorRate: number;
  p95Latency: number;
  rateLimitedCount: number;
  activeKeysCount: number;
  endpointCount: number;
}

export interface RateLimitVisibility {
  limit: number;
  remaining: number;
  resetSeconds: number;
  allowed: boolean;
  windowSeconds: number;
}

export interface EndpointMetric {
  route: string;
  method: string;
  requests: number;
  errors: number;
  errorRate: number;
  avgDurationMs: number;
}

export interface RecentErrorEntry {
  id: string;
  route: string;
  method: string;
  statusCode: number;
  requestId: string;
  keyPrefix: string | null;
  createdAt: string;
}

export interface ApiVersionInfo {
  version: string;
  status: "stable" | "beta" | "deprecated";
  releaseDate: string;
  deprecated: boolean;
  sunsetDate?: string;
  description: string;
}

export interface DeveloperOverviewData {
  kpis: DeveloperKpis;
  rateLimit: RateLimitVisibility;
  topEndpoints: EndpointMetric[];
  recentErrors: RecentErrorEntry[];
  versions: ApiVersionInfo[];
}

export interface ApiEndpointParam {
  name: string;
  in: "query" | "path" | "header";
  required: boolean;
  type: string;
  description: string;
  example?: unknown;
}

export interface ApiEndpointDefinition {
  id: string;
  category: string;
  resource: string;
  operation: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  version: string;
  description: string;
  requiredScopes: string[];
  requiresAuth: boolean;
  parameters: ApiEndpointParam[];
  requestBodySchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  exampleRequest?: Record<string, unknown>;
  exampleResponse?: Record<string, unknown>;
  errorCodes: string[];
  deprecated: boolean;
  deprecatedSince?: string;
  sunsetDate?: string;
}

export interface ApiExplorerRequest {
  endpointId: string;
  method: string;
  path: string;
  queryParams?: Record<string, string | number | boolean>;
  pathParams?: Record<string, string>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface ApiExplorerResult {
  requestId: string;
  endpointId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  executedAt: string;
}

export interface ApiUsageRecord {
  id: string;
  organizationId: string;
  apiKeyId?: string | null;
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  responseClass: string;
  userAgent?: string | null;
  clientIpHash?: string | null;
  apiVersion: string;
  createdAt: string;
  apiKey?: {
    id: string;
    name: string;
    keyPrefix: string;
  } | null;
}

export interface UsageSummaryData {
  summary: {
    totalRequests: number;
    requests24h: number;
    successCount: number;
    errorCount: number;
    rateLimitedCount: number;
    successRate: number;
    errorRate: number;
    avgLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    activeKeysCount: number;
    sampleSize: number;
  };
  topEndpoints: EndpointMetric[];
  statusBreakdown: {
    classes: Record<string, number>;
    codes: Record<string, number>;
  };
}

export interface ErrorTaxonomyItem {
  httpStatus: number;
  description: string;
}

export interface DeveloperErrorsData {
  taxonomy: Record<string, ErrorTaxonomyItem>;
  recentErrors: RecentErrorEntry[];
}

export interface WebhookDocsData {
  title: string;
  deliveryModel: {
    transport: string;
    payloadFormat: string;
    signingAlgorithm: string;
    signatureHeader: string;
    timestampHeader: string;
    retryPolicy: {
      maxAttempts: number;
      backoffStrategy: string;
      deadLetterThreshold: number;
    };
  };
  signatureVerificationExample: {
    language: string;
    code: string;
  };
  supportedEvents: string[];
}
