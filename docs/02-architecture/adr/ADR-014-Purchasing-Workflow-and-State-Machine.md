# ADR-014: Purchase Order Lifecycle & State Machine Architecture

**Status:** ACCEPTED  
**Date:** 2026-08-28  
**Deciders:** Lead Architect, Systems Architect  
**Technical Milestone:** M10 — Suppliers & Purchasing Management

---

## Context & Problem Statement

Purchasing operations represent significant legal and financial commitments between an organization and external suppliers. Allowing unconstrained updates to core order terms (quantities, prices, suppliers, line items) after managerial approval or partial delivery introduces severe auditing, billing, and inventory reconciliation issues.

---

## Decision Drivers

1. **Financial Immutability:** Once an order is approved, commercial financial fields must be locked.
2. **Explicit State Transitions:** Only deterministic, business-authorized lifecycle progressions must be permitted.
3. **Auditability:** Every transition must record the actor, timestamp, and publish domain events.

---

## Decision Outcome

**Chosen Option:** **Explicit Finite State Machine (FSM) with strict precondition validation and immutable lines post-approval**.

### State Machine Definition

```
           ┌──────────┐
           │  DRAFT   │
           └────┬─────┘
                │ submit()
                ▼
          ┌───────────┐
          │ SUBMITTED ├──────────────┐
          └─────┬─────┘              │
                │ approve()          │
                ▼                    │ cancel()
          ┌───────────┐              │
     ┌────┤ APPROVED  ├────────┐     │
     │    └─────┬─────┘        │     │
     │          │              │     │
     │          ▼              │     │
     │   ┌───────────────┐     │     │
     │   │   PARTIALLY   │     │     │
     │   │   RECEIVED    ├──┐  │     │
     │   └──────┬────────┘  │  │     │
     │          │           │  │     │
     │          ▼           ▼  ▼     ▼
     │   ┌──────────────┐ ┌─────────────┐
     │   │   RECEIVED   │ │  CANCELLED  │
     │   └──────┬───────┘ └─────────────┘
     │          │
     │          │ close()
     │          ▼
     │   ┌──────────────┐
     └──>│    CLOSED    │
         └──────────────┘
```

### Transition Invariants

- **`DRAFT`:** Full CRUD permitted on header and lines.
- **`SUBMITTED`:** Pending managerial review. Can transition to `APPROVED` or `CANCELLED`.
- **`APPROVED`:** Legally committed. Financial lines locked. Eligible for Goods Receipt creation.
- **`PARTIALLY_RECEIVED`:** At least one unit received, but total received < total ordered across lines.
- **`RECEIVED`:** All lines fully fulfilled (`receivedQuantity >= quantity`).
- **`CLOSED`:** Terminal administrative state.
- **`CANCELLED`:** Terminal cancellation state.

### Positive Consequences

- Guarantees financial contract integrity.
- Eliminates race conditions between order modification and incoming physical shipments.
