import {
  IntegrationProvider,
  IntegrationConnection,
  ApiKey,
  WebhookSubscription,
  IntegrationHealthSummary,
} from "./types";

const BASE = "/api/v1";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const error = (await res.json().catch(() => ({ message: "Request failed" }))) as {
      message?: string;
    };
    throw new Error(error.message ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

// Providers
export const getProviders = (params?: { status?: string; category?: string }) =>
  apiFetch<IntegrationProvider[]>(
    `/integrations/providers${params ? "?" + new URLSearchParams(params as Record<string, string>) : ""}`,
  );

// Connections
export const getConnections = () => apiFetch<IntegrationConnection[]>("/integrations/connections");

export const createConnection = (data: {
  providerId: string;
  name: string;
  description?: string;
}) =>
  apiFetch<IntegrationConnection>("/integrations/connections", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deleteConnection = (id: string) =>
  apiFetch<{ success: boolean }>(`/integrations/connections/${id}`, { method: "DELETE" });

// API Keys
export const getApiKeys = () => apiFetch<ApiKey[]>("/integrations/api-keys");

export const createApiKey = (data: { name: string; scopes?: string[]; expiresAt?: string }) =>
  apiFetch<ApiKey & { rawKey: string }>("/integrations/api-keys", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const revokeApiKey = (id: string) =>
  apiFetch<{ success: boolean }>(`/integrations/api-keys/${id}`, { method: "DELETE" });

// Webhooks
export const getWebhooks = () => apiFetch<WebhookSubscription[]>("/integrations/webhooks");

export const createWebhook = (data: {
  name: string;
  endpoint: string;
  subscribedEvents: string[];
}) =>
  apiFetch<WebhookSubscription>("/integrations/webhooks", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deleteWebhook = (id: string) =>
  apiFetch<{ success: boolean }>(`/integrations/webhooks/${id}`, { method: "DELETE" });

// Health
export const getIntegrationHealth = () =>
  apiFetch<IntegrationHealthSummary>("/integrations/health");
