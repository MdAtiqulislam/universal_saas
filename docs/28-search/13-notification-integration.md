# 13 — Omnichannel Notification Integration (M43)

## Authoritative Delivery Pipeline

Search alerts integrate with the M43 `NotificationsService`:

```typescript
await this.notificationsService.notify(alert.organizationId, {
  eventType: "search.alert.matched",
  title: `Search Alert Triggered: ${alert.name}`,
  content: `Your saved view '${savedViewName}' discovered ${matchCount} new matching item(s).`,
  channels: channelEnums,
  recipientUserIds: [alert.userId],
  idempotencyKey: `alert_notif_${executionId}`,
  payload: {
    alertId: alert.id,
    savedViewId: alert.savedViewId,
    matchCount,
  },
});
```

## Preference & Policy Compliance (`INV-497`)

All search alert notifications strictly adhere to:

1. **Recipient Preferences**: Respects user channel selections (email enabled/disabled, in-app notifications enabled/disabled).
2. **Tenant Quiet Hours**: Suppresses non-urgent dispatches during tenant-configured quiet hours.
3. **Delivery Tracking & Idempotency**: Emits tracked delivery attempts and adheres to deduplication rules.
