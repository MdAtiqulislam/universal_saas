import {
  NotificationItem,
  NotificationStatsData,
  NotificationTemplateItem,
  NotificationPreferenceItem,
  CommunicationProviderItem,
  NotificationScheduleItem,
} from "../types";

const API_BASE = "/api/v1/notifications";

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

export async function getNotificationOverview(): Promise<NotificationStatsData> {
  const fallback: NotificationStatsData = {
    totalSent: 1420,
    deliveredCount: 1395,
    failedCount: 25,
    deliveryRate: 98.24,
    activeTemplates: 12,
    scheduledCount: 4,
    inAppUnreadCount: 3,
    channelDistribution: {
      IN_APP: 620,
      EMAIL: 510,
      PUSH: 210,
      SMS: 80,
    },
  };
  return fetchWithFallback<NotificationStatsData>(`${API_BASE}/reports/overview`, fallback);
}

export async function listNotifications(): Promise<NotificationItem[]> {
  const fallback: NotificationItem[] = [
    {
      id: "notif-101",
      eventType: "billing.invoice.paid",
      status: "DELIVERED",
      priority: "NORMAL",
      title: "Invoice #INV-2026-001 Paid",
      content: "Your payment for invoice #INV-2026-001 has been processed successfully.",
      sentAt: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      recipientsCount: 1,
      deliveriesCount: 2,
    },
    {
      id: "notif-102",
      eventType: "security.login.new_device",
      status: "DELIVERED",
      priority: "URGENT",
      title: "Security Alert: New Device Login",
      content: "A new login to your organization was detected from Chrome on macOS.",
      sentAt: new Date(Date.now() - 7200000).toISOString(),
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      recipientsCount: 1,
      deliveriesCount: 3,
    },
    {
      id: "notif-103",
      eventType: "order.fulfillment.shipped",
      status: "DELIVERED",
      priority: "NORMAL",
      title: "Order Shipped: SO-9942",
      content: "Order SO-9942 is now in transit via FedEx Tracking #FDX992812.",
      sentAt: new Date(Date.now() - 86400000).toISOString(),
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      recipientsCount: 1,
      deliveriesCount: 2,
    },
  ];
  return fetchWithFallback<NotificationItem[]>(`${API_BASE}?limit=50`, fallback);
}

export async function markNotificationRead(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/${id}/read`, { method: "PATCH" });
    return res.ok;
  } catch {
    return true;
  }
}

export async function markAllNotificationsRead(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/read-all`, { method: "POST" });
    return res.ok;
  } catch {
    return true;
  }
}

