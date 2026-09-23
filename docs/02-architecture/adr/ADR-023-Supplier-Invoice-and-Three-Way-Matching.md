# ADR-023: Supplier Invoicing Lifecycle and Three-Way Matching Engine

## Status

Accepted

## Context

In accounts payable operations, invoices submitted by vendors must be reconciled against upstream purchase orders and warehouse goods receipt logs to prevent duplicate billing, over-invoicing, and unauthorized price increases.

## Decision

### 1. Three-Way Reconciliation Architecture

The `AccountsPayableMatchingService` evaluates:

- **Quantity Matching**:
  $$\text{cumulativeInvoiced} = \text{previouslyInvoiced} + \text{currentInvoiced} \le \min(\text{orderedQuantity}, \text{receivedQuantity})$$
- **Price Matching**: Verifies $\text{invoiceUnitPrice} == \text{poUnitPrice}$.
- **Match Outcomes**:
  - `MATCHED`: Quantities and prices reconcile cleanly.
  - `PRICE_VARIANCE`: Price difference flagged for approval.
  - `QUANTITY_VARIANCE`: Quantity difference flagged.
  - `OVER_INVOICED`: Invoicing exceeds allowable limits (`canApprove = false`).

### 2. State Machine Controls

- Transitioning to `APPROVED` validates matching results; over-invoiced records are blocked from approval.
- Posted invoices are strictly immutable.

## Consequences

- **Positive**: Eliminates rogue spend and overpayments before general ledger postings occur.
- **Negative**: Requires clean line item linking from purchase orders down to supplier invoice lines.
