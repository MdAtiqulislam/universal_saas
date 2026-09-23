# 14. Bulk & Batched Notification Processing

## Bounded Concurrency Processing (`INV-472`)

Large broadcasts (e.g. system announcements or promotional campaigns targeting thousands of users) are processed via `BulkNotificationsService`:

- **Worker Pool Partitioning**:
  - Batches are sliced into chunks executed with bounded concurrency (default concurrency: 10 concurrent dispatches).
  - Protects Node.js event loop throughput, PostgreSQL connection pools, and external gateway rate limits.
- **Fail-Safe Isolation**:
  - Individual recipient failures do not abort the overall batch.
  - Generates comprehensive dispatch reports detailing successful vs failed counts.
- **Tenant Quota Tracking**:
  - Bulk dispatches pre-validate recipient counts against M42 usage quotas before queueing.
