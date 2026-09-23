# 16. Delivery Tracking & State Machine

## Delivery Lifecycle (`INV-467`, `INV-468`)

Each target destination receives a dedicated `NotificationDelivery` record tracking transmission progress:

- **State Machine Transitions**:
  - `PENDING`: Initial state when notification intent is recorded.
  - `SENT`: Gateway accepted the payload for network dispatch.
  - `DELIVERED`: Recipient device/server confirmed delivery.
  - `BOUNCED`: Recipient mailbox/phone unreachable or rejected.
  - `FAILED`: Exhausted retries or encountered permanent failure.
- **Attempt History**:
  - Every external attempt is recorded in `NotificationDeliveryAttempt` with attempt number, duration, response codes, and sanitized error messages.
- **Terminal State Lock**:
  - Deliveries in `DELIVERED` or `BOUNCED` status cannot transition backwards to `PENDING` or `SENT`.
