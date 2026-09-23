# 07. Invoicing Engine & Immutability

## Invoice Compilation & Lifecycle

`BillingInvoice` records represent commercial billing statements:

1. **`DRAFT`**: Editable stage where line items, taxes, discounts, and credit ledger deductions are compiled.
2. **`OPEN`**: Finalized invoice awaiting payment or partial settlement.
3. **`PAID`**: Fully settled invoice (`amountPaid >= totalAmount`, `amountDue === 0`).
4. **`PARTIALLY_PAID`**: Partial payment recorded; remaining balance due.
5. **`VOID`**: Cancelled or invalidated invoice with documented audit reason.

## Deterministic Calculation Invariants (INV-446 & INV-447)

All calculations are strictly performed in minor units:

$$\text{subtotal} = \sum (\text{quantity} \times \text{unitAmount})$$
$$\text{totalAmount} = \max(0, \text{subtotal} + \text{taxAmount} - \text{discountAmount} - \text{creditApplied})$$

## Immutability Guarantee (INV-445)

Once finalized (`status !== DRAFT` or `finalizedAt !== null`), an invoice is strictly immutable. Modification of line items, totals, or dates throws HTTP 400 `BadRequestException`. Any billing adjustments must be performed through new credit notes or void actions.
