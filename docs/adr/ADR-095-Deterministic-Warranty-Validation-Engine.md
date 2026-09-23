# ADR-095: Deterministic Warranty Validation Engine

## Status

Accepted

## Context

After-sales service requests and repairs must determine whether parts, labor, and diagnostic costs are covered by manufacturer warranty, extended warranty contracts, or are billable to the customer. Warranty claims must not rely on subjective or client-side decisions.

## Decision

1. Implement `WarrantyPolicy` with explicit parameters: duration in months, coverage types (`FULL`, `PARTS_ONLY`, `LABOR_ONLY`, `LIMITED`, `NONE`), boolean coverage flags, and exclusions.
2. Link active policies to installed base equipment via `CustomerAssetWarranty` records with claim limits and tracked claimed amounts.
3. Build a deterministic `WarrantyEligibilityService` that evaluates service dates, warranty start/end dates, contract statuses, and policy rules, returning exact coverage flags and remaining warranty days.
4. Emit domain audit events (`WARRANTY_ELIGIBILITY_CHECKED`) on every validation event.

## Consequences

### Positive

- Prevents unentitled free repairs and revenue leakage.
- Enforces consistent warranty claim handling across all support and service channels.
- Provides immediate auditability for warranty claim decisions.

### Negative

- Requires maintaining active warranty policy data and warranty contract attachments.
