# 01. System Architecture & Overview

## Architecture Principles

Milestone M43 delivers a centralized, multi-tenant Omnichannel Notifications and Communications Platform for Universal Business Operations SaaS. The platform unifies event-driven dispatches across four native channels: `IN_APP`, `EMAIL`, `PUSH`, and `SMS`.

## Key Capabilities

- **Authoritative Dispatch Hub**: Single entry point (`NotificationsService`) for system events, workflow actions, security alerts, and manual broadcasts.
- **Strict Multi-Tenancy**: All notifications, delivery records, templates, preferences, and provider credentials enforce tenant isolation (`organizationId`). Cross-tenant access is rejected with HTTP 403 Forbidden (`INV-451`).
- **Zero-Redesign Integration**: Reuses existing foundations:
  - M36 JobService & Idempotency
  - M37 Security Events & RBAC
  - M38 Structured Logging & Observability
  - M39 Credential Encryption (AES-256-GCM)
  - M40 Workflow Action Dispatch
  - M41 Developer Public API Catalog
  - M42 Metered Usage & Entitlement Quota Verification
