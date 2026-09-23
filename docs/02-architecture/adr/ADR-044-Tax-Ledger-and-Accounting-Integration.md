# ADR-044: Authoritative Tax Ledger and General Ledger Double-Entry Integration

## Context

Tax compliance reporting (VAT/GST returns, sales tax filings) requires an unalterable, queryable record of every tax transaction with clear classification between Output Tax (sales/collected) and Input Tax (purchases/paid). Relying solely on general ledger lines or raw invoice documents makes tax reconciliation error-prone and performance intensive.

## Decision

1. **Authoritative `tax_transactions` Table**: Every posted tax event is stored as an immutable record containing `taxCodeId`, `jurisdictionId`, `transactionDate`, `taxScope` (`OUTPUT` / `INPUT`), `sourceType`, `sourceId`, exact `taxableAmount`, `taxRate`, and `taxAmount`.
2. **Idempotency & Reversals**: A unique constraint on `(organization_id, source_type, source_id, tax_code_id, is_reversal)` ensures idempotency and clean reversal audit trails.
3. **Double-Entry General Ledger Posting**:
   - Output Tax: Debit `ACCOUNTS_RECEIVABLE` (or Clearing), Credit `OUTPUT_TAX` liability.
   - Input Tax: Debit `INPUT_TAX` asset/recoverable, Credit `ACCOUNTS_PAYABLE` (or Clearing).
   - All postings use open fiscal periods and configured account mappings.

## Consequences

- Fast, direct querying for tax audits and filing reports without parsing full GL ledgers.
- Accurate synchronization between sub-ledger tax reporting and General Ledger trial balances.
