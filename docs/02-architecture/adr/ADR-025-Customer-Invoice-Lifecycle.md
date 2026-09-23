# ADR-025: Customer Invoice Lifecycle and Source Document Conversions

## Status

Accepted

## Context

Accounts receivable workflows require converting confirmed Sales Orders and completed Delivery Orders into customer invoices while enforcing tenant isolation, idempotency, and non-destructive voiding.

## Decision

### 1. State Machine Definition

- `DRAFT`: Editable draft state. Can be updated, deleted, or cancelled.
- `ISSUED`: Published to the customer. Generates a balanced General Ledger journal entry. Financial lines become strictly immutable.
- `PARTIALLY_PAID` / `PAID`: Payment tracking states (settlement milestone).
- `VOIDED`: Terminal state for issued invoices. Generates a compensating GL reversal journal.

### 2. Sourced Conversions

- **From Sales Order**: Copies unbilled line items, calculates remaining quantities, and prevents duplicate billing beyond the confirmed order volume.
- **From Delivery Order**: Matches delivered quantities directly to invoice lines, preventing invoices for undelivered goods.

## Consequences

- **Positive**: Complete traceability between Sales Orders, Deliveries, Invoices, and General Ledger postings.
- **Negative**: Edits to issued invoices must follow the formal VOID + replacement workflow.
