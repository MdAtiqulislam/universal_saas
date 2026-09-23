# 06. Quota Enforcement & Administrative Overrides

## Quota Enforcement Model (INV-443)

Tenants have quota allocations defined in `BillingQuota` for specific metrics. The platform evaluates quota headroom prior to executing resource-intensive actions:

- **`HARD_LIMIT`**: When `currentUsage + requestedAmount > effectiveLimit`, the system rejects the operation with HTTP 403 `ForbiddenException`.
- **`SOFT_LIMIT`**: Operation proceeds, but warning logs and telemetry alerts are dispatched for commercial upsell.
- **`UNLIMITED`**: No limit enforced; usage is tracked strictly for informational or usage-based billing purposes.

## Effective Limits & Overrides

The effective limit is computed deterministically:

```typescript
const effectiveLimit =
  quota.authorizedOverride !== null && quota.authorizedOverride !== undefined
    ? quota.authorizedOverride
    : quota.allocatedAmount;
```

Administrative overrides allow enterprise accounts to exceed standard plan limits with full audit logging (`billing.quota.updated`).
