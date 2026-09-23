# 04. Feature Entitlements & Platform Gating

## Centralized Entitlement Authority

The `EntitlementsService` provides uniform capability checks across the codebase:

```typescript
// Check if tenant has access to an operational capability
const canUseManufacturing = await entitlementsService.hasFeature(
  orgId,
  "manufacturing.work_orders",
);

// Retrieve numeric allocation limit
const { isUnlimited, limit } = await entitlementsService.getLimit(orgId, "api.rate_limit_rpm");

// Assert entitled (throws ForbiddenException if not entitled)
await entitlementsService.assertEntitled(orgId, "security.sso");
```

## Entitlement Mapping

- Features belong to a global catalog (`BillingFeature`).
- Plan versions bind features via `BillingPlanFeature`.
- When a subscription is active, its plan version dictates available features and limits.
- If a tenant has no active subscription or their subscription is cancelled/expired, features default to locked/inaccessible.
