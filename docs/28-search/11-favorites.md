# 11 — Starred Favorites Architecture

## Explicit Bookmarking

Users can star any operational entity across the platform for rapid retrieval:

- `organizationId`, `userId`: User context
- `resourceType`: Entity type
- `resourceId`: Entity ID
- `title`, `url`: Navigation metadata
- `createdAt`: Star timestamp

## Uniqueness & Authorization (`INV-489`, `INV-490`)

- **INV-489**: The combination `@@unique([organizationId, userId, resourceType, resourceId])` enforces uniqueness at the database layer. Toggling a favorite idempotently adds or removes the bookmark.
- **INV-490**: Prior to adding a favorite, the system validates that the caller holds the appropriate permission for the target `resourceType`.
