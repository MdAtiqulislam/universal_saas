# ADR-136: Centralized Entitlements, Tier Enforcement and Quota Architecture

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M42

## Context

Platform features and computational capacity must be governed systematically. Hardcoding feature checks or tier limits inside individual business controllers leads to inconsistency, security gaps, and difficult plan migrations. A centralized entitlement authority is required.

## Decision

1. **Decoupled Feature Registry**:
   - Features are globally registered in `BillingFeature` with unique identifiers (`key`), human-readable descriptions, and data types (`BOOLEAN`, `NUMERIC`).
   - Feature entitlement definitions (`BillingPlanFeature`) associate features with specific plan versions, declaring whether the feature is enabled, unlimited, or subject to a numeric cap.
2. **Centralized Entitlements Service**:
   - `EntitlementsService` serves as the single source of truth for platform capabilities (`hasFeature`, `getLimit`, `assertEntitled`, `assertWithinQuota`).
   - Other modules query `EntitlementsService` rather than accessing billing database tables directly.
3. **Tri-State Quota Model**:
   - `HARD_LIMIT`: Requests exceeding configured quota limits are immediately rejected with HTTP 403 `ForbiddenException` (`INV-443`).
   - `SOFT_LIMIT`: Requests exceeding quota trigger structured warning logs and alerts but are permitted to proceed.
   - `UNLIMITED`: No caps enforced; usage is tracked for metering purposes only.
4. **Authorized Administrative Overrides**:
   - Enterprise negotiations and support exceptions can allocate an `authorizedOverride` and `overrideReason` on a tenant's `BillingQuota` without requiring a custom plan version.

## Consequences

- Enforces clear feature gates across the entire platform.
- Provides tenants with transparent visibility into plan boundaries and quota consumption via the administrative portal.
