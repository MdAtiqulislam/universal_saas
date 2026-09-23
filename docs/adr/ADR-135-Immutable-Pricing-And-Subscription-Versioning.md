# ADR-135: Immutable Pricing Versions, SHA-256 Snapshots and Subscription Contracts

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M42

## Context

SaaS commercial contracts demand stability. When a tenant subscribes to a plan version with a specific price and entitlement structure, subsequent price changes or plan redesigns must not retroactively alter the active contract without an explicit grandfathering or upgrade process. Furthermore, pricing records must be verifiable against tampering.

## Decision

1. **Plan vs. Plan Version Hierarchy**:
   - `BillingPlan` represents the high-level commercial catalog container identified by an immutable, unique slug (`key`).
   - `BillingPlanVersion` encapsulates specific pricing structures (`BillingPrice`) and feature limits (`BillingPlanFeature`). Versions are sequentially numbered per plan.
2. **SHA-256 Integrity Sealing**:
   - When a draft plan version is published, an immutable canonical snapshot of its prices and feature rules is hashed using SHA-256 and sealed in the `checksum` field (`INV-428`).
   - Any attempt to modify a published plan version or its associated price line items is strictly rejected.
3. **Subscription Binding**:
   - Every `BillingSubscription` references a specific `BillingPlanVersion` rather than a generic plan.
   - Grandfathering is natively supported: existing tenants stay on their subscribed version indefinitely until an explicit upgrade or renegotiation takes place.
4. **Deterministic Proration Engine**:
   - Mid-cycle upgrades/downgrades use basis-point precision (10,000 = 100%) to calculate remaining cycle credit and new plan charges deterministically using integer minor units, preventing rounding drift or penny discrepancies.

## Consequences

- Commercial pricing contracts are tamper-evident and legally defensible.
- Plan catalogs can evolve continuously with new versions while guaranteeing zero accidental price changes for existing customers.
