# ADR-049: Fixed Asset Lifecycle and Capitalization Strategy

## Status

Accepted

## Context

Fixed assets represent multi-period capital expenditures that must be tracked from acquisition through capitalization, activation, depreciation, and eventual disposal. We need a lifecycle model that ensures strict accounting integrity, prevents modification of capitalized assets, and integrates with M10 Purchasing and M13 Accounts Payable.

## Decision

1. **Explicit Lifecycle States**:
   - `DRAFT`: Editable; allows staging acquisition cost, category mappings, and source references.
   - `CAPITALIZED`: Financial commitment established; balanced capitalization journal posted; depreciation schedule pre-computed.
   - `ACTIVE`: In service and subject to monthly depreciation runs.
   - `FULLY_DEPRECIATED`: Carrying net book value equals residual value floor.
   - `DISPOSED`: Decommissioned or sold; GL gain/loss entry posted.
   - `VOIDED`: Reversal of capitalization (only permissible prior to any posted depreciation).
2. **Capitalization Journal Entry**:
   - **Debit**: Fixed Asset Account (`FIXED_ASSET` / Category account).
   - **Credit**: Accounts Payable / Acquisition Clearing (`ACCOUNTS_PAYABLE`).
3. **Traceability to Source Documents**:
   - Preserve nullable links to `PurchaseOrder`, `GoodsReceipt`, and `SupplierInvoice` to maintain end-to-end supply chain auditability without duplicating line-item records.

## Consequences

- Guarantees that capitalized assets cannot be casually edited.
- Maintains strict auditability and seamless integration with existing General Ledger journals.
