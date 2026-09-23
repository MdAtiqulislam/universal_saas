# Milestone M43: Notifications, Communications & Omnichannel Messaging Foundation

Welcome to the technical documentation for the Notifications and Omnichannel Communications Platform of the Universal Business Operations SaaS monorepo.

## Documentation Index

1. **[01. System Architecture & Overview](01-overview.md)** — Architectural principles, domain boundaries, and multi-tenant isolation.
2. **[02. Omnichannel Routing Engine](02-omnichannel-routing.md)** — Channel resolution, policy evaluation, and recipient routing.
3. **[03. In-App Notification Center](03-inapp-notifications.md)** — In-app delivery, read/unread state tracking, and user inbox.
4. **[04. Email Delivery Engine](04-email-engine.md)** — Transactional email delivery, bounce handling, and SMTP sandbox adapter.
5. **[05. Mobile Push Notifications](05-push-notifications.md)** — APNs & FCM push tokens, device registration, and invalidation.
6. **[06. SMS Telephony Engine](06-sms-telephony.md)** — E.164 international phone formatting, SMS gateway abstraction, and carrier routing.
7. **[07. Safe Template Syntax & Rendering](07-template-engine.md)** — Zero code execution, dot-path variable resolution, and SSTI protection.
8. **[08. Immutable Template Versions & Integrity](08-template-versioning.md)** — Version snapshots, published immutability, and SHA-256 hashes.
9. **[09. Recipient Communication Preferences](09-recipient-preferences.md)** — Channel opt-ins/opt-outs, category filtering, and preference precedence.
10. **[10. Timezone-Aware Quiet Hours](10-quiet-hours.md)** — Quiet windows, midnight crossing support, and security alert bypass rules.
11. **[11. Tenant Communication Policies](11-tenant-policies.md)** — Dispatch rate limits, mandatory disclaimers, and opt-out headers.
12. **[12. Provider Abstraction & Failover](12-provider-failover.md)** — Adapter design, priority order failover, and transient error classification.
13. **[13. Scheduled Notification Dispatches](13-scheduled-dispatches.md)** — Future scheduling via M36 JobService and atomic status transitions.
14. **[14. Bulk & Batched Notification Processing](14-bulk-notifications.md)** — Bounded concurrency, resource protection, and campaign dispatches.
15. **[15. Provider Webhook Deduplication](15-webhook-deduplication.md)** — Status callback reconciliation, duplicate suppression, and delivery updates.
16. **[16. Delivery Tracking & State Machine](16-delivery-lifecycle.md)** — Comprehensive delivery lifecycle, attempt history, and terminal states.
17. **[17. Developer REST API Reference](17-developer-apis.md)** — Scoped API endpoints, request schemas, and responses.
18. **[18. Security, Tenant Isolation & Audit Trail](18-security-isolation.md)** — Multi-tenant boundaries, audit logging, and credential encryption.
