# ADR-048: Expense Tax and Accounting Integration Strategy

## Status

Accepted

## Context

Expense claims include business operating costs that often carry recoverable VAT/GST/sales tax. We need to integrate expense claims directly with both the M12 General Ledger and the M20 Tax Engine sub-ledger without hardcoding accounts or writing custom tax arithmetic.

## Decision

1. **Configurable Account Mappings**:
   - Introduce mapping keys: `EMPLOYEE_EXPENSE_PAYABLE`, `EXPENSE_REIMBURSEMENT`, and `EXPENSE_INPUT_TAX` in `ApAccountMappingService`.
   - Category-level GL overrides allow routing specific expense categories (e.g. Travel, Software, Meals) to distinct ledger accounts while falling back to tenant defaults.
2. **Double-Entry Symmetry**:
   - Posting an approved expense claim produces:
     - **Debit**: Expense Account(s) for line subtotals.
     - **Debit**: Input Tax Account (`INPUT_TAX`) for recoverable tax.
     - **Credit**: Employee Payable (`EMPLOYEE_EXPENSE_PAYABLE`) for total claim amount.
3. **M20 Tax Sub-Ledger Recording**:
   - When an expense line carries a valid `taxCodeId` and `taxAmount > 0`, post an entry to `tax_transactions` with `taxScope = INPUT` and `sourceType = EXPENSE_CLAIM`.
   - Validates that the transaction date does not fall within a `LOCKED` tax period.
4. **Exact Decimal Precision**:
   - All arithmetic uses `Prisma.Decimal` with 4 decimal places (`DECIMAL(20, 4)`).

## Consequences

- Full auditability across General Ledger, AP Sub-Ledger, and Tax Returns.
- Seamless compatibility with tax filing period locking (ADR-045).
