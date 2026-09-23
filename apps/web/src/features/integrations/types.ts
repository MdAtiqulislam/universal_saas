export type IntegrationProviderStatus = "ACTIVE" | "INACTIVE" | "DEPRECATED";
export type IntegrationConnectionStatus = "CONNECTED" | "DISCONNECTED" | "ERROR" | "PENDING";
export type WebhookSubscriptionStatus = "ACTIVE" | "INACTIVE" | "FAILED";
export type WebhookDeliveryStatus =
  "PENDING" | "IN_PROGRESS" | "SUCCESS" | "FAILED" | "DEAD_LETTER";
export type InboundWebhookStatus =
  "RECEIVED" | "PROCESSED" | "DUPLICATE" | "FAILED" | "DEAD_LETTER";

export interface IntegrationProvider {
  id: string;
  providerKey: string;
  name: string;
  description?: string;
  logoUrl?: string;
  category: string;
  status: IntegrationProviderStatus;
  capabilities: string[];
  createdAt: string;
}

export interface IntegrationConnection {
  id: string;
  organizationId: string;
  providerId: string;
  name: string;
  description?: string;
  status: IntegrationConnectionStatus;
  lastHealthCheck?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  provider?: Pick<IntegrationProvider, "id" | "name" | "providerKey" | "category" | "logoUrl">;
}

export interface ApiKey {
  id: string;
  name: string;
  description?: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface WebhookSubscription {
  id: string;
  name: string;
  endpoint: string;
  subscribedEvents: string[];
  status: WebhookSubscriptionStatus;
  failureCount: number;
  lastDeliveredAt?: string;
  retryPolicy?: Record<string, unknown>;
  timeoutSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  integrationEventId: string;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  lastHttpStatus?: number;
  lastAttemptAt?: string;
  deliveredAt?: string;
  durationMs?: number;
  createdAt: string;
}

export interface InboundWebhookEvent {
  id: string;
  connectionId: string;
  providerEventId: string;
  eventType: string;
  status: InboundWebhookStatus;
  processedAt?: string;
  receivedAt: string;
  createdAt: string;
}

export interface IntegrationHealthSummary {
  connections: Record<string, number>;
  activeApiKeys: number;
  webhookSubscriptions: Record<string, number>;
  last24hDeliveries: Record<string, number>;
  last24hInbound: Record<string, number>;
}
