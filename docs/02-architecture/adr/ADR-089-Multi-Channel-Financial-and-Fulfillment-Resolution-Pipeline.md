# ADR-089: Multi-Channel Financial and Fulfillment Resolution Pipeline

## Context

Finalizing a return request requires executing financial remedies (issuing customer credit notes, issuing monetary refunds, or generating vendor debit notes) or fulfillment remedies (creating replacement sales orders). These transactions must orchestrate existing engines (M18, M15, M28) without duplicating GL posting logic or currency handling.

## Decision

1. Unified `ReturnResolution` Entity:
   - Records resolution type (`CREDIT_NOTE`, `REFUND`, `DEBIT_NOTE`, `REPLACEMENT`, `PARTIAL_CREDIT`, `PARTIAL_REFUND`).
   - Stores resolution amount, quantity, and foreign keys to `CustomerCreditNote`, `CustomerRefund`, `SupplierDebitNote`, or `SalesOrder`.
2. Financial Engine Integration:
   - `CREDIT_NOTE`: Invokes M18 Credit Note engine to create or link an active credit note.
   - `REFUND`: Generates M18/M15 customer refund linking to specified payment account and currency.
   - `DEBIT_NOTE`: Creates M18 supplier debit note against linked purchase order/supplier.
3. Fulfillment Engine Integration:
   - `REPLACEMENT`: Validates against `maxReplacementQty` and links to replacement `SalesOrder` for warehouse dispatch.
4. Auto-Resolution Progression:
   - Transition RMA status to `RESOLVED` and enables final closure (`CLOSED`) with full immutability lock.

## Consequences

- Seamless financial reconciliation across AR, AP, General Ledger, and Banking.
- Fully auditable resolution history per return request line.
