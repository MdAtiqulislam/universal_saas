export type NotificationChannel = "IN_APP" | "EMAIL" | "PUSH" | "SMS";

export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type NotificationStatus =
  "PENDING" | "ROUTED" | "DISPATCHED" | "DELIVERED" | "FAILED" | "CANCELLED";

export type NotificationDeliveryStatus =
  "PENDING" | "SENT" | "DELIVERED" | "BOUNCED" | "FAILED" | "REJECTED";

export type NotificationTemplateStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type NotificationScheduleStatus = "PENDING" | "EXECUTED" | "CANCELLED";

export type PushPlatform = "WEB_PUSH" | "APNS" | "FCM";

export interface NotificationDeliveryAttempt {
  id: string;
  attemptNumber: number;
  providerKey: string;
  status: NotificationDeliveryStatus;
  failureCode?: string;
  errorMessage?: string;
  durationMs?: number;
  attemptedAt: string;
}

export interface NotificationDeliveryItem {
  id: string;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  destination: string;
  providerKey?: string;
  providerMessageId?: string;
  attemptCount: number;
  failureReason?: string;
  deliveredAt?: string;
  attempts?: NotificationDeliveryAttempt[];
}

export interface NotificationRecipientItem {
  id: string;
  userId?: string;
  channel: NotificationChannel;
  destination: string;
  readAt?: string;
  status: string;
}

export interface NotificationItem {
  id: string;
  eventType: string;
  status: NotificationStatus;
  priority: NotificationPriority;
  templateKey?: string;
  title?: string;
  content?: string;
  sentAt?: string;
  createdAt: string;
  recipientsCount?: number;
  deliveriesCount?: number;
  recipients?: NotificationRecipientItem[];
  deliveries?: NotificationDeliveryItem[];
}

export interface NotificationTemplateVersionItem {
  id: string;
  version: number;
  subject?: string;
  body: string;
  channels: NotificationChannel[];
  integrityHash: string;
  isPublished: boolean;
  createdAt: string;
}

export interface NotificationTemplateItem {
  id: string;
  templateKey: string;
  name: string;
  description?: string;
  status: NotificationTemplateStatus;
  currentVersion: number;
  isSystem: boolean;
  versions?: NotificationTemplateVersionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferenceItem {
  id: string;
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStartUtc?: string;
  quietHoursEndUtc?: string;
  timezone: string;
  categoryPreferences?: Record<string, boolean>;
}

export interface CommunicationProviderItem {
  id: string;
  channel: NotificationChannel;
  providerKey: string;
  name: string;
  isEnabled: boolean;
  isPrimary: boolean;
  priority: number;
  healthStatus: "HEALTHY" | "DEGRADED" | "DOWN";
  lastHealthCheck?: string;
}

export interface NotificationScheduleItem {
  id: string;
  templateKey?: string;
  sendAt: string;
  status: NotificationScheduleStatus;
  channels: NotificationChannel[];
  recipientCount: number;
  executedAt?: string;
  createdAt: string;
}

export interface NotificationStatsData {
  totalSent: number;
  deliveredCount: number;
  failedCount: number;
  deliveryRate: number;
  activeTemplates: number;
  scheduledCount: number;
  inAppUnreadCount: number;
  channelDistribution: Record<NotificationChannel, number>;
}
