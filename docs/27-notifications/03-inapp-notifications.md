# 03. In-App Notification Center

## Capabilities & State Tracking

The in-app notification center provides real-time notification feeds for logged-in organization members:

- **Persistence**: Stored directly in `Notification` and `NotificationRecipient` records with channel `IN_APP`.
- **Read State**: Tracked per recipient via `readAt: DateTime`.
- **API Endpoints**:
  - `GET /api/v1/notifications/inbox` — Retrieves paginated in-app notifications for the caller.
  - `PATCH /api/v1/notifications/:id/read` — Marks a specific notification as read.
  - `POST /api/v1/notifications/read-all` — Marks all unread items as read in a single atomic transaction.
- **Frontend Center**: Interactive inbox panel in `NotificationCenterPanel.tsx` with unread badges, filter tabs, and real-time read state updates.
