import { NotificationChannel } from '@prisma/client';

export interface ProviderSendParams {
  notificationId: string;
  recipientId: string;
  destination?: string;
  title?: string;
  content: string;
  metadata?: Record<string, unknown>;
  channel: NotificationChannel;
  organizationId: string;
}

export interface ProviderSendResult {
  success: boolean;
  providerMessageId?: string;
  providerKey: string;
  failureCode?: string;
  failureCategory?:
    'TRANSIENT' | 'PERMANENT' | 'SECURITY' | 'RATE_LIMIT' | 'PROVIDER';
  error?: string;
  rawResponse?: Record<string, unknown>;
  durationMs: number;
}

export interface ProviderHealthResult {
  providerKey: string;
  channel: NotificationChannel;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  latencyMs: number;
  message?: string;
}

export interface ChannelProviderAdapter {
  readonly providerKey: string;
  readonly channel: NotificationChannel;

  send(params: ProviderSendParams): Promise<ProviderSendResult>;
  validateDestination(destination: string): boolean;
  healthCheck(): Promise<ProviderHealthResult>;
}
