# ADR-041: COGS and Inventory Accounting Integration Strategy

## Status

Accepted

## Context

Physical goods transactions (purchasing, customer deliveries, inventory adjustments, and returns) directly alter the balance sheet and profit & loss statement. These events must generate double-entry General Ledger postings automatically.

## Decision

1. **Double-Entry Journal Postings**:
   - **Goods Receipt**: Debit `INVENTORY_ASSET`, Credit `PURCHASE_CLEARING` (or `ACCOUNTS_PAYABLE`).
   - **Sales Delivery / Outbound Issue**: Debit `COGS`, Credit `INVENTORY_ASSET`.
   - **Positive Adjustment**: Debit `INVENTORY_ASSET`, Credit `INVENTORY_ADJUSTMENT_GAIN`.
   - **Negative Adjustment**: Debit `INVENTORY_ADJUSTMENT_LOSS`, Credit `INVENTORY_ASSET`.
   - **Customer Return (Restock)**: Debit `INVENTORY_ASSET`, Credit `COGS`.
2. **Account Mapping Configuration**:
   - Account mappings are resolved per tenant using `ApAccountMappingService` (`COGS`, `PURCHASE_CLEARING`, `INVENTORY_ASSET`, `INVENTORY_ADJUSTMENT_GAIN`, `INVENTORY_ADJUSTMENT_LOSS`).
3. **Immutable Journals & Subledger Traceability**:
   - Every journal entry links to source documents (`DELIVERY_ORDER`, `GOODS_RECEIPT`, `INVENTORY_ADJUSTMENT`, `CUSTOMER_RETURN_RESTOCK`).

## Consequences

- **Positive**: Complete synchronization between warehouse inventory valuation and General Ledger asset balances.
- **Negative**: Outbound deliveries require open accounting periods to post COGS.
