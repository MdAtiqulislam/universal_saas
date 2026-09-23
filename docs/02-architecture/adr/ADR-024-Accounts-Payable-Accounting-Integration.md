# ADR-024: Accounts Payable General Ledger Posting and Compensating Reversals

## Status

Accepted

## Context

Accounts payable transactions must feed directly into the multi-tenant general ledger without hardcoding account numbers or breaking double-entry parity. Voiding posted invoices must also preserve ledger immutability.

## Decision

### 1. Dynamic Account Mapping (`AccountingAccountMapping`)

Instead of hardcoding account IDs, each tenant organization configures dynamic mappings (`ACCOUNTS_PAYABLE`, `PURCHASE_EXPENSE`, `INVENTORY_ASSET`, `INPUT_TAX`, `PURCHASE_DISCOUNT`). Mappings are validated to ensure target accounts exist in the tenant and are active.

### 2. Double-Entry Posting Pipeline

Posting a supplier invoice atomically generates an M12 `JournalEntry` with `sourceType: 'SUPPLIER_INVOICE'`:

- **Debit**: Purchase Expense (`subtotal - discount_amount`)
- **Debit**: Input Tax (`tax_amount`, if $> 0$)
- **Credit**: Accounts Payable (`grand_total`)

### 3. Compensating Reversals

Voiding an invoice generates a new compensating journal entry with flipped debits and credits referencing `sourceType: 'REVERSAL'`. The original journal and invoice records are marked `VOIDED`.

## Consequences

- **Positive**: Complete GAAP / IFRS compliance with immutable ledger auditability.
- **Negative**: Requires tenant administrators to configure account mappings before posting their first supplier invoice.
