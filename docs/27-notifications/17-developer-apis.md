# 17. Developer REST API Reference

## Public Notification Endpoints (M41 Scoped)

External developer and partner applications interact with notifications via M41 Public API platform:

### 1. Send Notification

- **Endpoint**: `POST /api/v1/notifications`
- **Required Scopes**: `notifications.manage`, `api.write`
- **Request Body**:

```json
{
  "eventType": "order.shipped",
  "templateKey": "order_shipped_v1",
  "channels": ["IN_APP", "EMAIL"],
  "recipientUserIds": ["11111111-1111-1111-1111-111111111111"],
  "payload": {
    "orderId": "SO-101",
    "trackingNumber": "FDX-998822"
  }
}
```

### 2. List Notifications

- **Endpoint**: `GET /api/v1/notifications?page=1&limit=50`
- **Required Scopes**: `notifications.view`, `api.read`

### 3. Mark Notification Read

- **Endpoint**: `PATCH /api/v1/notifications/:id/read`
- **Required Scopes**: `notifications.manage`, `api.write`

### 4. Recipient Preferences

- **Endpoint**: `GET /api/v1/notifications/preferences`
- **Endpoint**: `PATCH /api/v1/notifications/preferences`
- **Required Scopes**: `notifications.preferences.view` / `manage`