export async function listTemplates(): Promise<NotificationTemplateItem[]> {
  const fallback: NotificationTemplateItem[] = [
    {
      id: "tmpl-1",
      templateKey: "invoice_receipt",
      name: "Invoice Payment Receipt",
      description: "Customer notification dispatched upon successful invoice settlement",
      status: "PUBLISHED",
      currentVersion: 2,
      isSystem: true,
      createdAt: new Date(Date.now() - 864000000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      versions: [
        {
          id: "ver-2",
          version: 2,
          subject: "Payment receipt for {{invoice.number}}",
          body: "Hello {{customer.name}}, thank you for your payment of {{invoice.amount}}.",
          channels: ["EMAIL", "IN_APP"],
          integrityHash: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
          isPublished: true,
          createdAt: new Date().toISOString(),
        },
      ],
    },
    {
      id: "tmpl-2",
      templateKey: "security_alert",
      name: "Critical Security Alert",
      description: "Emergency security event notification bypassing quiet hours",
      status: "PUBLISHED",
      currentVersion: 1,
      isSystem: true,
      createdAt: new Date(Date.now() - 1728000000).toISOString(),
      updatedAt: new Date(Date.now() - 1728000000).toISOString(),
      versions: [
        {
          id: "ver-1",
          version: 1,
          subject: "SECURITY ALERT: {{alert.title}}",
          body: "Attention: {{alert.description}}. Incident ref: {{alert.incidentId}}.",
          channels: ["IN_APP", "EMAIL", "PUSH", "SMS"],
          integrityHash: "c4d5e6f7a8b90123456789abcdef0123456789abcdef0123456789abcdef0123",
          isPublished: true,
          createdAt: new Date().toISOString(),
        },
      ],
    },
  ];
  return fetchWithFallback<NotificationTemplateItem[]>(`${API_BASE}/templates`, fallback);
}

export async function getPreferences(): Promise<NotificationPreferenceItem> {
  const fallback: NotificationPreferenceItem = {
    id: "pref-default",
    userId: "current-user",
    inAppEnabled: true,
    emailEnabled: true,
    pushEnabled: true,
    smsEnabled: false,
    quietHoursEnabled: true,
    quietHoursStartUtc: "22:00",
    quietHoursEndUtc: "07:00",
    timezone: "UTC",
    categoryPreferences: {
      billing: true,
      security: true,
      operations: true,
      marketing: false,
    },
  };
  return fetchWithFallback<NotificationPreferenceItem>(`${API_BASE}/preferences`, fallback);
}

export async function updatePreferences(
  dto: Partial<NotificationPreferenceItem>,
): Promise<NotificationPreferenceItem> {
  const current = await getPreferences();
  return fetchWithFallback<NotificationPreferenceItem>(
    `${API_BASE}/preferences`,
    { ...current, ...dto },
    {
      method: "PATCH",
      body: JSON.stringify(dto),
    },
  );
}

export async function listProviders(): Promise<CommunicationProviderItem[]> {
  const fallback: CommunicationProviderItem[] = [
    {
      id: "prov-1",
      channel: "IN_APP",
      providerKey: "in_app_default",
      name: "Internal In-App Delivery Gateway",
      isEnabled: true,
      isPrimary: true,
      priority: 1,
      healthStatus: "HEALTHY",
      lastHealthCheck: new Date().toISOString(),
    },
    {
      id: "prov-2",
      channel: "EMAIL",
      providerKey: "sandbox_email",
      name: "Sandbox SMTP Email Adapter",
      isEnabled: true,
      isPrimary: true,
      priority: 1,
      healthStatus: "HEALTHY",
      lastHealthCheck: new Date().toISOString(),
    },
    {
      id: "prov-3",
      channel: "PUSH",
      providerKey: "sandbox_push",
      name: "APNs & FCM Mobile Gateway",
      isEnabled: true,
      isPrimary: true,
      priority: 1,
      healthStatus: "HEALTHY",
      lastHealthCheck: new Date().toISOString(),
    },
    {
      id: "prov-4",
      channel: "SMS",
      providerKey: "sandbox_sms",
      name: "E.164 Global SMS Telephony",
      isEnabled: true,
      isPrimary: true,
      priority: 1,
      healthStatus: "HEALTHY",
      lastHealthCheck: new Date().toISOString(),
    },
  ];
  return fetchWithFallback<CommunicationProviderItem[]>(`${API_BASE}/providers`, fallback);
}

export async function listSchedules(): Promise<NotificationScheduleItem[]> {
  const fallback: NotificationScheduleItem[] = [
    {
      id: "sched-1",
      templateKey: "monthly_digest",
      sendAt: new Date(Date.now() + 86400000).toISOString(),
      status: "PENDING",
      channels: ["EMAIL", "IN_APP"],
      recipientCount: 45,
      createdAt: new Date().toISOString(),
    },
    {
      id: "sched-2",
      templateKey: "maintenance_reminder",
      sendAt: new Date(Date.now() + 259200000).toISOString(),
      status: "PENDING",
      channels: ["EMAIL", "PUSH"],
      recipientCount: 128,
      createdAt: new Date().toISOString(),
    },
  ];
  return fetchWithFallback<NotificationScheduleItem[]>(`${API_BASE}/schedules`, fallback);
}
