# 10 — Recent Items Architecture

## Bounded LRU Recent Items

The `RecentItem` model maintains an automatically updating list of recently viewed entities for each user:

- `organizationId`, `userId`: Tenant and user identity (`INV-488`)
- `resourceType`: Entity type (e.g. `Customer`, `SalesOrder`)
- `resourceId`: Entity primary key
- `title`, `url`: Link metadata for UI navigation
- `viewedAt`: Access timestamp

## Automatic Pruning & Size Bounds

`RecentItemsRepository.recordRecentItem` maintains a bounded LRU cache per user capped at a maximum of 50 items:

1. Upserts the viewed item with an updated `viewedAt` timestamp.
2. If total items exceed 50, automatically deletes the oldest entries outside the top 50.
