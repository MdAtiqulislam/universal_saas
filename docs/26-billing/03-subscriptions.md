# 03. Subscription State Machine & Lifecycle

## Lifecycle States (INV-435 & INV-436)

Subscriptions progress through a validated state machine:

- **`TRIALING`**: Active evaluation period without immediate billing. Valid transitions: `ACTIVE`, `PAUSED`, `CANCELLED`, `EXPIRED`.
- **`ACTIVE`**: Fully paid, active subscription. Valid transitions: `PAST_DUE`, `PAUSED`, `CANCELLED`, `EXPIRED`.
- **`PAST_DUE`**: Payment failed or retry pending. Valid transitions: `ACTIVE`, `CANCELLED`, `EXPIRED`.
- **`PAUSED`**: Temporarily suspended subscription. Valid transitions: `ACTIVE`, `CANCELLED`.
- **`CANCELLED`**: Terminal cancellation state.
- **`EXPIRED`**: Terminal expired trial state.

## Scope & Singularity (INV-434)

- Exactly one active subscription exists per organization per subscription scope (default: `PLATFORM`).
- Creating a secondary subscription for an existing active scope throws HTTP 409 `ConflictException`.

## Deterministic Proration Engine

When upgrading mid-cycle:

- Calculates remaining billing period duration in milliseconds and basis points (10,000 = 100%).
- Unused portion of current plan is credited back.
- Prorated charge of new plan version is computed.
- All monetary arithmetic uses minor units to prevent float rounding errors.
