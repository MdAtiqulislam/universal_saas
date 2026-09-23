# 02. Plans & Pricing Catalog

## Plan Structure & Integrity

The plan catalog is organized hierarchically:

1. **`BillingPlan`**: The logical product tier (e.g. Starter, Professional, Enterprise) identified by an immutable, unique slug (`key`).
2. **`BillingPlanVersion`**: A specific pricing and feature snapshot. Version 1 is created initially and subsequent versions can be drafted and iterated upon.
3. **`BillingPrice`**: Declares currency, interval (`MONTHLY`, `YEARLY`), pricing model (`FLAT`, `PER_UNIT`, `TIERED`, `VOLUME`, `USAGE_BASED`, `HYBRID`), and base price in minor units.
4. **`BillingPlanFeature`**: Connects registered features from `BillingFeature` to the plan version, indicating whether the feature is enabled, unlimited, or capped by a numeric limit.

## SHA-256 Snapshot Integrity (INV-428)

When an administrator publishes a draft plan version:

- A canonical JSON snapshot of all price records and feature rules is serialized.
- A SHA-256 hash is computed and permanently stored in the `checksum` column.
- `isPublished` is set to `true` and `effectiveFrom` is stamped.
- The published plan version is sealed: any future attempts to mutate its prices or entitlements throw HTTP 400 `BadRequestException`.
- New pricing iterations are created as new distinct version records (e.g., version 2).
