# ADR-139: Omnichannel Notification Platform Architecture and Provider Routing

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M43

## Context

Enterprise business operations trigger communications across multiple channels: in-app notifications, transactional email, mobile push alerts, and telephony SMS. Hard-coding communication delivery inside domain modules leads to fragmentation, inconsistent audit logging, duplicate provider implementations, and unmonitored rate limits. The platform requires a unified, tenant-isolated notification hub that abstracts dispatch, delivery tracking, and channel routing.

## Decision

1. **Unified Hub Model**:
   - Establish the `NotificationsService` as the single authoritative entrypoint for system and domain dispatches.
   - Support four native channels: `IN_APP`, `EMAIL`, `PUSH`, and `SMS`.
2. **Channel-Agnostic Routing & Policy Filtering**:
   - Dispatches pass through `ChannelRouterService`, which applies tenant communication policies, recipient opt-outs, and delivery limits.
3. **Pluggable Channel Adapters**:
   - Each channel is backed by standard adapter interfaces (`ChannelProviderAdapter`), decoupling the domain from downstream vendor APIs (SendGrid, AWS SES, Twilio, APNs/FCM).
4. **Tenant Isolation**:
   - All notifications, recipients, deliveries, templates, and provider configurations enforce strict tenant scoping via `organizationId`. Cross-tenant access throws HTTP 403 Forbidden.

## Consequences

- Domain modules (billing, workflows, security, service orders) trigger notifications via a uniform contract.
- Channel providers can be configured, prioritized, and monitored per organization without code changes.
