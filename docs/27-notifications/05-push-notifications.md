# 05. Mobile Push Notifications

## Push Notification Architecture

Push notifications deliver alerts directly to mobile devices (iOS APNs, Android FCM) and web browsers (Web Push):

- **Device Registration (`INV-466`)**:
  - Push tokens are registered per user and tenant via `POST /api/v1/notifications/devices`.
  - Compound unique constraint on `[userId, deviceToken]` prevents registration collision.
- **Provider Gateway**:
  - `SandboxPushProviderAdapter` simulates push gateways.
  - Detects expired/unregistered tokens (`unregistered_*`) and marks them as permanent failures to trigger device token cleanup.
- **Payload Structure**:
  - High-priority push payloads support optional deep-link metadata and badge increment counters.
