# 10. Timezone-Aware Quiet Hours

## Quiet Window Evaluation (`INV-461`, `INV-462`)

The `NotificationPreferencesService` evaluates recipient quiet hours prior to routing non-urgent dispatches:

- **Configuration**:
  - `quietHoursEnabled`: boolean
  - `quietHoursStartUtc`: string formatted `HH:mm` (e.g. `22:00`)
  - `quietHoursEndUtc`: string formatted `HH:mm` (e.g. `07:00`)
  - `timezone`: IANA timezone string (defaulting to UTC).
- **Midnight Crossing Logic**:
  - If `start < end`: In quiet window if `currentTime >= start && currentTime < end`.
  - If `start > end` (crosses midnight, e.g. 22:00 to 07:00): In quiet window if `currentTime >= start || currentTime < end`.
- **Security Alert Bypass (`INV-462`)**:
  - Dispatches with `priority: URGENT` or `bypassQuietHours: true` skip quiet hours checks entirely to ensure immediate delivery of security events, 2FA codes, and disaster recovery notifications.
